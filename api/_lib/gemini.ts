// Direct HTTP calls to Gemini REST API — sem dependência do SDK @google/genai

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

interface GeminiPart { text: string }
interface GeminiContent { role: string; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
  error?: { code: number; message: string; status: string };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502;
}

export async function generateWithFallback(
  prompt: string,
  config: Record<string, unknown>,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no servidor.');

  const contents: GeminiContent[] = history
    ? [...history as GeminiContent[], { role: 'user', parts: [{ text: prompt }] }]
    : [{ role: 'user', parts: [{ text: prompt }] }];

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: config,
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  let lastErr: Error = new Error('Nenhum modelo disponível');

  for (const model of MODELS) {
    try {
      const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const json = await res.json() as GeminiResponse;

      if (!res.ok) {
        const errMsg = json.error?.message ?? `HTTP ${res.status}`;
        console.error(`[gemini] Modelo ${model} falhou (${res.status}): ${errMsg}`);
        if (isRetryableStatus(res.status)) {
          lastErr = new Error(errMsg);
          continue;
        }
        lastErr = new Error(errMsg);
        continue;
      }

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        const reason = json.candidates?.[0]?.finishReason ?? 'unknown';
        console.warn(`[gemini] Modelo ${model} retornou texto vazio (finishReason: ${reason})`);
        lastErr = new Error(`Modelo ${model} sem conteúdo: ${reason}`);
        continue;
      }

      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[gemini] Erro de rede no modelo ${model}: ${msg}`);
      lastErr = err instanceof Error ? err : new Error(msg);
    }
  }

  throw lastErr;
}

export function isOverloadedError2(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('service unavailable')
  );
}
