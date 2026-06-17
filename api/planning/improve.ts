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
  if (!body?.planejamento) {
    return res.status(400).json({ error: "Campo obrigatório: planejamento" });
  }

  const focusMap: Record<string, string> = {
    dinamicas: "dinâmicas de grupo e atividades interativas para engajar os alunos",
    jogos: "jogos educativos e gamificação que reforcem o conteúdo de forma lúdica",
    praticas: "atividades práticas, experimentos ou projetos hands-on",
    metodologias: "metodologias ativas como PBL, sala de aula invertida, peer instruction",
    sala_invertida: "implementação da sala de aula invertida (Flipped Classroom) com este conteúdo",
    colaborativa: "aprendizagem colaborativa, trabalho em grupo e construção coletiva do conhecimento",
  };

  const foco = body.foco ? (focusMap[body.foco] || "melhorias pedagógicas gerais") : "melhorias pedagógicas gerais";

  const planejamentoResumido = typeof body.planejamento === "string"
    ? body.planejamento.slice(0, 2000)
    : JSON.stringify(body.planejamento).slice(0, 2000);

  const prompt = `Você é um especialista em inovação pedagógica e metodologias ativas para a educação básica brasileira.

Com base neste planejamento de aula, sugira melhorias com foco em: ${foco}

Planejamento atual:
---
${planejamentoResumido}
---

Gere sugestões práticas, detalhadas e aplicáveis. Retorne APENAS JSON válido (sem markdown):
{
  "foco": "${body.foco || "geral"}",
  "resumoMelhorias": "Resumo do que foi sugerido e por que melhora a aula",
  "sugestoes": [
    {
      "titulo": "Nome da sugestão/atividade",
      "descricao": "Descrição detalhada de como implementar",
      "tempo": "Quanto tempo ocupa na aula",
      "materiais": ["Material necessário 1", "Material 2"],
      "beneficios": ["Benefício pedagógico 1", "Benefício 2"],
      "comoImplementar": "Passo a passo de implementação"
    }
  ],
  "dicasProfessor": ["Dica prática 1 para o professor", "Dica 2", "Dica 3"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096, temperature: 0.8 },
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

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: "planning_improve", estimatedTokens });

    return res.status(200).json({
      ...result,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar sugestões: " + msg });
  }
}
