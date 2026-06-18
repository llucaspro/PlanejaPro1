import type { VercelRequest, VercelResponse } from '@vercel/node';

const PROMPT = 'Responda apenas: OK';

async function testOpenAI(url: string, key: string, model: string, extraHeaders?: Record<string,string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, ...extraHeaders },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 10 }),
  });
  const j = await res.json() as Record<string, unknown>;
  if (res.ok) return '✅ OK — ' + ((j as any)?.choices?.[0]?.message?.content ?? '?');
  const msg = ((j as any)?.error?.message ?? JSON.stringify(j)).slice(0, 100);
  if (res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) return '⚠️ cota esgotada — ' + msg;
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

  // Test each provider concurrently
  await Promise.all([
    // Gemini
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
          const msg = ((j as any)?.error?.message ?? JSON.stringify(j)).slice(0,100);
          providers.gemini.status = (r.status===429||msg.includes('quota')) ? '⚠️ cota esgotada — ' + msg : '❌ ' + r.status + ' — ' + msg;
        }
      } catch(e) { providers.gemini.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // Groq
    keys.groq ? (async () => {
      try { providers.groq.status = await testOpenAI('https://api.groq.com/openai/v1/chat/completions', keys.groq!, 'llama-3.3-70b-versatile'); }
      catch(e) { providers.groq.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // NVIDIA / DeepSeek
    keys.nvidia ? (async () => {
      try { providers.nvidia.status = await testOpenAI('https://integrate.api.nvidia.com/v1/chat/completions', keys.nvidia!, 'deepseek-ai/deepseek-r1'); }
      catch(e) { providers.nvidia.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // Mistral
    keys.mistral ? (async () => {
      try { providers.mistral.status = await testOpenAI('https://api.mistral.ai/v1/chat/completions', keys.mistral!, 'mistral-small-latest'); }
      catch(e) { providers.mistral.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),

    // OpenRouter
    keys.openrouter ? (async () => {
      try { providers.openrouter.status = await testOpenAI('https://openrouter.ai/api/v1/chat/completions', keys.openrouter!, 'meta-llama/llama-3.3-70b-instruct:free', {'HTTP-Referer':'https://planejasp.vercel.app','X-Title':'PlanejaPro'}); }
      catch(e) { providers.openrouter.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
    })() : Promise.resolve(),
  ]);

  return res.status(200).json({ providers, hasDb: !!process.env.DATABASE_URL });
}
