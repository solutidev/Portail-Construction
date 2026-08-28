import pg from "pg";
import { MIGRATE_SQL } from "../src/db/migrate-sql.ts";
import { hashPassword, hashPasswordParams, verifyPassword } from "./_lib/password.ts";
import {
  clearSessionCookie,
  cookieHeaderOf,
  newSessionToken,
  sessionCookie,
  sessionMaxAgeSeconds,
  tokenFromCookieHeader,
} from "./_lib/session.ts";

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
  const password = process.env.POSTGRES_PASSWORD || "";
  const db = process.env.POSTGRES_DB || "frx";
  if (!password) throw new Error("POSTGRES_PASSWORD or DATABASE_URL is required");
  return `postgres://${user}:${encodeURIComponent(password)}@db:5432/${db}`;
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

async function ensureDemoUsers() {
  if (demoReady) return;
  await ensureSchema();
  const count = await getPool().query("SELECT count(*)::int AS n FROM users");
  if ((count.rows[0]?.n ?? 0) === 0) {
    await getPool().query(
      `INSERT INTO users (name, email, password, user_type, title, phone, is_active, is_admin, avatar_initials, locale, theme, all_clients)
       VALUES ($1, $2, $3, 'internal', 'Administrator', NULL, 1, 1, 'AD', 'en', 'light', 1)`,
      ["Administrator", "admin@frxconstruction.ca", hashPassword("admin123")],
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
  const stored = String(row.password ?? "");
  if (!verifyPassword(password.trim(), stored)) return { error: "login.error.invalid" };
  if (Number(row.is_active) !== 1) return { error: "login.error.inactive" };
  if (!stored.startsWith("pbkdf2$")) {
    await getPool().query("UPDATE users SET password = $2 WHERE id = $1", [row.id, hashPassword(password.trim())]);
  }
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

function publicUser(row: Record<string, unknown>) {
  return {
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
  };
}

async function createDbSession(userId: number) {
  const token = newSessionToken();
  const expires = new Date(Date.now() + sessionMaxAgeSeconds() * 1000).toISOString();
  await getPool().query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    userId,
    expires,
  ]);
  return token;
}

async function revokeDbSession(token: string | null) {
  if (!token) return;
  await getPool().query("DELETE FROM sessions WHERE token = $1", [token]);
}

async function revokeUserSessions(userId: number) {
  await getPool().query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

async function loadSessionUser(req: { headers?: Record<string, unknown> }) {
  const token = tokenFromCookieHeader(cookieHeaderOf(req));
  if (!token) return null;
  const result = await getPool().query(
    `SELECT u.id, u.name, u.email, u.user_type, u.title, u.phone, u.is_active, u.is_admin,
            u.avatar_initials, u.locale, u.theme, u.all_clients, u.created_at, s.expires_at,
            COALESCE(s.view_as, 'admin') AS view_as
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1
     LIMIT 1`,
    [token],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row || Number(row.is_active) !== 1) return null;
  if (String(row.expires_at) < new Date().toISOString()) {
    await revokeDbSession(token);
    return null;
  }
  const user = publicUser(row) as ReturnType<typeof publicUser> & { view_as?: string };
  user.view_as = String(row.view_as ?? "admin");
  return user;
}

function effectiveAdmin(session: { is_admin: number; view_as?: string }) {
  return Number(session.is_admin) === 1 && (session.view_as ?? "admin") === "admin";
}

function isAllowedSql(sql: string) {
  const trimmed = sql.trim();
  if (!trimmed) return false;
  if (/;/.test(trimmed.replace(/;+\s*$/, ""))) return false;
  if (/\b(drop|alter|truncate|create|grant|revoke|comment|copy|vacuum|lock|call|do)\b/i.test(trimmed)) return false;
  if (/^\s*select\b/i.test(trimmed)) return true;
  if (/^\s*insert\s+into\b/i.test(trimmed)) return true;
  if (/^\s*update\b/i.test(trimmed)) return true;
  if (/^\s*delete\s+from\b/i.test(trimmed)) return true;
  return false;
}

function rewriteSql(sql: string) {
  if (/^\s*select\b/i.test(sql) && /\busers\b/i.test(sql)) {
    return sql.replace(/(?:["']?users["']?\.)?["']?password["']?(?!\s*=)/gi, "'' AS password");
  }
  return sql;
}

export async function requireApiUser(req: { headers?: Record<string, unknown> }) {
  await ensureSchema();
  return loadSessionUser(req);
}

export async function handleDbRequest(req: { method?: string; body?: any; headers?: Record<string, unknown> }, res: any) {
  const action = String(req.body?.action ?? "");
  try {
    if (action === "ping" || req.method === "GET") {
      if (!hasRemoteDb()) {
        return res.status(200).json({ ok: true, users: 0, local: true });
      }
      await ensureSchema();
      await ensureDemoUsers();
      const count = await getPool().query("SELECT count(*)::int AS n FROM users");
      return res.status(200).json({ ok: true, users: count.rows[0]?.n ?? 0 });
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    if (action === "login") {
      if (!hasRemoteDb()) {
        return res.status(200).json({ error: "login.local" });
      }
      const result = await loginUser(String(req.body?.email ?? ""), String(req.body?.password ?? ""));
      if ("user" in result && result.user) {
        const token = await createDbSession(Number(result.user.id));
        res.setHeader?.("Set-Cookie", sessionCookie(token));
      }
      return res.status(200).json(result);
    }
    if (action === "logout") {
      await revokeDbSession(tokenFromCookieHeader(cookieHeaderOf(req)));
      res.setHeader?.("Set-Cookie", clearSessionCookie());
      return res.status(200).json({ ok: true });
    }
    if (action === "session") {
      await ensureSchema();
      const user = await loadSessionUser(req);
      return res.status(200).json({ user });
    }
    if (action === "view_as") {
      if (!hasRemoteDb()) {
        return res.status(200).json({ ok: true, view_as: String(req.body?.view_as ?? "admin"), local: true });
      }
      const session = await loadSessionUser(req);
      if (!session) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (Number(session.is_admin) !== 1) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const mode = String(req.body?.view_as ?? "admin");
      const viewAs = mode === "staff" || mode === "client" ? mode : "admin";
      const token = tokenFromCookieHeader(cookieHeaderOf(req));
      if (token) {
        await getPool().query("UPDATE sessions SET view_as = $2 WHERE token = $1", [token, viewAs]);
      }
      return res.status(200).json({ ok: true, view_as: viewAs });
    }
    if (!hasRemoteDb()) {
      return res.status(200).json({ rows: [], local: true });
    }
    const session = await loadSessionUser(req);
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const sql = String(req.body?.sql ?? "");
    const params = Array.isArray(req.body?.params) ? req.body.params : [];
    if (!sql.trim()) {
      res.status(400).json({ error: "sql is required" });
      return;
    }
    if (!isAllowedSql(sql)) {
      res.status(400).json({ error: "Query not allowed" });
      return;
    }
    const mutating = /^\s*(insert|update|delete)\b/i.test(sql);
    const sensitive =
      /\b(users|user_permissions|access_groups|access_group_permissions|user_access_groups|app_settings|sessions)\b/i.test(
        sql,
      );
    const admin = effectiveAdmin(session);
    if (mutating && sensitive && !admin) {
      const selfProfile =
        /^\s*update\s+"?users"?\s+set\b/i.test(sql) &&
        /\bid\s*=\s*\$/i.test(sql) &&
        !/\bis_admin\b/i.test(sql) &&
        !/\ball_clients\b/i.test(sql) &&
        !/\bpassword\b/i.test(sql);
      if (!selfProfile) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const reduced = session.user_type === "external" || session.view_as === "client" || session.view_as === "staff";
    if (reduced && mutating && /\b(app_settings|sessions)\b/i.test(sql)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (mutating && /\bpassword\b/i.test(sql) && /^\s*update\s+"?users"?/i.test(sql)) {
      await revokeUserSessions(session.id);
    }
    const { rows } = await runSql(rewriteSql(sql), await hashPasswordParams(sql, params));
    res.status(200).json({ rows });
  } catch (err) {
    console.error("db api error", err);
    res.status(500).json({ error: "Query failed" });
  }
}

export default async function handler(req: any, res: any) {
  await handleDbRequest(req, res);
}
