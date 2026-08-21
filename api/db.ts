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
         SET is_active = 1, is_admin = $2, name = $3, user_type = $4
         WHERE lower(email) = lower($1)`,
        [user.email, user.is_admin, user.name, user.user_type],
      );
      continue;
    }
    await getPool().query(
      `INSERT INTO users (name, email, password, user_type, title, phone, is_active, is_admin, avatar_initials, locale, theme, all_clients)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, 'light', $10)`,
      [
        user.name,
        user.email,
        hashPassword(user.password),
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
  await ensureDemoCatalog();
}

async function ensureDemoCatalog() {
  const clients = await getPool().query("SELECT count(*)::int AS n FROM clients");
  if ((clients.rows[0]?.n ?? 0) > 0) return;

  const admin = await getPool().query("SELECT id FROM users WHERE lower(email)='admin@frxconstruction.ca'");
  const pm = await getPool().query("SELECT id FROM users WHERE lower(email)='marc@frxconstruction.ca'");
  const sophie = await getPool().query("SELECT id FROM users WHERE lower(email)='sophie@nordique.com'");
  const adminId = admin.rows[0]?.id ?? 1;
  const pmId = pm.rows[0]?.id ?? adminId;
  const sophieId = sophie.rows[0]?.id ?? adminId;

  const nordique = await getPool().query(
    `INSERT INTO clients (name, company_name, email, phone, address, city, state, zip, notes, status)
     VALUES ('Sophie Lavoie', 'Nordique Immobilier', 'projects@nordique.com', '514-555-2200', '1200 Boulevard René-Lévesque O', 'Montréal', 'QC', 'H3B 4W8', 'Long-term commercial client.', 'active')
     RETURNING id`,
  );
  const harbour = await getPool().query(
    `INSERT INTO clients (name, company_name, email, phone, address, city, state, zip, notes, status)
     VALUES ('Amelia Chen', 'Harbour Development', 'build@harbourdev.ca', '416-555-3300', '88 Queens Quay W', 'Toronto', 'ON', 'M5J 0B8', 'Waterfront mixed-use portfolio.', 'active')
     RETURNING id`,
  );
  await getPool().query(
    `INSERT INTO clients (name, company_name, email, phone, address, city, state, zip, notes, status)
     VALUES ('École Saint-Laurent', 'Commission scolaire de Montréal', 'travaux@csdm.qc.ca', '514-555-4400', '3737 Rue Sherbrooke E', 'Montréal', 'QC', 'H1X 3B3', 'Public-sector prospect.', 'prospect')`,
  );
  const nordiqueId = nordique.rows[0].id;
  const harbourId = harbour.rows[0].id;

  const plaza = await getPool().query(
    `INSERT INTO projects (client_id, name, project_number, description, status, phase, project_type, address, city, start_date, end_date, budget, spent, sort_order, require_geofence)
     VALUES ($1, 'Plaza Saint-Laurent', 'FOR-2408', 'Six-storey mixed-use podium with ground-floor retail.', 'active', 'structure', 'Mixed-use', '2150 Rue Saint-Laurent', 'Montréal', CURRENT_DATE - 120, CURRENT_DATE + 240, 18400000, 7420000, 0, 0)
     RETURNING id`,
    [nordiqueId],
  );
  const warehouse = await getPool().query(
    `INSERT INTO projects (client_id, name, project_number, description, status, phase, project_type, address, city, start_date, end_date, budget, spent, sort_order, require_geofence)
     VALUES ($1, 'Anjou Cold Storage', 'FOR-2412', 'Refrigerated distribution facility.', 'planning', 'preconstruction', 'Industrial', '8900 Boulevard Métropolitain E', 'Anjou', CURRENT_DATE + 30, CURRENT_DATE + 320, 9600000, 410000, 0, 0)
     RETURNING id`,
    [nordiqueId],
  );
  const quay = await getPool().query(
    `INSERT INTO projects (client_id, name, project_number, description, status, phase, project_type, address, city, start_date, end_date, budget, spent, sort_order, require_geofence)
     VALUES ($1, 'Quay 12 Residences', 'FOR-2319', 'Waterfront condominium tower, 22 storeys.', 'active', 'envelope', 'Residential', '12 Harbour Street', 'Toronto', CURRENT_DATE - 280, CURRENT_DATE + 160, 42800000, 27100000, 0, 0)
     RETURNING id`,
    [harbourId],
  );
  const plazaId = plaza.rows[0].id;
  const warehouseId = warehouse.rows[0].id;
  const quayId = quay.rows[0].id;

  await getPool().query(
    `INSERT INTO client_users (client_id, user_id, is_primary) VALUES ($1, $2, 1)`,
    [nordiqueId, sophieId],
  );
  await getPool().query(
    `INSERT INTO project_members (project_id, user_id, role) VALUES
      ($1, $2, 'Project Manager'), ($3, $2, 'Project Manager'), ($4, $2, 'Project Manager'),
      ($1, $5, 'Client Contact')`,
    [plazaId, pmId, warehouseId, quayId, sophieId],
  );
  await getPool().query(
    `INSERT INTO project_tasks (project_id, title, description, start_date, end_date, status, priority, assigned_to)
     VALUES
      ($1, 'Level 4 slab pour', 'Coordinate pump and rebar inspection.', CURRENT_DATE - 4, CURRENT_DATE + 2, 'in_progress', 'high', $2),
      ($1, 'MEP rough-in — podium', 'Electrical and mechanical sleeves.', CURRENT_DATE + 3, CURRENT_DATE + 28, 'not_started', 'medium', $2),
      ($3, 'Curtain wall levels 8–12', 'Unitized panels arriving Tuesday.', CURRENT_DATE - 2, CURRENT_DATE + 18, 'in_progress', 'high', $2)`,
    [plazaId, pmId, quayId],
  );
  await getPool().query(
    `INSERT INTO budget_items (project_id, category, description, estimated, actual, status) VALUES
      ($1, 'Concrete', 'Foundations, podium, cores', 4100000, 2680000, 'invoiced'),
      ($1, 'MEP', 'Mechanical, electrical, plumbing', 3200000, 610000, 'planned'),
      ($2, 'Envelope', 'Unitized curtain wall', 6400000, 4120000, 'committed')`,
    [plazaId, quayId],
  );
  await getPool().query(
    `INSERT INTO rfis (project_id, number, title, description, status, assigned_to, due_date) VALUES
      ($1, 'RFI-042', 'Transfer slab sleeve conflict', 'Mechanical sleeve clashes with tendon profile.', 'open', $2, CURRENT_DATE + 4)`,
    [plazaId, pmId],
  );
  await getPool().query(
    `INSERT INTO change_orders (project_id, number, title, description, amount, status) VALUES
      ($1, 'CO-008', 'Upgrade retail storefront', 'Owner-directed upgrade on three bays.', 186400, 'submitted')`,
    [plazaId],
  );
  await getPool().query(
    `INSERT INTO daily_logs (project_id, log_date, weather, crew_count, notes, created_by) VALUES
      ($1, CURRENT_DATE - 1, 'Clear, 11°C', 42, 'Formwork for L4 slab complete.', $2)`,
    [plazaId, pmId],
  );
  await getPool().query(
    `INSERT INTO activities (project_id, client_id, user_id, action, details) VALUES
      ($1, $2, $3, 'updated budget', 'Committed steel package'),
      ($1, $2, $4, 'opened project', 'Plaza Saint-Laurent')`,
    [plazaId, nordiqueId, pmId, adminId],
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
    if (reduced && /\b(app_settings|sessions)\b/i.test(sql)) {
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
