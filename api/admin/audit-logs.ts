import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc } from "drizzle-orm";
import { getDb, auditLogsTable } from "../_lib/db";
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
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(200);
    return res.status(200).json(logs);
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
