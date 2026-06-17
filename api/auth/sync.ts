import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, usersTable } from "../_lib/db";
import { verifyFirebaseToken, signToken, isAdminEmail } from "../_lib/auth";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { idToken } = req.body ?? {};
  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json({ error: "idToken obrigatório" });
  }

  try {
    const firebaseUser = await verifyFirebaseToken(idToken);
    const db = getDb();

    let [user] = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUser.uid));

    if (!user) {
      const [created] = await db.insert(usersTable).values({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.name,
        isActive: true,
        isPremium: false,
        freeGenerationsRemaining: 3,
      }).returning();
      user = created;
    } else {
      const [updated] = await db.update(usersTable)
        .set({
          email: firebaseUser.email,
          name: firebaseUser.name ?? user.name,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated;
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Conta bloqueada. Entre em contato com o suporte." });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: isAdminEmail(user.email),
      isPremium: user.isPremium,
      freeGenerationsRemaining: user.freeGenerationsRemaining,
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: isAdminEmail(user.email),
        isPremium: user.isPremium,
        freeGenerationsRemaining: user.freeGenerationsRemaining,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return res.status(401).json({ error: msg });
  }
}
