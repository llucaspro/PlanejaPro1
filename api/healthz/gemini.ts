import type { VercelRequest, VercelResponse } from '@vercel/node';

const TEST_PROMPT = 'Responda apenas: OK';
const TEST_CONFIG = { maxOutputTokens: 10 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const result: Record<string, unknown> = {
    providers: {
      gemini:      { configured: !!process.env.GEMINI_API_KEY,      status: 'not tested' },
      groq:        { configured: !!process.env.GROQ_API_KEY,        status: 'not tested' },
      openrouter:  { configured: !!process.env.OPENROUTER_API_KEY,  status: 'not tested' },
    },
    hasDb: !!process.env.DATABASE_URL,
  };

  const providers = result.providers as Record<string, Record<string,unknown>>;

  // --- Gemini ---
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{role:'user',parts:[{text:TEST_PROMPT}]}], generationConfig:TEST_CONFIG }) }
      );
      const j = await r.json() as Record<string,unknown>;
      if (r.ok) {
        providers.gemini.status = '✅ OK — ' + ((j as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '?');
      } else {
        const msg = (j as any)?.error?.message ?? JSON.stringify(j).slice(0,120);
        providers.gemini.status = (r.status === 429 || msg.toLowerCase().includes('quota'))
          ? '⚠️ cota esgotada — ' + msg.slice(0,80)
          : '❌ ' + r.status + ' — ' + msg.slice(0,80);
      }
    } catch(e) { providers.gemini.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
  }

  // --- Groq ---
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+groqKey },
        body: JSON.stringify({ model:'llama-3.3-70b-versatile', messages:[{role:'user',content:TEST_PROMPT}], max_tokens:10 }),
      });
      const j = await r.json() as Record<string,unknown>;
      if (r.ok) {
        providers.groq.status = '✅ OK — ' + ((j as any)?.choices?.[0]?.message?.content ?? '?');
      } else {
        const msg = (j as any)?.error?.message ?? JSON.stringify(j).slice(0,120);
        providers.groq.status = (r.status === 429 || msg.toLowerCase().includes('quota'))
          ? '⚠️ cota esgotada — ' + msg.slice(0,80)
          : '❌ ' + r.status + ' — ' + msg.slice(0,80);
      }
    } catch(e) { providers.groq.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
  }

  // --- OpenRouter ---
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers: { 'Content-Type':'application/json','Authorization':'Bearer '+orKey,'HTTP-Referer':'https://planejasp.vercel.app','X-Title':'PlanejaPro' },
        body: JSON.stringify({ model:'meta-llama/llama-3.3-70b-instruct:free', messages:[{role:'user',content:TEST_PROMPT}], max_tokens:10 }),
      });
      const j = await r.json() as Record<string,unknown>;
      if (r.ok) {
        providers.openrouter.status = '✅ OK — ' + ((j as any)?.choices?.[0]?.message?.content ?? '?');
      } else {
        const msg = (j as any)?.error?.message ?? JSON.stringify(j).slice(0,120);
        providers.openrouter.status = (r.status === 429 || msg.toLowerCase().includes('quota'))
          ? '⚠️ cota esgotada — ' + msg.slice(0,80)
          : '❌ ' + r.status + ' — ' + msg.slice(0,80);
      }
    } catch(e) { providers.openrouter.status = '❌ erro: ' + (e instanceof Error ? e.message : String(e)); }
  }

  return res.status(200).json(result);
}
