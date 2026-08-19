import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

const client = new PGlite("idb://app-db");
(window as any).__devs_pglite = client;
export const db = drizzle(client, { schema });
export { schema };

export const dbReady = (async () => {
  await client.exec(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, password TEXT NOT NULL, user_type TEXT NOT NULL, title TEXT, phone TEXT, is_active INTEGER NOT NULL, is_admin INTEGER NOT NULL, avatar_initials TEXT, locale TEXT NOT NULL DEFAULT 'en', theme TEXT NOT NULL DEFAULT 'light', all_clients INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT`);
  await client.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT`);
  await client.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS all_clients INTEGER`);
  await client.exec(`UPDATE users SET locale = 'en' WHERE locale IS NULL`);
  await client.exec(`UPDATE users SET theme = 'light' WHERE theme IS NULL`);
  await client.exec(`UPDATE users SET all_clients = 1 WHERE all_clients IS NULL AND user_type = 'internal'`);
  await client.exec(`UPDATE users SET all_clients = 0 WHERE all_clients IS NULL`);
  await client.exec(`CREATE TABLE IF NOT EXISTS clients (id SERIAL PRIMARY KEY, name TEXT NOT NULL, company_name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, zip TEXT, notes TEXT, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS client_users (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, user_id INTEGER NOT NULL, is_primary INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, name TEXT NOT NULL, project_number TEXT NOT NULL, description TEXT, status TEXT NOT NULL, phase TEXT NOT NULL, project_type TEXT, address TEXT, city TEXT, start_date TEXT, end_date TEXT, budget REAL NOT NULL, spent REAL NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER`);
  await client.exec(`UPDATE projects SET sort_order = id WHERE sort_order IS NULL`);
  await client.exec(`CREATE TABLE IF NOT EXISTS board_columns (id SERIAL PRIMARY KEY, slug TEXT NOT NULL, label TEXT NOT NULL, sort_order INTEGER NOT NULL, is_system INTEGER NOT NULL, color TEXT NOT NULL DEFAULT 'slate', created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS color TEXT`);
  await client.exec(`UPDATE board_columns SET color = 'sky' WHERE slug = 'planning' AND (color IS NULL OR color = '')`);
  await client.exec(`UPDATE board_columns SET color = 'emerald' WHERE slug = 'active' AND (color IS NULL OR color = '')`);
  await client.exec(`UPDATE board_columns SET color = 'amber' WHERE slug = 'on_hold' AND (color IS NULL OR color = '')`);
  await client.exec(`UPDATE board_columns SET color = 'slate' WHERE slug = 'completed' AND (color IS NULL OR color = '')`);
  await client.exec(`UPDATE board_columns SET color = 'slate' WHERE color IS NULL OR color = ''`);
  await client.exec(`INSERT INTO board_columns (slug, label, sort_order, is_system)
    SELECT 'planning', 'Planning', 0, 1
    WHERE NOT EXISTS (SELECT 1 FROM board_columns LIMIT 1)`);
  await client.exec(`INSERT INTO board_columns (slug, label, sort_order, is_system)
    SELECT 'active', 'Active', 1, 1
    WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE slug = 'active')
      AND EXISTS (SELECT 1 FROM board_columns WHERE slug = 'planning')`);
  await client.exec(`INSERT INTO board_columns (slug, label, sort_order, is_system)
    SELECT 'on_hold', 'On hold', 2, 1
    WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE slug = 'on_hold')
      AND EXISTS (SELECT 1 FROM board_columns WHERE slug = 'planning')`);
  await client.exec(`INSERT INTO board_columns (slug, label, sort_order, is_system)
    SELECT 'completed', 'Completed', 3, 1
    WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE slug = 'completed')
      AND EXISTS (SELECT 1 FROM board_columns WHERE slug = 'planning')`);
  await client.exec(`CREATE TABLE IF NOT EXISTS project_members (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS user_permissions (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, module TEXT NOT NULL, scope_type TEXT NOT NULL, scope_id INTEGER NOT NULL, can_view INTEGER NOT NULL, can_create INTEGER NOT NULL, can_edit INTEGER NOT NULL, can_delete INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS project_tasks (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, start_date TEXT, end_date TEXT, status TEXT NOT NULL, priority TEXT NOT NULL, assigned_to INTEGER, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS budget_items (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, estimated REAL NOT NULL, actual REAL NOT NULL, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS calendar_events (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, title TEXT NOT NULL, event_date TEXT NOT NULL, end_date TEXT, event_type TEXT NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, notes TEXT, uploaded_by INTEGER, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS rfis (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, number TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, assigned_to INTEGER, due_date TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS change_orders (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, number TEXT NOT NULL, title TEXT NOT NULL, description TEXT, amount REAL NOT NULL, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS daily_logs (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, log_date TEXT NOT NULL, weather TEXT, crew_count INTEGER NOT NULL, notes TEXT, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS punch_items (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, title TEXT NOT NULL, location TEXT, status TEXT NOT NULL, priority TEXT NOT NULL, assigned_to INTEGER, due_date TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS safety_incidents (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, incident_date TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS activities (id SERIAL PRIMARY KEY, project_id INTEGER, client_id INTEGER, user_id INTEGER, action TEXT NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS access_groups (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, audience TEXT NOT NULL, all_clients INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS access_group_permissions (id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, module TEXT NOT NULL, can_view INTEGER NOT NULL, can_create INTEGER NOT NULL, can_edit INTEGER NOT NULL, can_delete INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS access_group_clients (id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, client_id INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS user_access_groups (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, group_id INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS user_clients (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, client_id INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS billing_documents (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, project_id INTEGER, kind TEXT NOT NULL, number TEXT NOT NULL, title TEXT NOT NULL, description TEXT, amount REAL NOT NULL, status TEXT NOT NULL, issued_on TEXT, due_on TEXT, notes TEXT, source_quote_id INTEGER, line_items TEXT, subtotal REAL, tax_gst REAL, tax_qst REAL, po_number TEXT, sent_at TEXT, sent_to TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS source_quote_id INTEGER`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS line_items TEXT`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS subtotal REAL`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS tax_gst REAL`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS tax_qst REAL`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS po_number TEXT`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS sent_at TEXT`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS sent_to TEXT`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS signed_by TEXT`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS signed_at TEXT`);
  await client.exec(`ALTER TABLE billing_documents ADD COLUMN IF NOT EXISTS signature TEXT`);
  await client.exec(`CREATE TABLE IF NOT EXISTS app_settings (id SERIAL PRIMARY KEY, key TEXT NOT NULL, value TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS geo_lat REAL`);
  await client.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS geo_lng REAL`);
  await client.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS geo_radius_m INTEGER`);
  await client.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS require_geofence INTEGER`);
  await client.exec(`UPDATE projects SET require_geofence = 0 WHERE require_geofence IS NULL`);
  await client.exec(`CREATE TABLE IF NOT EXISTS time_punches (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, project_id INTEGER NOT NULL, kind TEXT NOT NULL, punched_at TEXT NOT NULL, lat REAL, lng REAL, accuracy REAL, distance_m INTEGER, status TEXT NOT NULL, note TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS project_reports (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL, sections TEXT NOT NULL, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS sharepoint_folders (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL, sp_item_id TEXT NOT NULL, sp_drive_id TEXT NOT NULL, path TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`CREATE TABLE IF NOT EXISTS sharepoint_shares (id SERIAL PRIMARY KEY, folder_id INTEGER NOT NULL, client_id INTEGER NOT NULL, item_id TEXT NOT NULL DEFAULT '', can_view INTEGER NOT NULL, can_upload INTEGER NOT NULL, can_edit INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() NOT NULL)`);
  await client.exec(`ALTER TABLE sharepoint_shares ADD COLUMN IF NOT EXISTS item_id TEXT`);
  await client.exec(`UPDATE sharepoint_shares SET item_id = '' WHERE item_id IS NULL`);
})();
