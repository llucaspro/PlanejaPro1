import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Você é um assistente pedagógico especializado para professores brasileiros da Educação Básica.

Seus domínios: didática, metodologias ativas (PBL, sala de aula invertida, gamificação), educação inclusiva (TDAH, dislexia, TEA), avaliação formativa e somativa, BNCC.

Seja prático, use linguagem acessível, considere a realidade das escolas públicas.
Suas sugestões devem sempre ser revisadas e adaptadas pelo professor.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history = [], planningContext } = req.body ?? {};
  if (!message) return res.status(400).json({ error: "Campo 'message' obrigatório" });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (planningContext) {
    messages.push({ role: "system", content: `Contexto do planejamento atual:\n${planningContext}` });
  }

  for (const msg of (history as { role: string; content: string }[]).slice(-10)) {
    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }

  messages.push({ role: "user", content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: "IA não retornou resposta" });

    return res.status(200).json({ message: reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha no assistente: " + msg });
  }
}
