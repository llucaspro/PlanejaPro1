import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

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

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof usersTable.$inferSelect;
