import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { usersTable } from "../../lib/db/src/schema/users";
import { auditLogsTable } from "../../lib/db/src/schema/audit-logs";
import { aiUsageTable } from "../../lib/db/src/schema/ai-usage";

const schema = { usersTable, auditLogsTable, aiUsageTable };

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurado");
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export { usersTable, auditLogsTable, aiUsageTable };
