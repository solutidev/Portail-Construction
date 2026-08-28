import { db, schema } from "../db";
import type { User } from "./types";

async function postDb(body: Record<string, unknown>) {
  const res = await fetch("/api/db", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    users?: User[];
    user?: User;
    local?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function listUsers(): Promise<User[]> {
  const data = await postDb({ action: "list_users" });
  if (data.local) {
    return (await db.select().from(schema.users)) as User[];
  }
  return data.users ?? [];
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  user_type: "internal" | "external";
  title?: string | null;
  phone?: string | null;
  is_admin?: boolean;
  avatar_initials?: string | null;
  groupIds?: number[];
}): Promise<User> {
  const data = await postDb({ action: "create_user", ...input });
  if (data.local) {
    await db.insert(schema.users).values({
      name: input.name,
      email: input.email,
      password: input.password,
      user_type: input.user_type,
      title: input.title ?? null,
      phone: input.phone ?? null,
      is_active: 1,
      is_admin: input.is_admin ? 1 : 0,
      avatar_initials: input.avatar_initials ?? null,
      locale: "en",
      theme: "light",
      all_clients: input.user_type === "external" ? 0 : 1,
    });
    const rows = (await db.select().from(schema.users)) as User[];
    const created = rows.find((u) => u.email === input.email);
    if (!created) throw new Error("User was not saved");
    return created;
  }
  if (!data.user) throw new Error(data.error || "User was not saved");
  return data.user;
}
