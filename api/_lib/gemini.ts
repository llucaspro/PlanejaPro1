// Direct HTTP calls to Gemini REST API — tries v1beta (new models) then v1 (stable models)

interface GeminiPart { text: string }
interface GeminiContent { role: string; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
  error?: { code: number; message: string; status: string };
}

// Each entry: [apiVersion, modelName]
const MODEL_ATTEMPTS: Array<[string, string]> = [
  ['v1beta', 'gemini-2.5-flash'],
  ['v1beta', 'gemini-2.0-flash'],
  ['v1',     'gemini-1.5-flash'],
  ['v1beta', 'gemini-1.5-flash'],
  ['v1',     'gemini-1.5-flash-8b'],
];

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

  for (const [apiVersion, model] of MODEL_ATTEMPTS) {
    try {
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const json = await res.json() as GeminiResponse;

      if (!res.ok) {
        const errMsg = json.error?.message ?? `HTTP ${res.status}`;
        console.error(`[gemini] ${apiVersion}/${model} falhou (${res.status}): ${errMsg}`);
        if (isRetryableStatus(res.status)) {
          lastErr = new Error(errMsg);
          continue;
        }
        // Model not found → try next; auth error → stop all
        if (res.status === 403 || res.status === 401) {
          throw new Error('Chave Gemini inválida ou sem permissão: ' + errMsg);
        }
        lastErr = new Error(errMsg);
        continue;
      }

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        const reason = json.candidates?.[0]?.finishReason ?? 'unknown';
        console.warn(`[gemini] ${apiVersion}/${model} sem texto (finishReason: ${reason})`);
        lastErr = new Error(`Modelo sem conteúdo: ${reason}`);
        continue;
      }

      console.log(`[gemini] Sucesso com ${apiVersion}/${model}`);
      return text;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Chave Gemini')) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[gemini] Erro de rede ${apiVersion}/${model}: ${msg}`);
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
