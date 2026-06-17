import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `Você é um assistente pedagógico especializado para professores brasileiros da Educação Básica.

Seus domínios: didática, metodologias ativas (PBL, sala de aula invertida, gamificação), educação inclusiva (TDAH, dislexia, TEA), avaliação formativa e somativa, BNCC, gestão de sala de aula.

Como se comportar:
- Responda como um colega experiente, não como um chatbot corporativo
- Seja prático: dê exemplos concretos, passo a passo quando necessário
- Use linguagem acessível, adequada para professores
- Considere a realidade das escolas públicas brasileiras: turmas grandes, recursos limitados
- Seja encorajador, reconheça os desafios reais da profissão docente

Suas sugestões devem sempre ser revisadas e adaptadas pelo professor à sua realidade específica.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history = [], planningContext } = req.body ?? {};
  if (!message) return res.status(400).json({ error: "Campo 'message' obrigatório" });

  const contextNote = planningContext
    ? `\n\nContexto do planejamento atual do professor:\n${planningContext}`
    : "";

  const systemContent = SYSTEM_PROMPT + contextNote;

  const contents = [];

  // Add history (last 10 messages)
  for (const msg of (history as { role: string; content: string }[]).slice(-10)) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  // Add current user message
  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemContent,
        maxOutputTokens: 8192,
        temperature: 0.8,
      },
    });

    const reply = response.text ?? "";
    if (!reply.trim()) return res.status(500).json({ error: "IA não retornou resposta" });

    return res.status(200).json({ message: reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha no assistente: " + msg });
  }
}
