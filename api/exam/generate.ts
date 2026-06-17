import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, usersTable, aiUsageTable } from "../_lib/db";
import { verifyToken, extractBearerToken } from "../_lib/auth";
import { generateWithFallback, isOverloadedError2 } from "../_lib/gemini";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function cleanJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  s = s.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (m, str) => str ?? "");
  s = s.replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\//g, (m, str) => str ?? "");
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

function sanitize(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
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

  const disciplina = sanitize(body.disciplina, 100);
  const conteudo = sanitize(body.conteudo, 800);
  const anoSerie = sanitize(body.anoSerie, 50);
  const turma = sanitize(body.turma, 50);
  const instrucoes = sanitize(body.instrucoes, 400);

  const nAlt = Math.min(Math.max(Number(body.questoesAlternativas ?? 10), 0), 20);
  const nDisc = Math.min(Math.max(Number(body.questoesDiscursivas ?? 2), 0), 8);
  if (nAlt + nDisc === 0) return res.status(400).json({ error: "A prova deve ter ao menos uma questão." });

  const valorTotal = Math.min(Math.max(parseFloat(body.valorTotal ?? "10") || 10, 1), 100);
  const valorAlt = nAlt > 0 ? parseFloat((valorTotal * (nDisc > 0 ? 0.6 : 1) / nAlt).toFixed(2)) : 0;
  const valorDisc = nDisc > 0 ? parseFloat((valorTotal * (nAlt > 0 ? 0.4 : 1) / nDisc).toFixed(2)) : 0;

  const dificuldade: string = ["facil", "medio", "dificil"].includes(body.dificuldade) ? body.dificuldade : "medio";

  const dificuldadeInstrucoes: Record<string, string> = {
    facil: `Dificuldade selecionada pelo professor: Fácil.
Crie questões voltadas para fixação, revisão e recuperação. Use linguagem simples, baixo nível de abstração, questões diretas e com menor necessidade de interpretação. Evite contextos complexos.`,
    medio: `Dificuldade selecionada pelo professor: Médio.
Crie questões semelhantes às utilizadas em avaliações escolares tradicionais. Exija compreensão do conteúdo, aplicação básica do conhecimento e interpretação moderada.`,
    dificil: `Dificuldade selecionada pelo professor: Difícil. Utilize padrão semelhante ao encontrado em vestibulares e exames seletivos (ETEC, ENEM, FUVEST, UNESP, UNICAMP, VUNESP, IFSP).
As questões DEVEM exigir: alta interpretação, raciocínio crítico, contextualização, aplicação de conceitos em situações-problema. As questões difíceis NÃO devem ser apenas perguntas decoradas — devem exigir pensamento.`,
  };

  const instrucaoDificuldade = dificuldadeInstrucoes[dificuldade];

  const prompt = `Você é um professor especialista. Crie uma prova escolar em JSON puro (sem markdown, sem comentários).

Dados:
- Disciplina: ${disciplina}
- Ano/Série: ${anoSerie}
- Turma: ${turma || "não especificada"}
- Conteúdo: ${conteudo}
- Instruções especiais: ${instrucoes || "nenhuma"}
- Questões de múltipla escolha: ${nAlt} (${valorAlt} pts cada)
- Questões discursivas: ${nDisc} (${valorDisc} pts cada)

${instrucaoDificuldade}

Responda SOMENTE com JSON válido neste formato exato (sem texto antes ou depois):
{"titulo":"...","instrucoes":"...","questoesAlternativas":[{"numero":1,"enunciado":"...","alternativas":{"a":"...","b":"...","c":"...","d":"...","e":"..."},"gabarito":"a","valor":${valorAlt}}],"questoesDiscursivas":[{"numero":${nAlt + 1},"enunciado":"...","linhasResposta":6,"valor":${valorDisc},"criterios":"..."}]}

IMPORTANTE: gere exatamente ${nAlt} questões de múltipla escolha e ${nDisc} discursivas. Arrays vazios se o número for 0. Apenas JSON puro.`;

  try {
    const raw = await generateWithFallback(prompt, { maxOutputTokens: 8192, temperature: 0.6 });

    if (!raw.trim()) return res.status(500).json({ error: "IA não retornou conteúdo" });

    let exam: Record<string, unknown>;
    try {
      exam = JSON.parse(cleanJson(raw)) as Record<string, unknown>;
    } catch {
      return res.status(500).json({ error: "IA retornou JSON inválido. Tente novamente." });
    }

    if (!Array.isArray(exam.questoesAlternativas)) exam.questoesAlternativas = [];
    if (!Array.isArray(exam.questoesDiscursivas)) exam.questoesDiscursivas = [];
    if (typeof exam.titulo !== "string") exam.titulo = `Prova de ${disciplina}`;
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
      dificuldade,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const isOverloaded = isOverloadedError2(err);
    const status = isOverloaded ? 503 : 500;
    const message = isOverloaded
      ? "O serviço de IA está com alta demanda. Aguarde alguns segundos e tente novamente."
      : "Falha ao gerar prova. Tente novamente.";
    return res.status(status).json({ error: message });
  }
}
