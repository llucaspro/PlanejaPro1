import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.error("[gemini] GEMINI_API_KEY não está configurada!");
}

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("too many requests") ||
    msg.includes("service unavailable")
  );
}

export async function generateWithFallback(
  prompt: string,
  config: object,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada no servidor.");
  }

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const contents = history
        ? [...history, { role: "user", parts: [{ text: prompt }] }]
        : [{ role: "user", parts: [{ text: prompt }] }];

      const response = await ai.models.generateContent({
        model,
        contents,
        config: systemInstruction ? { ...config, systemInstruction } : config,
      });

      let text: string;
      try {
        text = response.text ?? "";
      } catch {
        text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      }

      if (text) return text;

      console.warn(`[gemini] Modelo ${model} retornou texto vazio, tentando próximo.`);
      lastErr = new Error(`Modelo ${model} retornou resposta vazia`);
    } catch (err) {
      console.error(`[gemini] Erro no modelo ${model}:`, err instanceof Error ? err.message : err);
      lastErr = err;
    }
  }
  throw lastErr;
}

export function isOverloadedError2(err: unknown): boolean {
  return isRetryableError(err);
}
