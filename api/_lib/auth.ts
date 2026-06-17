import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  console.error("[SECURITY] AVISO: JWT_SECRET não está definido. Configure a variável de ambiente JWT_SECRET no Vercel.");
}

const SECRET = JWT_SECRET || "planejapro-secret-change-in-prod";

export interface JwtPayload {
  userId: number;
  email: string;
  name: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  freeGenerationsRemaining: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase());
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string; name: string | null }> {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_API_KEY não configurado");

  if (!idToken || typeof idToken !== "string" || idToken.length > 4096) {
    throw new Error("Token Firebase inválido");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    throw new Error("Token Firebase inválido ou expirado");
  }

  const data = await res.json() as { users?: Array<{ localId: string; email: string; displayName?: string }> };
  const user = data.users?.[0];
  if (!user) throw new Error("Usuário não encontrado");

  return { uid: user.localId, email: user.email, name: user.displayName || null };
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 2048) return null;
  return token;
}
