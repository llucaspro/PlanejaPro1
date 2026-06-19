import type { VercelRequest, VercelResponse } from '@vercel/node';

const PROMPT = 'Responda apenas: OK';

async function testOpenAI(url: string, key: string, model: string, extraHeaders?: Record<string,string>): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, ...extraHeaders },
    // stream: false is critical for NVIDIA — without it the response is SSE, not JSON
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 10, stream: false }),
  });

  let j: Record<string, unknown>;
  try {
    j = await res.json() as Record<string, unknown>;
  } catch {
    const text = await res.text().catch(() => '');
    return '❌ resposta não-JSON: ' + text.slice(0, 80);
  }

  // OpenRouter (and some others) return 200 but embed errors in the body
  const embeddedErr = (j as any)?.error;
  if (embeddedErr) {
    const msg = String(embeddedErr?.message ?? JSON.stringify(embeddedErr)).slice(0, 120);
    const code = Number(embeddedErr?.code ?? 0);
    const low = msg.toLowerCase();
    if (code === 429 || low.includes('quota') || low.includes('rate limit') || low.includes('exceeded'))
      return '⚠️ cota esgotada — ' + msg;
    if (low.includes('provider'))
      return '⚠️ provedor temporariamente indisponível — ' + msg;
    return '❌ erro: ' + msg;
  }

  if (res.ok) return '✅ OK — ' + (((j as any)?.choices?.[0]?.message?.content) ?? '?');

  const msg = String((j as any)?.error?.message ?? JSON.stringify(j)).slice(0, 100);
  if (res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate'))
    return '⚠️ cota esgotada — ' + msg;
  return '❌ ' + res.status + ' — ' + msg;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keys = {
    gemini:     process.env.GEMINI_API_KEY,
    groq:       process.env.GROQ_API_KEY,
    nvidia:     process.env.NVIDIA_API_KEY,
    mistral:    process.env.MISTRAL_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };

  const providers: Record<string, { configured: boolean; status: string }> = {
    gemini:     { configured: !!keys.gemini,     status: 'not tested' },
    groq:       { configured: !!keys.groq,       status: 'not tested' },
    nvidia:     { configured: !!keys.nvidia,     status: 'not tested' },
    mistral:    { configured: !!keys.mistral,    status: 'not tested' },
    openrouter: { configured: !!keys.openrouter, status: 'not tested' },
  };

  await Promise.all([
    // Gemini (native API, not OpenAI-compatible)
    keys.gemini ? (async () => {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.gemini}`,
          { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ contents:[{role:'user',parts:[{text:PROMPT}]}], generationConfig:{maxOutputTokens:10} }) }
        );
        const j = await r.json() as Record<string,unknown>;
        if (r.ok) { providers.gemini.status = '✅ OK — ' + ((j as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '?'); }
        else {
          const msg = String((j as any)?.error?.message ?? JSON.stringify(j)).slice(0,100);
          providers.gemini.status = (r.status===429||msg.includes('quota')) ? '⚠️ cota esgotada — ' + msg : '❌ ' + r.status + ' — ' + msg;
        }
      } catch(e) { providers.gemini.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // Groq
    keys.groq ? (async () => {
      try { providers.groq.status = await testOpenAI('https://api.groq.com/openai/v1/chat/completions', keys.groq!, 'llama-3.3-70b-versatile'); }
      catch(e) { providers.groq.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // NVIDIA / DeepSeek — stream:false sent in body via testOpenAI
    keys.nvidia ? (async () => {
      try { providers.nvidia.status = await testOpenAI('https://integrate.api.nvidia.com/v1/chat/completions', keys.nvidia!, 'deepseek-ai/deepseek-r1'); }
      catch(e) { providers.nvidia.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // Mistral
    keys.mistral ? (async () => {
      try { providers.mistral.status = await testOpenAI('https://api.mistral.ai/v1/chat/completions', keys.mistral!, 'mistral-small-latest'); }
      catch(e) { providers.mistral.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // OpenRouter — try a fast free model
    keys.openrouter ? (async () => {
      try {
        providers.openrouter.status = await testOpenAI(
          'https://openrouter.ai/api/v1/chat/completions', keys.openrouter!,
          'mistralai/mistral-7b-instruct:free',
          {'HTTP-Referer':'https://planejasp.vercel.app','X-Title':'PlanejaPro'}
        );
      } catch(e) { providers.openrouter.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),
  ]);

  return res.status(200).json({ providers, hasDb: !!process.env.DATABASE_URL });
}
