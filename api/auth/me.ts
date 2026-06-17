import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, usersTable } from "../_lib/db";
import { verifyToken, extractBearerToken, isAdminEmail } from "../_lib/auth";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido" });

  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const payload = verifyToken(token);
    const db = getDb();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!user.isActive) return res.status(403).json({ error: "Conta bloqueada" });

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: isAdminEmail(user.email),
      isPremium: user.isPremium,
      freeGenerationsRemaining: user.freeGenerationsRemaining,
      isActive: user.isActive,
      premiumGrantedAt: user.premiumGrantedAt,
      premiumExpiresAt: user.premiumExpiresAt,
    });
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
