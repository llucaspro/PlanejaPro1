import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GEMINI_API_KEY;
  const dbUrl = process.env.DATABASE_URL;

  const result: Record<string, unknown> = {
    hasGeminiKey: !!apiKey,
    hasDbUrl: !!dbUrl,
    keyPrefix: apiKey ? apiKey.slice(0, 12) + '...' : null,
    tests: {} as Record<string, unknown>,
    availableModels: null as unknown,
  };

  if (apiKey) {
    // List available models
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      );
      const j = await r.json() as Record<string, unknown>;
      if (r.ok) {
        const models = (j.models as Array<Record<string,unknown>>)?.map(m => m.name) ?? [];
        result.availableModels = models;
      } else {
        result.availableModels = 'error: ' + JSON.stringify(j);
      }
    } catch (e) {
      result.availableModels = 'fetch error: ' + (e instanceof Error ? e.message : String(e));
    }

    // Test each version+model combo
    const combos: Array<[string, string]> = [
      ['v1beta', 'gemini-2.5-flash'],
      ['v1beta', 'gemini-2.0-flash'],
      ['v1',     'gemini-1.5-flash'],
      ['v1beta', 'gemini-1.5-flash'],
    ];
    for (const [ver, model] of combos) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
        );
        const j = await r.json() as Record<string, unknown>;
        if (r.ok) {
          const text = (j as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
          (result.tests as Record<string, unknown>)[`${ver}/${model}`] = '✅ ' + (text ?? 'no text');
        } else {
          (result.tests as Record<string, unknown>)[`${ver}/${model}`] = '❌ ' + (j as any)?.error?.message;
        }
      } catch (e) {
        (result.tests as Record<string, unknown>)[`${ver}/${model}`] = 'err: ' + (e instanceof Error ? e.message : String(e));
      }
    }
  }

  return res.status(200).json(result);
}
