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
  if (!res.ok) {
    let message = `Database error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { rows: unknown[][] };
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
    await remoteQuery("SELECT 1", [], "all");
  })();
  return { db, ready };
}

const instance = useRemote ? createRemote() : createLocal();

export const db = instance.db;
export const dbReady = instance.ready;
