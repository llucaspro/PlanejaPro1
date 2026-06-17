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

  const numAulas = Math.min(Math.max(Number(body.numAulas ?? 4), 1), 12);

  const prompt = `Você é um especialista em pedagogia brasileira e BNCC. Crie uma sequência didática completa para:
- Disciplina: ${body.disciplina}
- Ano/Série: ${body.anoSerie}
- Tema: ${body.tema}
- Número de aulas: ${numAulas}
- Duração de cada aula: ${body.duracaoAula || 50} minutos
- Objetivos: ${body.objetivos || "Desenvolver os conteúdos de forma significativa e progressiva"}

Retorne APENAS JSON válido neste formato (sem markdown):
{
  "titulo": "Título da sequência didática",
  "objetivoGeral": "Objetivo geral da sequência",
  "competencias": ["Competência 1 da BNCC", "Competência 2"],
  "habilidades": ["Habilidade 1", "Habilidade 2"],
  "recursosGerais": ["Recurso 1", "Recurso 2"],
  "aulas": [
    {
      "numero": 1,
      "titulo": "Título da Aula 1",
      "objetivo": "Objetivo específico desta aula",
      "conteudos": ["Conteúdo 1", "Conteúdo 2"],
      "metodologia": "Descrição da metodologia usada",
      "desenvolvimento": "Passo a passo detalhado do desenvolvimento da aula",
      "atividadeInicial": "Atividade de abertura/engajamento (10 min)",
      "atividadePrincipal": "Atividade central da aula",
      "encerramento": "Atividade de fechamento e síntese",
      "avaliacao": "Como avaliar a aprendizagem nesta aula",
      "recursos": ["Recurso específico 1"],
      "tarefaCasa": "Tarefa opcional para casa"
    }
  ],
  "avaliacaoFinal": "Descrição da avaliação final da sequência",
  "observacoesPedagogicas": "Dicas gerais para o professor"
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
    raw = raw.replace(/,\s*([}\]])/g, "$1");

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

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: "sequence_generate", estimatedTokens });

    return res.status(200).json({
      ...result,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar sequência didática: " + msg });
  }
}
