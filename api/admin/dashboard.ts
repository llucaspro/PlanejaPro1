import type { VercelRequest, VercelResponse } from "@vercel/node";
import { count, eq, sql, desc } from "drizzle-orm";
import { getDb, usersTable, aiUsageTable } from "../_lib/db";
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

    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const [activeUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isActive, true));
    const [premiumUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isPremium, true));
    const [blockedUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isActive, false));

    const freeUsers = (activeUsers.count) - (premiumUsers.count);
    const [totalGenerations] = await db.select({ count: count() }).from(aiUsageTable);
    const [totalTokens] = await db.select({ total: sql<number>`coalesce(sum(estimated_tokens), 0)` }).from(aiUsageTable);

    const topUsers = await db
      .select({
        userId: aiUsageTable.userId,
        email: usersTable.email,
        name: usersTable.name,
        generations: count(aiUsageTable.id),
      })
      .from(aiUsageTable)
      .leftJoin(usersTable, eq(aiUsageTable.userId, usersTable.id))
      .groupBy(aiUsageTable.userId, usersTable.email, usersTable.name)
      .orderBy(desc(count(aiUsageTable.id)))
      .limit(5);

    const byType = await db
      .select({
        requestType: aiUsageTable.requestType,
        total: count(aiUsageTable.id),
      })
      .from(aiUsageTable)
      .groupBy(aiUsageTable.requestType)
      .orderBy(desc(count(aiUsageTable.id)));

    const generationsByType: Record<string, number> = {};
    for (const row of byType) {
      generationsByType[row.requestType] = row.total;
    }

    return res.status(200).json({
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      premiumUsers: premiumUsers.count,
      freeUsers,
      blockedUsers: blockedUsers.count,
      totalGenerations: totalGenerations.count,
      estimatedTokens: totalTokens.total ?? 0,
      topUsers,
      generationsByType,
    });
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
