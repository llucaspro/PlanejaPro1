import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, usersTable } from "../_lib/db";
import { verifyToken, extractBearerToken } from "../_lib/auth";
import { generateWithFallback, isOverloadedError2 } from "../_lib/gemini";

const SYSTEM_PROMPT = `Você é um assistente pedagógico especializado para professores brasileiros da Educação Básica.

Seus domínios: didática, metodologias ativas (PBL, sala de aula invertida, gamificação), educação inclusiva (TDAH, dislexia, TEA), avaliação formativa e somativa, BNCC, gestão de sala de aula.

Como se comportar:
- Responda como um colega experiente, não como um chatbot corporativo
- Seja prático: dê exemplos concretos, passo a passo quando necessário
- Use linguagem acessível, adequada para professores
- Considere a realidade das escolas públicas brasileiras: turmas grandes, recursos limitados
- Seja encorajador, reconheça os desafios reais da profissão docente

Suas sugestões devem sempre ser revisadas e adaptadas pelo professor à sua realidade específica.`;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;

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
  if (!user.isPremium) return res.status(403).json({ error: "Recurso disponível apenas para usuários Premium." });

  const { message, history = [], planningContext } = req.body ?? {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Campo 'message' obrigatório" });
  }

  const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmedMessage) return res.status(400).json({ error: "Mensagem não pode ser vazia" });

  const contextNote = planningContext
    ? `\n\nContexto do planejamento atual do professor:\n${String(planningContext).slice(0, 500)}`
    : "";

  const systemContent = SYSTEM_PROMPT + contextNote;

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((msg): msg is { role: string; content: string } =>
      msg && typeof msg === "object" && typeof msg.role === "string" && typeof msg.content === "string"
    );

  const historyContents = safeHistory.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content.slice(0, 1000) }],
  }));

  try {
    const reply = await generateWithFallback(
      trimmedMessage,
      { maxOutputTokens: 4096, temperature: 0.8 },
      systemContent,
      historyContents,
    );

    if (!reply.trim()) return res.status(500).json({ error: "IA não retornou resposta" });

    return res.status(200).json({ message: reply });
  } catch (err) {
    const isOverloaded = isOverloadedError2(err);
    const status = isOverloaded ? 503 : 500;
    const message = isOverloaded
      ? "O serviço de IA está com alta demanda. Aguarde alguns segundos e tente novamente."
      : "Falha no assistente. Tente novamente.";
    return res.status(status).json({ error: message });
  }
}
