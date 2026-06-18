import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GEMINI_API_KEY;
  const dbUrl = process.env.DATABASE_URL;

  const result: Record<string, unknown> = {
    hasGeminiKey: !!apiKey,
    hasDbUrl: !!dbUrl,
    keyPrefix: apiKey ? apiKey.slice(0, 8) + '...' : null,
    geminiTest: null,
    geminiError: null,
  };

  if (apiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );
      const json = await r.json() as Record<string, unknown>;
      if (r.ok) {
        const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
        result.geminiTest = text ?? 'no text';
      } else {
        result.geminiError = (json as any)?.error?.message ?? 'HTTP ' + r.status;
      }
    } catch (e) {
      result.geminiError = e instanceof Error ? e.message : String(e);
    }
  }

  return res.status(200).json(result);
}
