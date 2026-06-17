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
  if (!body?.conteudo || !body?.tipo) {
    return res.status(400).json({ error: "Campos obrigatórios: conteudo, tipo" });
  }

  const tipoMap: Record<string, string> = {
    simplificar: "Reescreva o conteúdo com linguagem mais simples, acessível e direta. Use vocabulário básico, frases curtas e exemplos do cotidiano. Mantenha o conteúdo pedagógico mas torne-o mais compreensível.",
    serie_inferior: "Adapte o conteúdo para uma série escolar menor/anterior. Simplifique conceitos, remova abstração avançada, use exemplos mais concretos e linguagem adequada para alunos mais novos.",
    serie_superior: "Adapte o conteúdo para uma série escolar maior/posterior. Aprofunde os conceitos, adicione conexões com conteúdos mais avançados, utilize linguagem mais técnica e elaborada.",
    resumo: "Crie um resumo didático e completo do conteúdo. Organize em tópicos principais, destaque os conceitos mais importantes, e mantenha a essência pedagógica de forma concisa.",
    revisao_rapida: "Transforme o conteúdo em um guia de revisão rápida. Organize os pontos principais em formato de checklist ou tópicos numerados, ideal para consulta rápida antes de uma avaliação.",
  };

  const tipoDescricao = tipoMap[body.tipo] || tipoMap["simplificar"];

  const prompt = `Você é um especialista em pedagogia brasileira e adaptação de conteúdo educacional.

Tarefa: ${tipoDescricao}

Conteúdo original fornecido pelo professor:
---
${body.conteudo}
---

${body.serieAlvo ? `Série/faixa etária alvo: ${body.serieAlvo}` : ""}

Retorne APENAS JSON válido neste formato (sem markdown):
{
  "titulo": "Título do conteúdo adaptado",
  "tipo": "${body.tipo}",
  "conteudoAdaptado": "O texto completo adaptado, bem estruturado e organizado",
  "observacoesPedagogicas": "Dicas para o professor sobre como usar esta adaptação",
  "diferencas": ["Principal diferença 1 em relação ao original", "Principal diferença 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.6 },
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

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: "adapt_generate", estimatedTokens });

    return res.status(200).json({
      ...result,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao adaptar conteúdo: " + msg });
  }
}
