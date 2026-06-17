import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { getDb, usersTable, aiUsageTable } from "../_lib/db";
import { verifyToken, extractBearerToken } from "../_lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `Você é um especialista em elaboração de avaliações escolares brasileiras.
Você cria provas de alta qualidade, pedagogicamente adequadas, com questões claras e bem formuladas.

REGRAS:
- Questões de múltipla escolha: 5 alternativas (a, b, c, d, e), apenas uma correta
- Questões discursivas: enunciados claros que exigem reflexão e desenvolvimento
- Linguagem adequada para o nível de ensino indicado
- Conteúdo fiel ao tema solicitado
- Gabarito correto e justo
- Responda APENAS com JSON válido, sem markdown, sem blocos de código`;

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "Não autenticado. Faça login novamente." });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado. Faça login novamente." });
  }

  const db = getDb();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));

  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  if (!user.isActive) return res.status(403).json({ error: "Conta bloqueada" });

  if (!user.isPremium && user.freeGenerationsRemaining <= 0) {
    return res.status(403).json({ error: "Seu período gratuito terminou.", code: "FREE_LIMIT_REACHED" });
  }

  const body = req.body;
  if (!body?.disciplina || !body?.conteudo || !body?.anoSerie) {
    return res.status(400).json({ error: "Campos obrigatórios: disciplina, conteudo, anoSerie" });
  }

  const nAlt: number = Math.min(Math.max(parseInt(body.questoesAlternativas ?? "10"), 0), 20);
  const nDisc: number = Math.min(Math.max(parseInt(body.questoesDiscursivas ?? "2"), 0), 8);
  const totalQuestoes = nAlt + nDisc;

  if (totalQuestoes === 0) {
    return res.status(400).json({ error: "A prova deve ter ao menos uma questão." });
  }

  const valorTotal: number = parseFloat(body.valorTotal ?? "10");

  let valorAlt = 0;
  let valorDisc = 0;
  if (nAlt > 0 && nDisc > 0) {
    valorAlt = parseFloat((valorTotal * 0.6 / nAlt).toFixed(2));
    valorDisc = parseFloat((valorTotal * 0.4 / nDisc).toFixed(2));
  } else if (nAlt > 0) {
    valorAlt = parseFloat((valorTotal / nAlt).toFixed(2));
  } else {
    valorDisc = parseFloat((valorTotal / nDisc).toFixed(2));
  }

  const prompt = `Crie uma prova escolar completa com os seguintes parâmetros:

DADOS DA PROVA:
- Disciplina: ${body.disciplina}
- Ano/Série: ${body.anoSerie}
- Turma: ${body.turma ?? "não especificada"}
- Conteúdo cobrado: ${body.conteudo}
- Questões de múltipla escolha: ${nAlt} (valor cada: ${valorAlt} pontos)
- Questões discursivas: ${nDisc} (valor cada: ${valorDisc} pontos)
- Instruções extras: ${body.instrucoes ?? "nenhuma"}

Retorne EXATAMENTE este JSON (sem markdown, apenas JSON puro):
{
  "titulo": "título da prova",
  "instrucoes": "instruções gerais para o aluno (leia atentamente, use caneta azul/preta, etc.)",
  "questoesAlternativas": [
    {
      "numero": 1,
      "enunciado": "enunciado completo da questão",
      "alternativas": {
        "a": "texto da alternativa A",
        "b": "texto da alternativa B",
        "c": "texto da alternativa C",
        "d": "texto da alternativa D",
        "e": "texto da alternativa E"
      },
      "gabarito": "letra correta (a, b, c, d ou e)",
      "valor": ${valorAlt}
    }
  ],
  "questoesDiscursivas": [
    {
      "numero": ${nAlt + 1},
      "enunciado": "enunciado completo da questão discursiva",
      "linhasResposta": 6,
      "valor": ${valorDisc},
      "criterios": "critérios resumidos de correção"
    }
  ]
}

Gere EXATAMENTE ${nAlt} questões de múltipla escolha e ${nDisc} questões discursivas.
Se algum tipo for 0, retorne array vazio para aquele tipo.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.7 },
    });

    let content = response.text ?? "";
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    if (!content) return res.status(500).json({ error: "IA não retornou conteúdo" });

    const exam = JSON.parse(content);

    if (!Array.isArray(exam.questoesAlternativas)) exam.questoesAlternativas = [];
    if (!Array.isArray(exam.questoesDiscursivas)) exam.questoesDiscursivas = [];
    if (typeof exam.titulo !== "string") exam.titulo = `Prova de ${body.disciplina}`;
    if (typeof exam.instrucoes !== "string") exam.instrucoes = "Leia atentamente cada questão antes de responder.";

    const estimatedTokens = Math.round((SYSTEM_PROMPT.length + prompt.length + JSON.stringify(exam).length) / 4);

    if (!user.isPremium) {
      await db.update(usersTable)
        .set({ freeGenerationsRemaining: user.freeGenerationsRemaining - 1, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    await db.insert(aiUsageTable).values({
      userId: user.id,
      requestType: "exam_generate",
      estimatedTokens,
    });

    return res.status(200).json({
      ...exam,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar prova: " + msg });
  }
}
