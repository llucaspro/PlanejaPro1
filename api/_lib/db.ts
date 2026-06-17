import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  pgTable, serial, text, boolean, integer, timestamp, jsonb,
} from "drizzle-orm/pg-core";

// ── Schema (inlined to avoid ESM/CJS mismatch with lib/db) ──────────────────

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name"),
  isActive: boolean("is_active").default(true).notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  freeGenerationsRemaining: integer("free_generations_remaining").default(3).notNull(),
  premiumGrantedAt: timestamp("premium_granted_at"),
  premiumExpiresAt: timestamp("premium_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetUserId: integer("target_user_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiUsageTable = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  requestType: text("request_type").notNull(),
  estimatedTokens: integer("estimated_tokens").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type AiUsage = typeof aiUsageTable.$inferSelect;

// ── DB connection ────────────────────────────────────────────────────────────

const schema = { usersTable, auditLogsTable, aiUsageTable };

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurado");
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
