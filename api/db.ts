import pg from "pg";
import { MIGRATE_SQL } from "../src/db/migrate-sql.ts";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let migrated = false;
let demoReady = false;

function statementsOf(sql: string) {
  return sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.POSTGRES_USER || "frx";
  const password = process.env.POSTGRES_PASSWORD || "frx-change-me";
  const db = process.env.POSTGRES_DB || "frx";
  return `postgres://${user}:${password}@db:5432/${db}`;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      connectionTimeoutMillis: 8000,
    });
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

const DEMO_USERS = [
  {
    name: "Camille Bouchard",
    email: "admin@frxconstruction.ca",
    password: "admin123",
    user_type: "internal",
    title: "Director of Operations",
    phone: "450-555-0100",
    is_admin: 1,
    initials: "CB",
    locale: "en",
    all_clients: 1,
  },
  {
    name: "Marc Tremblay",
    email: "marc@frxconstruction.ca",
    password: "frx123",
    user_type: "internal",
    title: "Senior Project Manager",
    phone: "514-555-0142",
    is_admin: 0,
    initials: "MT",
    locale: "fr",
    all_clients: 1,
  },
  {
    name: "Sophie Lavoie",
    email: "sophie@nordique.com",
    password: "client123",
    user_type: "external",
    title: "VP Real Estate",
    phone: "514-555-2201",
    is_admin: 0,
    initials: "SL",
    locale: "fr",
    all_clients: 0,
  },
];

async function ensureDemoUsers() {
  if (demoReady) return;
  await ensureSchema();
  for (const user of DEMO_USERS) {
    const found = await getPool().query("SELECT id FROM users WHERE lower(email) = lower($1)", [user.email]);
    if (found.rowCount && found.rowCount > 0) {
      await getPool().query(
        `UPDATE users
         SET password = $2, is_active = 1, is_admin = $3, name = $4, user_type = $5
         WHERE lower(email) = lower($1)`,
        [user.email, user.password, user.is_admin, user.name, user.user_type],
      );
      continue;
    }
    await getPool().query(
      `INSERT INTO users (name, email, password, user_type, title, phone, is_active, is_admin, avatar_initials, locale, theme, all_clients)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, 'light', $10)`,
      [
        user.name,
        user.email,
        user.password,
        user.user_type,
        user.title,
        user.phone,
        user.is_admin,
        user.initials,
        user.locale,
        user.all_clients,
      ],
    );
  }
  demoReady = true;
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
    `SELECT id, name, email, user_type, title, phone, is_active, is_admin, avatar_initials, locale, theme, all_clients, created_at, password
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return { error: "login.error.invalid" };
  if (String(row.password ?? "") !== password) return { error: "login.error.invalid" };
  if (Number(row.is_active) !== 1) return { error: "login.error.inactive" };
  return {
    user: {
      id: Number(row.id),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
      user_type: String(row.user_type ?? "internal"),
      title: row.title == null ? null : String(row.title),
      phone: row.phone == null ? null : String(row.phone),
      is_active: Number(row.is_active),
      is_admin: Number(row.is_admin),
      avatar_initials: row.avatar_initials == null ? null : String(row.avatar_initials),
      locale: row.locale === "fr" ? "fr" : "en",
      theme: row.theme === "dark" ? "dark" : "light",
      all_clients: Number(row.all_clients ?? 1),
      created_at: row.created_at,
      password: "",
    },
  };
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
    console.error("db api error", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
}

export default async function handler(req: any, res: any) {
  await handleDbRequest(req, res);
}
