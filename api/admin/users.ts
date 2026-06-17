import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ilike, or, desc } from "drizzle-orm";
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
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    const payload = verifyToken(token);
    if (!isAdminEmail(payload.email)) return res.status(403).json({ error: "Acesso negado" });

    const db = getDb();
    const search = req.query.search as string | undefined;

    const users = search
      ? await db.select().from(usersTable).where(
          or(
            ilike(usersTable.email, `%${search}%`),
            ilike(usersTable.name, `%${search}%`)
          )
        ).orderBy(desc(usersTable.createdAt))
      : await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

    return res.status(200).json(users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isPremium: u.isPremium,
      isActive: u.isActive,
      freeGenerationsRemaining: u.freeGenerationsRemaining,
      premiumGrantedAt: u.premiumGrantedAt,
      premiumExpiresAt: u.premiumExpiresAt,
      createdAt: u.createdAt,
    })));
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
