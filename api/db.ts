import pg from "pg";
import { MIGRATE_SQL } from "../src/db/migrate-sql.ts";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let migrated = false;

function statementsOf(sql: string) {
  return sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url, connectionTimeoutMillis: 8000 });
  }
  return pool;
}

function serializeCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function ensureSchema() {
  if (migrated) return;
  const client = await getPool().connect();
  try {
    for (const statement of statementsOf(MIGRATE_SQL)) {
      await client.query(statement);
    }
    migrated = true;
  } finally {
    client.release();
  }
}

async function ensureDemoUsers() {
  await ensureSchema();
  const existing = await getPool().query("SELECT id FROM users LIMIT 1");
  if (existing.rowCount && existing.rowCount > 0) {
    const admin = await getPool().query("SELECT id FROM users WHERE lower(email) = $1", [
      "admin@frxconstruction.ca",
    ]);
    if (admin.rowCount && admin.rowCount > 0) return;
  }
  if (existing.rowCount && existing.rowCount > 0) return;

  await getPool().query(
    `INSERT INTO users (name, email, password, user_type, title, phone, is_active, is_admin, avatar_initials, locale, theme, all_clients)
     VALUES
      ('Camille Bouchard', 'admin@frxconstruction.ca', 'admin123', 'internal', 'Director of Operations', '450-555-0100', 1, 1, 'CB', 'en', 'light', 1),
      ('Marc Tremblay', 'marc@frxconstruction.ca', 'frx123', 'internal', 'Senior Project Manager', '514-555-0142', 1, 0, 'MT', 'fr', 'light', 1),
      ('Sophie Lavoie', 'sophie@nordique.com', 'client123', 'external', 'VP Real Estate', '514-555-2201', 1, 0, 'SL', 'fr', 'light', 0)`,
  );
}

export async function runSql(sql: string, params: unknown[] = []) {
  await ensureSchema();
  await ensureDemoUsers();
  const result = await getPool().query({
    text: sql,
    values: params,
    rowMode: "array",
  });
  return { rows: (result.rows as unknown[][]).map((row) => row.map(serializeCell)) };
}

export async function loginUser(email: string, password: string) {
  await ensureSchema();
  await ensureDemoUsers();
  const result = await getPool().query(
    `SELECT id, name, email, password, user_type, title, phone, is_active, is_admin, avatar_initials, locale, theme, all_clients, created_at
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()],
  );
  const row = result.rows[0];
  if (!row) return { error: "login.error.invalid" };
  if (String(row.password) !== password) return { error: "login.error.invalid" };
  if (Number(row.is_active) !== 1) return { error: "login.error.inactive" };
  const { password: _pw, ...user } = row;
  void _pw;
  return { user };
}

export async function handleDbRequest(req: { method?: string; body?: any }, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const action = String(req.body?.action ?? "");
  try {
    if (action === "login") {
      const result = await loginUser(String(req.body?.email ?? ""), String(req.body?.password ?? ""));
      if ("error" in result) return res.status(200).json(result);
      return res.status(200).json(result);
    }
    const sql = String(req.body?.sql ?? "");
    const params = Array.isArray(req.body?.params) ? req.body.params : [];
    if (!sql.trim()) {
      res.status(400).json({ error: "sql is required" });
      return;
    }
    const { rows } = await runSql(sql, params);
    res.status(200).json({ rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
}

export default async function handler(req: any, res: any) {
  await handleDbRequest(req, res);
}
