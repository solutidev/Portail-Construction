import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleProxy } from "drizzle-orm/pg-proxy";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { MIGRATE_SQL } from "./migrate-sql";

export { schema };

const useRemote = import.meta.env.PROD;

async function remoteQuery(sql: string, params: unknown[], _method: "all" | "execute") {
  const res = await fetch("/api/db", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const data = (await res.json().catch(() => ({}))) as { rows?: unknown[][]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Database error (${res.status})`);
  }
  return { rows: data.rows ?? [] };
}

function createLocal() {
  const client = new PGlite("idb://app-db");
  (window as any).__devs_pglite = client;
  const db = drizzlePglite(client, { schema });
  const ready = (async () => {
    await client.exec(MIGRATE_SQL);
  })();
  return { db, ready };
}

function createRemote() {
  const db = drizzleProxy(remoteQuery, { schema });
  const ready = (async () => {
    const res = await fetch("/api/db", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ping" }),
    });
    if (!res.ok) throw new Error(`Database error (${res.status})`);
  })();
  return { db, ready };
}

const instance = useRemote ? createRemote() : createLocal();

export const db = instance.db;
export const dbReady = instance.ready;
