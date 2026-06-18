// Rodízio automático de IAs gratuitas
// Ordem: Gemini → Groq → NVIDIA/DeepSeek → Mistral → OpenRouter

interface GeminiContent { role: string; parts: Array<{ text: string }> }
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
      msgs.push({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts.map(p => p.text).join('') });
    }
  }
  msgs.push({ role: 'user', content: prompt });
  return msgs;
}

function isQuotaErr(status: number, body: string): boolean {
  const low = body.toLowerCase();
  return status === 429 || low.includes('quota') || low.includes('rate limit') || low.includes('exceeded') || low.includes('too many');
}

// Safe JSON parser — handles SSE/streaming responses gracefully
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  // NVIDIA and some APIs may return SSE lines: "data: {...}"
  const cleaned = text.startsWith('data:') ? text.replace(/^data:s*/m, '').split('
')[0] : text;
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Return a fake error object so callers can handle gracefully
    return { error: { message: 'Resposta inválida do servidor: ' + text.slice(0, 80), code: res.status } };
  }
}

async function callOpenAI(
  url: string,
  authHeader: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  extraHeaders?: Record<string, string>,
  extraBody?: Record<string, unknown>,
): Promise<string | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, ...extraHeaders },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: false, ...extraBody }),
  });
  const json = await safeJson(res);
  const bodyStr = JSON.stringify(json);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('AUTH_ERROR:' + model);
    if (isQuotaErr(res.status, bodyStr)) return null; // signal: try next provider
    console.error('[ai] ' + model + ' (' + res.status + '):', bodyStr.slice(0, 120));
    return null;
  }

  const text = (json as any)?.choices?.[0]?.message?.content ?? '';
  return text || null;
}

// ─── Gemini ─────────────────────────────────────────────────────
const GEMINI_MODELS = [
  ['v1beta', 'gemini-2.5-flash'],
  ['v1beta', 'gemini-2.5-flash-lite'],
  ['v1beta', 'gemini-2.0-flash-lite'],
] as const;

async function tryGemini(
  prompt: string,
  config: Record<string, unknown>,
  sys?: string,
  hist?: Array<GeminiContent>,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const contents = hist
    ? [...hist, { role: 'user', parts: [{ text: prompt }] }]
    : [{ role: 'user', parts: [{ text: prompt }] }];
  const body: Record<string, unknown> = { contents, generationConfig: config };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };

  for (const [ver, model] of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      const json = await res.json() as Record<string, unknown>;
      const raw = JSON.stringify(json);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return null;
        if (isQuotaErr(res.status, raw)) { console.warn('[gemini] cota: ' + model); continue; }
        continue;
      }
      const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) { console.log('[AI] Gemini/' + model + ' ✓'); return text; }
    } catch (e) { console.error('[gemini] rede:', (e as Error).message); }
  }
  return null;
}

// ─── Groq ────────────────────────────────────────────────────────
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'gemma2-9b-it'];
async function tryGroq(
  prompt: string, config: Record<string, unknown>, sys?: string, hist?: Array<GeminiContent>,
): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const msgs = toOpenAIMessages(prompt, sys, hist as any);
  const max = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048;
  for (const model of GROQ_MODELS) {
    try {
      const text = await callOpenAI('https://api.groq.com/openai/v1/chat/completions', 'Bearer ' + key, model, msgs, max);
      if (text) { console.log('[AI] Groq/' + model + ' ✓'); return text; }
    } catch (e) { if ((e as Error).message.startsWith('AUTH_ERROR')) return null; }
  }
  return null;
}

// ─── NVIDIA NIM / DeepSeek ───────────────────────────────────────
// stream:false is critical — NVIDIA returns SSE by default which breaks JSON.parse
const NVIDIA_MODELS = [
  'deepseek-ai/deepseek-r1',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
];
async function tryNvidia(
  prompt: string, config: Record<string, unknown>, sys?: string, hist?: Array<GeminiContent>,
): Promise<string | null> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return null;
  const msgs = toOpenAIMessages(prompt, sys, hist as any);
  const max = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048;
  for (const model of NVIDIA_MODELS) {
    try {
      // stream:false passed via extraBody to ensure non-streaming JSON response
      const text = await callOpenAI(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        'Bearer ' + key, model, msgs, max,
        {}, // no extra headers
        { stream: false }, // force non-streaming
      );
      if (text) { console.log('[AI] NVIDIA/' + model + ' ✓'); return text; }
    } catch (e) { if ((e as Error).message.startsWith('AUTH_ERROR')) return null; }
  }
  return null;
}

// ─── Mistral ─────────────────────────────────────────────────────
const MISTRAL_MODELS = ['mistral-small-latest', 'open-mistral-7b', 'open-mixtral-8x7b'];
async function tryMistral(
  prompt: string, config: Record<string, unknown>, sys?: string, hist?: Array<GeminiContent>,
): Promise<string | null> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return null;
  const msgs = toOpenAIMessages(prompt, sys, hist as any);
  const max = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048;
  for (const model of MISTRAL_MODELS) {
    try {
      const text = await callOpenAI('https://api.mistral.ai/v1/chat/completions', 'Bearer ' + key, model, msgs, max);
      if (text) { console.log('[AI] Mistral/' + model + ' ✓'); return text; }
    } catch (e) { if ((e as Error).message.startsWith('AUTH_ERROR')) return null; }
  }
  return null;
}

// ─── OpenRouter ──────────────────────────────────────────────────
const OR_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];
async function tryOpenRouter(
  prompt: string, config: Record<string, unknown>, sys?: string, hist?: Array<GeminiContent>,
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const msgs = toOpenAIMessages(prompt, sys, hist as any);
  const max = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048;
  for (const model of OR_MODELS) {
    try {
      const text = await callOpenAI(
        'https://openrouter.ai/api/v1/chat/completions', 'Bearer ' + key, model, msgs, max,
        { 'HTTP-Referer': 'https://planejasp.vercel.app', 'X-Title': 'PlanejaPro' },
      );
      if (text) { console.log('[AI] OpenRouter/' + model + ' ✓'); return text; }
    } catch (e) { if ((e as Error).message.startsWith('AUTH_ERROR')) return null; }
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
  const result =
    (await tryGemini(prompt, config, systemInstruction, history as any)) ??
    (await tryGroq(prompt, config, systemInstruction, history as any)) ??
    (await tryNvidia(prompt, config, systemInstruction, history as any)) ??
    (await tryMistral(prompt, config, systemInstruction, history as any)) ??
    (await tryOpenRouter(prompt, config, systemInstruction, history as any));

  if (result) return result;
  throw new Error('QUOTA_EXCEEDED: Todos os provedores de IA estão indisponíveis no momento. Tente novamente em alguns instantes.');
}

export function isOverloadedError2(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('quota') || msg.includes('503') || msg.includes('overloaded') ||
    msg.includes('429') || msg.includes('rate limit') || msg.includes('resource_exhausted') ||
    msg.includes('too many requests') || msg.includes('service unavailable')
  );
}
