import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface AppUser {
  firebaseUid: string;
  id: number;
  email: string;
  name: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  freeGenerationsRemaining: number;
  isActive: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "pp_token";

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function storeToken(t: string) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch {}
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function syncWithBackend(idToken: string): Promise<{ token: string; user: AppUser & { firebaseUid?: string } }> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err?.error || "Erro ao sincronizar conta");
  }
  return res.json() as Promise<{ token: string; user: AppUser }>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) { clearToken(); setToken(null); setUser(null); return; }
      const data = await res.json() as AppUser;
      setUser((prev) => prev ? { ...prev, ...data } : data);
    } catch {}
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearToken();
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const { token: appToken, user: appUser } = await syncWithBackend(idToken);
        storeToken(appToken);
        setToken(appToken);
        setUser({ ...appUser, firebaseUid: firebaseUser.uid });
      } catch (err) {
        console.error("Sync error:", err);
        clearToken();
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    clearToken();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
