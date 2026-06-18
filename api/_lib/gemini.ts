// Rodízio automático de IAs gratuitas
// Ordem: Gemini → Groq → OpenRouter
// Cada provider é ignorado se sua env var não estiver configurada.
// Quando um esgota a cota, passa automaticamente para o próximo.

interface GeminiPart { text: string }
interface GeminiContent { role: string; parts: GeminiPart[] }

// ─── tipos internos ──────────────────────────────────────────────
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function toOpenAIMessages(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  if (systemInstruction) msgs.push({ role: 'system', content: systemInstruction });
  if (history) {
    for (const h of history) {
      const role = h.role === 'model' ? 'assistant' : 'user';
      msgs.push({ role, content: h.parts.map(p => p.text).join('') });
    }
  }
  msgs.push({ role: 'user', content: prompt });
  return msgs;
}

function isQuotaError(status: number, body: string): boolean {
  return status === 429 || body.toLowerCase().includes('quota') || body.toLowerCase().includes('rate limit') || body.toLowerCase().includes('exceeded');
}

// ─── Provider: Google Gemini ─────────────────────────────────────
const GEMINI_MODELS = [
  ['v1beta', 'gemini-2.5-flash'],
  ['v1beta', 'gemini-2.5-flash-lite'],
  ['v1beta', 'gemini-2.0-flash-lite'],
] as const;

async function tryGemini(
  prompt: string,
  config: Record<string, unknown>,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const contents: GeminiContent[] = history
    ? [...history as GeminiContent[], { role: 'user', parts: [{ text: prompt }] }]
    : [{ role: 'user', parts: [{ text: prompt }] }];

  const requestBody: Record<string, unknown> = { contents, generationConfig: config };
  if (systemInstruction) requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };

  for (const [ver, model] of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) },
      );
      const json = await res.json() as Record<string, unknown>;
      const body = JSON.stringify(json);

      if (!res.ok) {
        console.error(`[gemini] ${model} (${res.status})`);
        if (isQuotaError(res.status, body)) { console.warn('[gemini] cota esgotada, tentando próximo modelo'); continue; }
        if (res.status === 401 || res.status === 403) return null; // chave inválida, pula provider
        continue;
      }

      const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) { console.log(`[AI] Gemini/${model} ✓`); return text; }
    } catch (e) {
      console.error('[gemini] erro de rede:', e instanceof Error ? e.message : e);
    }
  }
  return null; // todos os modelos Gemini falharam
}

// ─── Provider: Groq (free tier: 14400 req/dia) ──────────────────
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'gemma2-9b-it',
];

async function tryGroq(
  prompt: string,
  config: Record<string, unknown>,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const messages = toOpenAIMessages(prompt, systemInstruction, history);
  const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      });
      const json = await res.json() as Record<string, unknown>;
      const body = JSON.stringify(json);

      if (!res.ok) {
        console.error(`[groq] ${model} (${res.status})`);
        if (isQuotaError(res.status, body)) { console.warn('[groq] cota esgotada, tentando próximo modelo'); continue; }
        if (res.status === 401) return null;
        continue;
      }

      const text = (json as any)?.choices?.[0]?.message?.content ?? '';
      if (text) { console.log(`[AI] Groq/${model} ✓`); return text; }
    } catch (e) {
      console.error('[groq] erro de rede:', e instanceof Error ? e.message : e);
    }
  }
  return null;
}

// ─── Provider: OpenRouter (modelos :free) ───────────────────────
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

async function tryOpenRouter(
  prompt: string,
  config: Record<string, unknown>,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const messages = toOpenAIMessages(prompt, systemInstruction, history);
  const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048;

  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://planejasp.vercel.app',
          'X-Title': 'PlanejaPro',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      });
      const json = await res.json() as Record<string, unknown>;
      const body = JSON.stringify(json);

      if (!res.ok) {
        console.error(`[openrouter] ${model} (${res.status})`);
        if (isQuotaError(res.status, body)) { console.warn('[openrouter] cota esgotada, tentando próximo'); continue; }
        if (res.status === 401) return null;
        continue;
      }

      const text = (json as any)?.choices?.[0]?.message?.content ?? '';
      if (text) { console.log(`[AI] OpenRouter/${model} ✓`); return text; }
    } catch (e) {
      console.error('[openrouter] erro de rede:', e instanceof Error ? e.message : e);
    }
  }
  return null;
}

// ─── Rodízio principal ───────────────────────────────────────────
export async function generateWithFallback(
  prompt: string,
  config: Record<string, unknown>,
  systemInstruction?: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  // Ordem de prioridade: Gemini → Groq → OpenRouter
  const result =
    (await tryGemini(prompt, config, systemInstruction, history)) ??
    (await tryGroq(prompt, config, systemInstruction, history)) ??
    (await tryOpenRouter(prompt, config, systemInstruction, history));

  if (result) return result;

  throw new Error(
    'QUOTA_EXCEEDED: Todos os provedores de IA estão com cota esgotada. Configure GROQ_API_KEY e/ou OPENROUTER_API_KEY na Vercel para mais capacidade.',
  );
}

export function isOverloadedError2(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('quota_exceeded') ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('service unavailable')
  );
}
