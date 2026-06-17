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

/** Remove markdown fences, JS comments, trailing commas — makes Gemini JSON parseable */
function cleanJson(raw: string): string {
  let s = raw.trim();
  // strip ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // find first { and last }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  // remove single-line // comments (not inside strings)
  s = s.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (m, str) => str ?? "");
  // remove multi-line /* */ comments
  s = s.replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\//g, (m, str) => str ?? "");
  // remove trailing commas before ] or }
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
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

  const nAlt = Math.min(Math.max(Number(body.questoesAlternativas ?? 10), 0), 20);
  const nDisc = Math.min(Math.max(Number(body.questoesDiscursivas ?? 2), 0), 8);
  if (nAlt + nDisc === 0) return res.status(400).json({ error: "A prova deve ter ao menos uma questão." });

  const valorTotal = parseFloat(body.valorTotal ?? "10") || 10;
  const valorAlt = nAlt > 0 ? parseFloat((valorTotal * (nDisc > 0 ? 0.6 : 1) / nAlt).toFixed(2)) : 0;
  const valorDisc = nDisc > 0 ? parseFloat((valorTotal * (nAlt > 0 ? 0.4 : 1) / nDisc).toFixed(2)) : 0;

  const prompt = `Você é um professor especialista. Crie uma prova escolar em JSON puro (sem markdown, sem comentários).

Dados:
- Disciplina: ${body.disciplina}
- Ano/Série: ${body.anoSerie}
- Turma: ${body.turma ?? "não especificada"}
- Conteúdo: ${body.conteudo}
- Instruções especiais: ${body.instrucoes ?? "nenhuma"}
- Questões de múltipla escolha: ${nAlt} (${valorAlt} pts cada)
- Questões discursivas: ${nDisc} (${valorDisc} pts cada)

Responda SOMENTE com JSON válido neste formato exato (sem texto antes ou depois):
{"titulo":"...","instrucoes":"...","questoesAlternativas":[{"numero":1,"enunciado":"...","alternativas":{"a":"...","b":"...","c":"...","d":"...","e":"..."},"gabarito":"a","valor":${valorAlt}}],"questoesDiscursivas":[{"numero":${nAlt + 1},"enunciado":"...","linhasResposta":6,"valor":${valorDisc},"criterios":"..."}]}

IMPORTANTE: gere exatamente ${nAlt} questões de múltipla escolha e ${nDisc} discursivas. Arrays vazios se o número for 0. Apenas JSON puro.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.6 },
    });

    const raw = response.text ?? "";
    if (!raw.trim()) return res.status(500).json({ error: "IA não retornou conteúdo" });

    let exam: Record<string, unknown>;
    try {
      exam = JSON.parse(cleanJson(raw));
    } catch (parseErr) {
      return res.status(500).json({ error: "IA retornou JSON inválido. Tente novamente." });
    }

    if (!Array.isArray(exam.questoesAlternativas)) exam.questoesAlternativas = [];
    if (!Array.isArray(exam.questoesDiscursivas)) exam.questoesDiscursivas = [];
    if (typeof exam.titulo !== "string") exam.titulo = `Prova de ${body.disciplina}`;
    if (typeof exam.instrucoes !== "string") exam.instrucoes = "Leia atentamente cada questão antes de responder.";

    const estimatedTokens = Math.round((prompt.length + JSON.stringify(exam).length) / 4);

    if (!user.isPremium) {
      await db.update(usersTable)
        .set({ freeGenerationsRemaining: user.freeGenerationsRemaining - 1, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: "exam_generate", estimatedTokens });

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
