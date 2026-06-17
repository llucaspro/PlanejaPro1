import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { getDb, usersTable, aiUsageTable } from "../_lib/db";
import { verifyToken, extractBearerToken } from "../_lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
  if (!body?.tipo || !body?.informacoes) {
    return res.status(400).json({ error: "Campos obrigatórios: tipo, informacoes" });
  }

  const tipoPrompts: Record<string, string> = {
    parecer: `Crie um parecer descritivo individual profissional baseado nas informações fornecidas. O texto deve ser formal, objetivo e positivo mesmo ao tratar dificuldades, destacando o progresso e potencial do aluno. Use linguagem pedagógica adequada.`,
    individual: `Crie um relatório individual completo do aluno. Deve incluir: desempenho acadêmico, desenvolvimento social e emocional, participação, pontos de destaque e áreas de atenção. Tom profissional e construtivo.`,
    turma: `Crie um relatório de turma completo. Deve incluir: perfil geral da turma, pontos fortes coletivos, desafios observados, estratégias utilizadas, e recomendações pedagógicas para o próximo período.`,
    observacoes: `Crie observações pedagógicas profissionais e estruturadas. Organize as informações em tópicos claros, use linguagem técnica pedagógica, e finalize com recomendações de intervenção ou encaminhamento.`,
  };

  const prompt = `Você é um especialista em redação de documentos pedagógicos para a educação básica brasileira.

${tipoPrompts[body.tipo] || tipoPrompts["parecer"]}

Informações fornecidas pelo professor:
---
${body.informacoes}
---

${body.nomeAluno ? `Nome do aluno/a: ${body.nomeAluno}` : ""}
${body.anoSerie ? `Ano/Série: ${body.anoSerie}` : ""}
${body.disciplina ? `Disciplina: ${body.disciplina}` : ""}
${body.periodo ? `Período: ${body.periodo}` : ""}

Retorne APENAS JSON válido neste formato (sem markdown):
{
  "tipo": "${body.tipo}",
  "titulo": "Título do documento",
  "textoCompleto": "O texto completo do relatório/parecer, bem redigido e profissional, com parágrafos estruturados",
  "pontosPrincipais": ["Ponto principal 1", "Ponto principal 2", "Ponto principal 3"],
  "recomendacoes": ["Recomendação 1", "Recomendação 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096, temperature: 0.6 },
    });

    let raw = response.text ?? "";
    raw = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "IA retornou formato inválido. Tente novamente." });
    }

    const estimatedTokens = Math.round((prompt.length + JSON.stringify(result).length) / 4);

    if (!user.isPremium) {
      await db.update(usersTable)
        .set({ freeGenerationsRemaining: user.freeGenerationsRemaining - 1, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: "report_generate", estimatedTokens });

    return res.status(200).json({
      ...result,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar relatório: " + msg });
  }
}
