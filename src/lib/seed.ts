import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "../db";
import { initials, isoDate } from "./format";
import { ensureDefaultGroups } from "./access";
import { hashPassword, isHashedPassword } from "./password";

const EMAIL_MIGRATIONS: Record<string, string> = {
  "admin@soluti.dev": "admin@frxconstruction.ca",
  "marc@soluti.dev": "marc@frxconstruction.ca",
  "lea@soluti.dev": "lea@frxconstruction.ca",
  "noah@soluti.dev": "noah@frxconstruction.ca",
};

async function migrateLegacyBrand() {
  const users = await db.select().from(schema.users);
  for (const user of users) {
    const next = EMAIL_MIGRATIONS[user.email.toLowerCase()];
    if (next) {
      await db.update(schema.users).set({ email: next }).where(eq(schema.users.id, user.id));
    }
    if (user.password === "forge123" || user.password === "frx123" || user.password === "admin123" || user.password === "client123") {
      await db.update(schema.users).set({ password: await hashPassword(user.password === "forge123" ? "frx123" : user.password) }).where(eq(schema.users.id, user.id));
    } else if (user.password && !isHashedPassword(user.password)) {
      await db.update(schema.users).set({ password: await hashPassword(user.password) }).where(eq(schema.users.id, user.id));
    }
  }
}

let seedPromise: Promise<void> | null = null;

export async function seedIfEmpty() {
  if (!seedPromise) {
    seedPromise = seedIfEmptyInner().finally(() => {
      seedPromise = null;
    });
  }
  return seedPromise;
}

async function seedBillingIfEmpty() {
  const existing = await db.select().from(schema.billing_documents).limit(1);
  if (existing.length > 0) return;
  const clients = await db.select().from(schema.clients);
  const projects = await db.select().from(schema.projects);
  const nordique = clients.find((c) => c.company_name === "Nordique Immobilier");
  const harbour = clients.find((c) => c.company_name === "Harbour Development");
  const plaza = projects.find((p) => p.project_number === "FOR-2408");
  const warehouse = projects.find((p) => p.project_number === "FOR-2412");
  const quay = projects.find((p) => p.project_number === "FOR-2319");
  if (!nordique || !harbour || !plaza || !warehouse || !quay) return;
  await db.insert(schema.billing_documents).values([
    {
      client_id: nordique.id,
      project_id: plaza.id,
      kind: "quote",
      number: "SOU-2408",
      title: "Plaza Saint-Laurent — envelope package",
      description: "Curtain wall, roofing, and storefront package for the commercial podium.",
      amount: 1840000,
      status: "accepted",
      issued_on: isoDate(-210),
      due_on: isoDate(-180),
      notes: "Accepted with a 4-week shop-drawing window.",
    },
    {
      client_id: nordique.id,
      project_id: warehouse.id,
      kind: "quote",
      number: "SOU-2412",
      title: "Anjou Cold Storage — freezer envelope",
      description: "Insulated metal panels, dock seals, and vapor barrier.",
      amount: 960000,
      status: "sent",
      issued_on: isoDate(-18),
      due_on: isoDate(12),
      notes: "Waiting on owner review of the freezer slab alternate.",
    },
    {
      client_id: nordique.id,
      project_id: plaza.id,
      kind: "invoice",
      number: "FAC-2409-01",
      title: "Progress billing 01 — foundations",
      description: "Mobilization, excavation, and foundation walls through August.",
      amount: 1285000,
      status: "paid",
      issued_on: isoDate(-150),
      due_on: isoDate(-120),
      notes: "Paid by wire on the due date.",
    },
    {
      client_id: nordique.id,
      project_id: plaza.id,
      kind: "invoice",
      number: "FAC-2410-02",
      title: "Progress billing 02 — structure",
      description: "Steel erection and concrete decks, levels 2–5.",
      amount: 2140000,
      status: "sent",
      issued_on: isoDate(-28),
      due_on: isoDate(2),
      notes: "Holdback retained per contract.",
    },
    {
      client_id: harbour.id,
      project_id: quay.id,
      kind: "quote",
      number: "SOU-2311",
      title: "Quay 12 Residences — interiors fit-out",
      description: "Typical-floor interiors, amenity level, and lobby millwork.",
      amount: 6720000,
      status: "accepted",
      issued_on: isoDate(-300),
      due_on: isoDate(-270),
      notes: null,
    },
    {
      client_id: harbour.id,
      project_id: quay.id,
      kind: "invoice",
      number: "FAC-2407-08",
      title: "Progress billing 08 — envelope",
      description: "Curtain wall, balcony rails, and roofing through July.",
      amount: 3180000,
      status: "overdue",
      issued_on: isoDate(-45),
      due_on: isoDate(-15),
      notes: "Follow-up sent to Harbour Development AP.",
    },
  ]);
}

export async function hasAnyUsers() {
  await dbReady;
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return existing.length > 0;
}

export async function createFirstAdmin(input: { name: string; email: string; password: string }) {
  await dbReady;
  if (await hasAnyUsers()) return "login.setup.exists";
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;
  if (!name || !email || password.length < 8) return "login.setup.invalid";
  await db.insert(schema.users).values({
    name,
    email,
    password: await hashPassword(password),
    user_type: "internal",
    title: "Administrator",
    phone: null,
    is_active: 1,
    is_admin: 1,
    avatar_initials: initials(name),
    locale: "en",
    theme: "light",
    all_clients: 1,
  });
  await ensureDefaultGroups();
  return null;
}

async function upsertUser(values: {
  name: string;
  email: string;
  password: string;
  user_type: "internal" | "external";
  title: string;
  phone: string;
  is_admin: number;
  locale: "en" | "fr";
  all_clients?: number;
}) {
  const email = values.email.toLowerCase();
  const found = await db.select().from(schema.users).where(eq(schema.users.email, email));
  const hashed = isHashedPassword(values.password) ? values.password : await hashPassword(values.password);
  if (found[0]) {
    await db
      .update(schema.users)
      .set({
        password: found[0].password && isHashedPassword(found[0].password) ? found[0].password : hashed,
        is_active: 1,
        is_admin: values.is_admin,
        name: values.name,
        user_type: values.user_type,
      })
      .where(eq(schema.users.id, found[0].id));
    return found[0];
  }
  const [row] = await db
    .insert(schema.users)
    .values({
      name: values.name,
      email,
      password: hashed,
      user_type: values.user_type,
      title: values.title,
      phone: values.phone,
      is_active: 1,
      is_admin: values.is_admin,
      avatar_initials: initials(values.name),
      locale: values.locale,
      theme: "light",
      all_clients: values.all_clients ?? (values.user_type === "internal" ? 1 : 0),
    })
    .returning();
  return row;
}

async function seedIfEmptyInner() {
  await dbReady;
  await migrateLegacyBrand();
  await ensureDefaultGroups();

  if (await hasAnyUsers()) return;

  await upsertUser({
    name: "Administrator",
    email: "admin@frxconstruction.ca",
    password: "admin123",
    user_type: "internal",
    title: "Director of Operations",
    phone: "450-555-0100",
    is_admin: 1,
    locale: "en",
    all_clients: 1,
  });
}
