import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, usersTable, auditLogsTable } from "../_lib/db";
import { verifyToken, extractBearerToken, isAdminEmail } from "../_lib/auth";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function logAction(db: ReturnType<typeof getDb>, adminEmail: string, action: string, targetUserId: number, metadata?: Record<string, unknown>) {
  await db.insert(auditLogsTable).values({ adminEmail, action, targetUserId, metadata: metadata ?? null });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    const payload = verifyToken(token);
    if (!isAdminEmail(payload.email)) return res.status(403).json({ error: "Acesso negado" });

    const { action, userId, days } = req.body ?? {};
    if (!action || !userId) return res.status(400).json({ error: "action e userId obrigatórios" });

    const db = getDb();
    const targetId = Number(userId);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    switch (action) {
      case "grant_premium": {
        const now = new Date();
        await db.update(usersTable).set({ isPremium: true, premiumGrantedAt: now, updatedAt: now }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "grant_premium", targetId);
        return res.status(200).json({ success: true, message: "Premium liberado" });
      }
      case "revoke_premium": {
        await db.update(usersTable).set({ isPremium: false, premiumGrantedAt: null, premiumExpiresAt: null, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "revoke_premium", targetId);
        return res.status(200).json({ success: true, message: "Premium revogado" });
      }
      case "add_days": {
        if (!days || isNaN(Number(days))) return res.status(400).json({ error: "days obrigatório" });
        const base = user.premiumExpiresAt && user.premiumExpiresAt > new Date() ? user.premiumExpiresAt : new Date();
        const newExpiry = new Date(base.getTime() + Number(days) * 86400000);
        await db.update(usersTable).set({ isPremium: true, premiumGrantedAt: user.premiumGrantedAt ?? new Date(), premiumExpiresAt: newExpiry, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "add_days", targetId, { days: Number(days) });
        return res.status(200).json({ success: true, message: `${days} dia(s) adicionados` });
      }
      case "remove_days": {
        if (!days || isNaN(Number(days))) return res.status(400).json({ error: "days obrigatório" });
        if (!user.premiumExpiresAt) return res.status(400).json({ error: "Usuário não tem expiração definida" });
        const newExpiry = new Date(user.premiumExpiresAt.getTime() - Number(days) * 86400000);
        const expired = newExpiry <= new Date();
        await db.update(usersTable).set({ isPremium: !expired, premiumExpiresAt: expired ? null : newExpiry, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "remove_days", targetId, { days: Number(days) });
        return res.status(200).json({ success: true, message: `${days} dia(s) removidos` });
      }
      case "restore_free": {
        await db.update(usersTable).set({ freeGenerationsRemaining: 3, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "restore_free", targetId);
        return res.status(200).json({ success: true, message: "Gerações gratuitas restauradas" });
      }
      case "block": {
        await db.update(usersTable).set({ isActive: false, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "block_user", targetId);
        return res.status(200).json({ success: true, message: "Usuário bloqueado" });
      }
      case "unblock": {
        await db.update(usersTable).set({ isActive: true, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await logAction(db, payload.email, "unblock_user", targetId);
        return res.status(200).json({ success: true, message: "Usuário desbloqueado" });
      }
      default:
        return res.status(400).json({ error: "Ação desconhecida" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return res.status(500).json({ error: msg });
  }
}
