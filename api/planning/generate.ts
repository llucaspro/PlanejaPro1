import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { getDb, usersTable, aiUsageTable } from "../_lib/db";
import { verifyToken, extractBearerToken } from "../_lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `Você é um especialista em pedagogia e didática brasileira, com profundo conhecimento em:
- BNCC (Base Nacional Comum Curricular)
- Metodologias ativas (PBL, sala de aula invertida, aprendizagem por projetos)
- Educação inclusiva e adaptações curriculares
- Ensino Fundamental e Médio
- Avaliação formativa e somativa
- Elaboração de sequências didáticas

Gere planejamentos pedagógicos PRÁTICOS, DETALHADOS e APLICÁVEIS para professores brasileiros.
Responda SEMPRE em JSON válido, sem markdown, sem blocos de código, apenas JSON puro.`;

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
  if (!body?.disciplina || !body?.conteudo) {
    return res.status(400).json({ error: "Campos obrigatórios: disciplina, conteudo" });
  }

  const perfis = body.perfilTurma?.join(", ") || "não especificado";
  const recursos = body.recursosDisponiveis?.join(", ") || "quadro";

  const userPrompt = `Crie um planejamento pedagógico COMPLETO com:
- Disciplina: ${body.disciplina}
- Ano/Série: ${body.anoSerie}
- Turma: ${body.turma || "não especificada"}
- Quantidade de aulas: ${body.quantidadeAulas}
- Duração: ${body.duracaoAula} minutos
- Perfil da turma: ${perfis}
- Conteúdo: ${body.conteudo}
- Objetivos: ${body.objetivos || "desenvolver os conteúdos de forma eficaz"}
- Recursos: ${recursos}
- Observações: ${body.observacoes || "nenhuma"}

Retorne JSON com exatamente estas chaves (sem markdown, apenas JSON puro):
tema, objetivoGeral, objetivosEspecificos (array), competencias (array), habilidades (array), metodologia, sequenciaDidatica (array), atividadeInicial, desenvolvimento, atividadePratica, encerramento, avaliacao, criteriosAvaliativos (array), estrategiasInclusivas, adaptacoesDificuldades, recursosNecessarios (array), tarefaCasa, observacoesPedagogicas, versaoResumida, sugestoesExtras (array)`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.7 },
    });

    let content = response.text ?? "";
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    if (!content) return res.status(500).json({ error: "IA não retornou conteúdo" });

    const planning = JSON.parse(content);

    const arrayFields = ["objetivosEspecificos", "competencias", "habilidades", "sequenciaDidatica", "criteriosAvaliativos", "recursosNecessarios", "sugestoesExtras"];
    const stringFields = ["tema", "objetivoGeral", "metodologia", "atividadeInicial", "desenvolvimento", "atividadePratica", "encerramento", "avaliacao", "estrategiasInclusivas", "adaptacoesDificuldades", "tarefaCasa", "observacoesPedagogicas", "versaoResumida"];

    function anyToString(v: unknown): string {
      if (typeof v === "string") return v;
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return v.map(anyToString).join(" | ");
      if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k}: ${anyToString(val)}`).join(" | ");
      return String(v);
    }

    for (const field of arrayFields) {
      if (!Array.isArray(planning[field])) planning[field] = planning[field] ? [anyToString(planning[field])] : [];
      else planning[field] = (planning[field] as unknown[]).map(anyToString);
    }
    for (const field of stringFields) {
      if (typeof planning[field] !== "string") planning[field] = planning[field] != null ? anyToString(planning[field]) : "Não gerado";
    }

    const estimatedTokens = Math.round((SYSTEM_PROMPT.length + userPrompt.length + JSON.stringify(planning).length) / 4);

    if (!user.isPremium) {
      await db.update(usersTable)
        .set({ freeGenerationsRemaining: user.freeGenerationsRemaining - 1, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    await db.insert(aiUsageTable).values({
      userId: user.id,
      requestType: "planning_generate",
      estimatedTokens,
    });

    return res.status(200).json({
      ...planning,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar planejamento: " + msg });
  }
}
