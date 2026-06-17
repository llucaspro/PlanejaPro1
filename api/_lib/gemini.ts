import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

function isOverloadedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("503") || msg.includes("overloaded") || msg.includes("unavailable") || msg.includes("high demand");
}

export async function generateWithFallback(
  prompt: string,
  config: object,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
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
      return response.text ?? "";
    } catch (err) {
      lastErr = err;
      if (!isOverloadedError(err)) throw err;
    }
  }
  throw lastErr;
}

export function isOverloadedError2(err: unknown): boolean {
  return isOverloadedError(err);
}
