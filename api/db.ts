import pg from "pg";
import { MIGRATE_SQL } from "../src/db/migrate-sql.ts";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let migrated = false;

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function ensureSchema() {
  if (migrated) return;
  await getPool().query(MIGRATE_SQL);
  migrated = true;
}

export async function runSql(sql: string, params: unknown[] = []) {
  await ensureSchema();
  const result = await getPool().query({
    text: sql,
    values: params,
    rowMode: "array",
  });
  return { rows: result.rows as unknown[][] };
}

export async function handleDbRequest(req: { method?: string; body?: any }, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const sql = String(req.body?.sql ?? "");
  const params = Array.isArray(req.body?.params) ? req.body.params : [];
  if (!sql.trim()) {
    res.status(400).json({ error: "sql is required" });
    return;
  }
  try {
    const { rows } = await runSql(sql, params);
    res.status(200).json({ rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
}

export default async function handler(req: any, res: any) {
  await handleDbRequest(req, res);
}
