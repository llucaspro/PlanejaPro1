import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { AssistantChatBody } from "@workspace/api-zod";

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const ASSISTANT_SYSTEM_PROMPT = `Você é um assistente pedagógico especializado para professores brasileiros da Educação Básica.

Seus domínios de especialidade:
- Didática e pedagogia
- Metodologias ativas (PBL, sala de aula invertida, gamificação, aprendizagem colaborativa)
- Educação inclusiva (TDAH, dislexia, TEA, altas habilidades, deficiências)
- Ensino Fundamental I e II
- Ensino Médio
- Avaliação (diagnóstica, formativa, somativa, por competências)
- Elaboração de atividades, exercícios e projetos
- BNCC e currículo
- Gestão de sala de aula
- Diferenciação pedagógica

Como se comportar:
- Responda como um colega experiente, não como um chatbot corporativo
- Seja prático: dê exemplos concretos, passo a passo quando necessário
- Use linguagem acessível, adequada para professores
- Quando sugerir adaptações, explique o raciocínio por trás
- Se não tiver certeza sobre algo específico, diga isso claramente
- Considere a realidade das escolas públicas brasileiras: turmas grandes, recursos limitados
- Seja encorajador, reconheça os desafios reais da profissão docente

IMPORTANTE: Você é um copiloto pedagógico. Suas sugestões devem sempre ser revisadas e adaptadas pelo professor à sua realidade específica.`;

router.post("/assistant/chat", async (req, res) => {
  const parsed = AssistantChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos: " + parsed.error.message });
    return;
  }

  const { message, history = [], planningContext } = parsed.data;

  const systemInstruction = planningContext
    ? `${ASSISTANT_SYSTEM_PROMPT}\n\nContexto do planejamento atual do professor:\n${planningContext}`
    : ASSISTANT_SYSTEM_PROMPT;

  const contents = [];

  for (const msg of history.slice(-10)) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 8192,
        temperature: 0.8,
      },
    });

    const reply = response.text ?? "";
    if (!reply.trim()) {
      res.status(500).json({ error: "A IA não retornou resposta" });
      return;
    }

    res.json({ message: reply });
  } catch (err: unknown) {
    req.log.error({ err }, "Erro no assistente pedagógico");
    const message_err = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: "Falha no assistente: " + message_err });
  }
});

export default router;
