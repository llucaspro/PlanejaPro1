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
  if (!body?.disciplina || !body?.anoSerie || !body?.tema) {
    return res.status(400).json({ error: "Campos obrigatórios: disciplina, anoSerie, tema" });
  }

  const quantidade = Math.min(Math.max(Number(body.quantidade ?? 5), 1), 20);
  const dificuldade = body.dificuldade || "medio";
  const tipo = body.tipo || "exercicios";

  const tipoMap: Record<string, string> = {
    exercicios: "exercícios de fixação",
    revisao: "atividades de revisão",
    recuperacao: "atividades de recuperação para alunos com dificuldade",
    tarefa: "tarefas de casa",
    grupo: "atividades em grupo colaborativas",
  };

  const dificuldadeMap: Record<string, string> = {
    facil: "Fácil — linguagem simples, baixo nível de abstração, questões diretas, menor interpretação. Foco em fixação e revisão.",
    medio: "Médio — exige compreensão do conteúdo, aplicação básica do conhecimento, interpretação moderada.",
    dificil: "Difícil — padrão vestibular (ETEC, ENEM, FUVEST, UNESP, UNICAMP, VUNESP, IFSP). Alta interpretação, raciocínio crítico, contextualização, situações-problema. As atividades NÃO devem ser apenas decorativas — devem exigir pensamento.",
  };

  const prompt = `Você é um professor especialista em pedagogia brasileira. Crie ${quantidade} ${tipoMap[tipo] || "exercícios"} para:
- Disciplina: ${body.disciplina}
- Ano/Série: ${body.anoSerie}
- Tema: ${body.tema}
- Tipo: ${tipoMap[tipo]}
- Dificuldade selecionada pelo professor: ${dificuldade === "facil" ? "Fácil" : dificuldade === "medio" ? "Médio" : "Difícil"}

Nível de dificuldade: ${dificuldadeMap[dificuldade]}

Retorne APENAS JSON válido neste formato (sem markdown):
{
  "titulo": "Título do conjunto de atividades",
  "descricao": "Breve descrição pedagógica",
  "atividades": [
    {
      "numero": 1,
      "titulo": "Título da atividade",
      "tipo": "exercicio|grupo|projeto|reflexao",
      "enunciado": "Descrição completa da atividade",
      "instrucoes": "Passo a passo de como realizar",
      "materiais": ["material 1", "material 2"],
      "tempoEstimado": "20 minutos",
      "objetivoPedagogico": "O que o aluno vai aprender"
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.7 },
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

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: "activities_generate", estimatedTokens });

    return res.status(200).json({
      ...result,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
        dificuldade,
        tipo,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar atividades: " + msg });
  }
}
