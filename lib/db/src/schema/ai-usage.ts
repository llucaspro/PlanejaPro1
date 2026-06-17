import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiUsageTable = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  requestType: text("request_type").notNull(),
  estimatedTokens: integer("estimated_tokens").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiUsage = typeof aiUsageTable.$inferSelect;
