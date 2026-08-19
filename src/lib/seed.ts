import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "../db";
import { initials, isoDate } from "./format";
import { ensureDefaultGroups } from "./access";

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
    if (user.password === "forge123") {
      await db.update(schema.users).set({ password: "frx123" }).where(eq(schema.users.id, user.id));
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

function isProductionBuild() {
  return import.meta.env.VITE_PRODUCTION === "1" || import.meta.env.PROD;
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
    password,
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

async function seedIfEmptyInner() {
  await dbReady;
  await migrateLegacyBrand();
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) {
    await ensureDefaultGroups();
    if (!isProductionBuild()) await seedBillingIfEmpty();
    return;
  }
  if (isProductionBuild()) {
    await ensureDefaultGroups();
    return;
  }

  const [admin] = await db
    .insert(schema.users)
    .values({
      name: "Camille Bouchard",
      email: "admin@frxconstruction.ca",
      password: "admin123",
      user_type: "internal",
      title: "Director of Operations",
      phone: "450-555-0100",
      is_active: 1,
      is_admin: 1,
      avatar_initials: initials("Camille Bouchard"),
      locale: "en",
      theme: "light",
      all_clients: 1,
    })
    .returning();

  const [pm] = await db
    .insert(schema.users)
    .values({
      name: "Marc Tremblay",
      email: "marc@frxconstruction.ca",
      password: "frx123",
      user_type: "internal",
      title: "Senior Project Manager",
      phone: "514-555-0142",
      is_active: 1,
      is_admin: 0,
      avatar_initials: initials("Marc Tremblay"),
      locale: "fr",
      theme: "light",
    })
    .returning();

  const [superint] = await db
    .insert(schema.users)
    .values({
      name: "Léa Gagnon",
      email: "lea@frxconstruction.ca",
      password: "frx123",
      user_type: "internal",
      title: "Superintendent",
      phone: "438-555-0198",
      is_active: 1,
      is_admin: 0,
      avatar_initials: initials("Léa Gagnon"),
      locale: "fr",
      theme: "light",
    })
    .returning();

  const [safety] = await db
    .insert(schema.users)
    .values({
      name: "Noah Patel",
      email: "noah@frxconstruction.ca",
      password: "frx123",
      user_type: "internal",
      title: "Safety Officer",
      phone: "450-555-0176",
      is_active: 1,
      is_admin: 0,
      avatar_initials: initials("Noah Patel"),
      locale: "en",
      theme: "light",
    })
    .returning();

  const [clientOwner] = await db
    .insert(schema.users)
    .values({
      name: "Sophie Lavoie",
      email: "sophie@nordique.com",
      password: "client123",
      user_type: "external",
      title: "VP Real Estate",
      phone: "514-555-2201",
      is_active: 1,
      is_admin: 0,
      avatar_initials: initials("Sophie Lavoie"),
      locale: "fr",
      theme: "light",
      all_clients: 0,
    })
    .returning();

  const [clientPm] = await db
    .insert(schema.users)
    .values({
      name: "Julien Roy",
      email: "julien@nordique.com",
      password: "client123",
      user_type: "external",
      title: "Owner's Representative",
      phone: "514-555-2208",
      is_active: 1,
      is_admin: 0,
      avatar_initials: initials("Julien Roy"),
      locale: "fr",
      theme: "light",
    })
    .returning();

  const [harbourOwner] = await db
    .insert(schema.users)
    .values({
      name: "Amelia Chen",
      email: "amelia@harbourdev.ca",
      password: "client123",
      user_type: "external",
      title: "Development Director",
      phone: "416-555-3310",
      is_active: 1,
      is_admin: 0,
      avatar_initials: initials("Amelia Chen"),
      locale: "en",
      theme: "light",
    })
    .returning();

  const [nordique] = await db
    .insert(schema.clients)
    .values({
      name: "Sophie Lavoie",
      company_name: "Nordique Immobilier",
      email: "projects@nordique.com",
      phone: "514-555-2200",
      address: "1200 Boulevard René-Lévesque O",
      city: "Montréal",
      state: "QC",
      zip: "H3B 4W8",
      notes: "Long-term commercial client. Prefers weekly owner meetings on Thursday mornings.",
      status: "active",
    })
    .returning();

  const [harbour] = await db
    .insert(schema.clients)
    .values({
      name: "Amelia Chen",
      company_name: "Harbour Development",
      email: "build@harbourdev.ca",
      phone: "416-555-3300",
      address: "88 Queens Quay W",
      city: "Toronto",
      state: "ON",
      zip: "M5J 0B8",
      notes: "Waterfront mixed-use portfolio. Strict safety reporting requirements.",
      status: "active",
    })
    .returning();

  await db.insert(schema.clients).values({
    name: "École Saint-Laurent",
    company_name: "Commission scolaire de Montréal",
    email: "travaux@csdm.qc.ca",
    phone: "514-555-4400",
    address: "3737 Rue Sherbrooke E",
    city: "Montréal",
    state: "QC",
    zip: "H1X 3B3",
    notes: "Public-sector client. All change orders require board approval.",
    status: "prospect",
  });

  await db.insert(schema.client_users).values([
    { client_id: nordique.id, user_id: clientOwner.id, is_primary: 1 },
    { client_id: nordique.id, user_id: clientPm.id, is_primary: 0 },
    { client_id: harbour.id, user_id: harbourOwner.id, is_primary: 1 },
  ]);

  const [plaza] = await db
    .insert(schema.projects)
    .values({
      client_id: nordique.id,
      name: "Plaza Saint-Laurent",
      project_number: "FOR-2408",
      description: "Six-storey mixed-use podium with ground-floor retail and 84 residential units.",
      status: "active",
      phase: "structure",
      project_type: "Mixed-use",
      address: "2150 Rue Saint-Laurent",
      city: "Montréal",
      start_date: isoDate(-120),
      end_date: isoDate(240),
      budget: 18400000,
      spent: 7420000,
      sort_order: 0,
    })
    .returning();

  const [warehouse] = await db
    .insert(schema.projects)
    .values({
      client_id: nordique.id,
      name: "Anjou Cold Storage",
      project_number: "FOR-2412",
      description: "Refrigerated distribution facility with 42,000 sq ft of freezer space.",
      status: "planning",
      phase: "preconstruction",
      project_type: "Industrial",
      address: "8900 Boulevard Métropolitain E",
      city: "Anjou",
      start_date: isoDate(30),
      end_date: isoDate(320),
      budget: 9600000,
      spent: 410000,
      sort_order: 0,
    })
    .returning();

  const [quay] = await db
    .insert(schema.projects)
    .values({
      client_id: harbour.id,
      name: "Quay 12 Residences",
      project_number: "FOR-2319",
      description: "Waterfront condominium tower, 22 storeys, LEED Gold target.",
      status: "active",
      phase: "envelope",
      project_type: "Residential",
      address: "12 Harbour Street",
      city: "Toronto",
      start_date: isoDate(-280),
      end_date: isoDate(160),
      budget: 42800000,
      spent: 27100000,
      sort_order: 0,
    })
    .returning();

  await db.insert(schema.project_members).values([
    { project_id: plaza.id, user_id: pm.id, role: "Project Manager" },
    { project_id: plaza.id, user_id: superint.id, role: "Superintendent" },
    { project_id: plaza.id, user_id: safety.id, role: "Safety Officer" },
    { project_id: plaza.id, user_id: clientOwner.id, role: "Client Contact" },
    { project_id: plaza.id, user_id: clientPm.id, role: "Owner's Representative" },
    { project_id: warehouse.id, user_id: pm.id, role: "Project Manager" },
    { project_id: warehouse.id, user_id: clientOwner.id, role: "Client Contact" },
    { project_id: quay.id, user_id: pm.id, role: "Project Manager" },
    { project_id: quay.id, user_id: superint.id, role: "Superintendent" },
    { project_id: quay.id, user_id: harbourOwner.id, role: "Client Contact" },
  ]);

  const projectModules = [
    "dashboard",
    "calendar",
    "budget",
    "tasks",
    "documents",
    "rfis",
    "change_orders",
    "daily_logs",
    "punch",
    "safety",
    "team",
  ];

  // Marc: full project access, no user admin
  for (const project of [plaza, warehouse, quay]) {
    for (const module of projectModules) {
      await db.insert(schema.user_permissions).values({
        user_id: pm.id,
        module,
        scope_type: "project",
        scope_id: project.id,
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: module === "budget" ? 0 : 1,
      });
    }
  }
  await db.insert(schema.user_permissions).values({
    user_id: pm.id,
    module: "clients",
    scope_type: "global",
    scope_id: 0,
    can_view: 1,
    can_create: 1,
    can_edit: 1,
    can_delete: 0,
  });

  // Léa: site-facing modules on plaza + quay
  for (const project of [plaza, quay]) {
    for (const module of ["dashboard", "calendar", "tasks", "daily_logs", "punch", "safety", "team", "documents"]) {
      await db.insert(schema.user_permissions).values({
        user_id: superint.id,
        module,
        scope_type: "project",
        scope_id: project.id,
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: 0,
      });
    }
  }

  // Noah: safety + daily logs
  for (const project of [plaza, quay]) {
    for (const module of ["dashboard", "daily_logs", "safety"]) {
      await db.insert(schema.user_permissions).values({
        user_id: safety.id,
        module,
        scope_type: "project",
        scope_id: project.id,
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: 0,
      });
    }
  }

  // Sophie: client view on Nordique projects
  for (const project of [plaza, warehouse]) {
    for (const module of ["dashboard", "calendar", "documents", "change_orders", "punch", "team"]) {
      await db.insert(schema.user_permissions).values({
        user_id: clientOwner.id,
        module,
        scope_type: "project",
        scope_id: project.id,
        can_view: 1,
        can_create: module === "change_orders" ? 1 : 0,
        can_edit: 0,
        can_delete: 0,
      });
    }
  }

  // Julien: plaza only, more limited
  for (const module of ["dashboard", "calendar", "documents", "punch"]) {
    await db.insert(schema.user_permissions).values({
      user_id: clientPm.id,
      module,
      scope_type: "project",
      scope_id: plaza.id,
      can_view: 1,
      can_create: 0,
      can_edit: 0,
      can_delete: 0,
    });
  }

  // Amelia: Quay 12
  for (const module of ["dashboard", "calendar", "budget", "documents", "change_orders", "punch", "team"]) {
    await db.insert(schema.user_permissions).values({
      user_id: harbourOwner.id,
      module,
      scope_type: "project",
      scope_id: quay.id,
      can_view: 1,
      can_create: 0,
      can_edit: 0,
      can_delete: 0,
    });
  }

  for (const userId of [clientOwner.id, clientPm.id, harbourOwner.id]) {
    await db.insert(schema.user_permissions).values({
      user_id: userId,
      module: "billing",
      scope_type: "global",
      scope_id: 0,
      can_view: 1,
      can_create: 0,
      can_edit: 0,
      can_delete: 0,
    });
  }

  await db.insert(schema.project_tasks).values([
    {
      project_id: plaza.id,
      title: "Level 4 slab pour",
      description: "Coordinate pump and rebar inspection before 06:00 pour.",
      start_date: isoDate(-4),
      end_date: isoDate(2),
      status: "in_progress",
      priority: "high",
      assigned_to: superint.id,
    },
    {
      project_id: plaza.id,
      title: "MEP rough-in — podium",
      description: "Electrical and mechanical sleeves through transfer slab.",
      start_date: isoDate(3),
      end_date: isoDate(28),
      status: "not_started",
      priority: "medium",
      assigned_to: pm.id,
    },
    {
      project_id: plaza.id,
      title: "City inspection — fire separation",
      description: "Book inspector after drywall on P1 corridor.",
      start_date: isoDate(10),
      end_date: isoDate(12),
      status: "blocked",
      priority: "critical",
      assigned_to: pm.id,
    },
    {
      project_id: quay.id,
      title: "Curtain wall levels 8–12",
      description: "Unitized panels arriving Tuesday. Crane reserved 07:00–15:00.",
      start_date: isoDate(-2),
      end_date: isoDate(18),
      status: "in_progress",
      priority: "high",
      assigned_to: superint.id,
    },
    {
      project_id: warehouse.id,
      title: "Geotech confirmation boring",
      description: "Two additional borings on west pad per structural RFI.",
      start_date: isoDate(8),
      end_date: isoDate(14),
      status: "not_started",
      priority: "medium",
      assigned_to: pm.id,
    },
  ]);

  await db.insert(schema.budget_items).values([
    { project_id: plaza.id, category: "General conditions", description: "Site overhead, trailers, temp power", estimated: 920000, actual: 410000, status: "committed" },
    { project_id: plaza.id, category: "Concrete", description: "Foundations, podium, cores", estimated: 4100000, actual: 2680000, status: "invoiced" },
    { project_id: plaza.id, category: "Steel", description: "Structural steel package", estimated: 1850000, actual: 940000, status: "committed" },
    { project_id: plaza.id, category: "MEP", description: "Mechanical, electrical, plumbing", estimated: 3200000, actual: 610000, status: "planned" },
    { project_id: plaza.id, category: "Envelope", description: "Brick, windows, roofing", estimated: 2400000, actual: 180000, status: "planned" },
    { project_id: plaza.id, category: "Contingency", description: "Owner + contractor contingency", estimated: 920000, actual: 74000, status: "planned" },
    { project_id: quay.id, category: "General conditions", description: "Tower crane, hoisting, site", estimated: 2100000, actual: 1680000, status: "invoiced" },
    { project_id: quay.id, category: "Envelope", description: "Unitized curtain wall", estimated: 6400000, actual: 4120000, status: "committed" },
    { project_id: quay.id, category: "Interiors", description: "Suites and common areas", estimated: 7800000, actual: 2100000, status: "planned" },
    { project_id: warehouse.id, category: "Sitework", description: "Cut/fill and utilities", estimated: 780000, actual: 120000, status: "planned" },
  ]);

  await db.insert(schema.calendar_events).values([
    { project_id: plaza.id, title: "Slab 4 pour", event_date: isoDate(1), end_date: isoDate(1), event_type: "milestone", description: "Night pour window 22:00–05:00" },
    { project_id: plaza.id, title: "Rebar inspection", event_date: isoDate(0), end_date: null, event_type: "inspection", description: "City inspector on site 07:30" },
    { project_id: plaza.id, title: "Owner weekly", event_date: isoDate(3), end_date: null, event_type: "meeting", description: "Nordique — trailer conference" },
    { project_id: plaza.id, title: "Glulam delivery", event_date: isoDate(9), end_date: isoDate(9), event_type: "delivery", description: "Retail canopy members" },
    { project_id: quay.id, title: "Curtain wall shipment", event_date: isoDate(2), end_date: isoDate(3), event_type: "delivery", description: "Levels 8–12 cassettes" },
    { project_id: quay.id, title: "Envelope mock-up review", event_date: isoDate(6), end_date: null, event_type: "inspection", description: "Architect + envelope consultant" },
    { project_id: warehouse.id, title: "Kickoff with Nordique", event_date: isoDate(12), end_date: null, event_type: "meeting", description: "Precon alignment" },
  ]);

  await db.insert(schema.documents).values([
    { project_id: plaza.id, name: "Architectural IFC — Rev 12", category: "Drawings", notes: "Issued for construction, stamped.", uploaded_by: pm.id },
    { project_id: plaza.id, name: "Structural steel shop drawings", category: "Submittals", notes: "Approved as noted.", uploaded_by: pm.id },
    { project_id: plaza.id, name: "Building permit 24-8841", category: "Permits", notes: "Expires 2026-03-01.", uploaded_by: admin.id },
    { project_id: quay.id, name: "Envelope specification 08 44 00", category: "Specifications", notes: "Unitized curtain wall.", uploaded_by: pm.id },
    { project_id: quay.id, name: "Progress photos — week 41", category: "Photos", notes: "North and east elevations.", uploaded_by: superint.id },
  ]);

  await db.insert(schema.rfis).values([
    {
      project_id: plaza.id,
      number: "RFI-042",
      title: "Transfer slab sleeve conflict at grid C/4",
      description: "Mechanical 18\" sleeve clashes with post-tension tendon profile. Need alternate route.",
      status: "open",
      assigned_to: pm.id,
      due_date: isoDate(4),
    },
    {
      project_id: plaza.id,
      number: "RFI-038",
      title: "Retail storefront mullion finish",
      description: "Owner requested dark bronze in lieu of clear anodized. Confirm spec change.",
      status: "answered",
      assigned_to: clientPm.id,
      due_date: isoDate(-3),
    },
    {
      project_id: quay.id,
      number: "RFI-117",
      title: "Balcony drain at typical suite",
      description: "Detail 5/A-502 does not show overflow scupper. Confirm required?",
      status: "open",
      assigned_to: pm.id,
      due_date: isoDate(6),
    },
  ]);

  await db.insert(schema.change_orders).values([
    {
      project_id: plaza.id,
      number: "CO-008",
      title: "Upgrade retail storefront to thermally broken",
      description: "Owner-directed upgrade on three street-facing bays.",
      amount: 186400,
      status: "submitted",
    },
    {
      project_id: plaza.id,
      number: "CO-006",
      title: "Additional soil disposal — contaminated",
      description: "Unexpected hydrocarbon in SE corner of excavation.",
      amount: 74200,
      status: "approved",
    },
    {
      project_id: quay.id,
      number: "CO-021",
      title: "Amenity floor millwork revision",
      description: "Lobby reception desk and mailroom millwork per latest interior package.",
      amount: 128000,
      status: "draft",
    },
  ]);

  await db.insert(schema.daily_logs).values([
    {
      project_id: plaza.id,
      log_date: isoDate(-1),
      weather: "Clear, 11°C, light wind",
      crew_count: 42,
      notes: "Formwork for L4 slab complete. Rebar 80%. Crane down 90 minutes for inspection.",
      created_by: superint.id,
    },
    {
      project_id: plaza.id,
      log_date: isoDate(-2),
      weather: "Overcast, 8°C",
      crew_count: 38,
      notes: "Podium MEP sleeves installed on west half. Safety toolbox on fall protection.",
      created_by: superint.id,
    },
    {
      project_id: quay.id,
      log_date: isoDate(-1),
      weather: "Windy, 14°C",
      crew_count: 67,
      notes: "Curtain wall levels 6–7 sealed. Wind delayed hoist after 14:00.",
      created_by: superint.id,
    },
  ]);

  await db.insert(schema.punch_items).values([
    {
      project_id: plaza.id,
      title: "Patch firestop at electrical penetration P1-14",
      location: "P1 corridor, grid B/3",
      status: "open",
      priority: "high",
      assigned_to: superint.id,
      due_date: isoDate(5),
    },
    {
      project_id: plaza.id,
      title: "Touch-up primer on stair 2 stringer",
      location: "Stair 2, levels 1–2",
      status: "in_progress",
      priority: "low",
      assigned_to: superint.id,
      due_date: isoDate(12),
    },
    {
      project_id: quay.id,
      title: "Replace cracked balcony paver — suite 714",
      location: "Level 7, suite 714",
      status: "open",
      priority: "medium",
      assigned_to: superint.id,
      due_date: isoDate(8),
    },
  ]);

  await db.insert(schema.safety_incidents).values([
    {
      project_id: plaza.id,
      incident_date: isoDate(-6),
      severity: "near_miss",
      title: "Load swung inside exclusion zone",
      description: "Crane operator corrected swing before tag line lost control. Toolbox held same day.",
      status: "closed",
    },
    {
      project_id: quay.id,
      incident_date: isoDate(-3),
      severity: "observation",
      title: "Missing toe board on swing stage",
      description: "Corrected on the spot. Subcontractor issued written reminder.",
      status: "closed",
    },
    {
      project_id: quay.id,
      incident_date: isoDate(0),
      severity: "minor",
      title: "Cut on left hand — drywall helper",
      description: "First aid on site. Incident investigation underway.",
      status: "investigating",
    },
  ]);

  await db.insert(schema.activities).values([
    { project_id: plaza.id, client_id: nordique.id, user_id: pm.id, action: "updated budget", details: "Committed steel package invoice #4412" },
    { project_id: plaza.id, client_id: nordique.id, user_id: superint.id, action: "posted daily log", details: isoDate(-1) },
    { project_id: plaza.id, client_id: nordique.id, user_id: pm.id, action: "opened RFI-042", details: "Transfer slab sleeve conflict" },
    { project_id: quay.id, client_id: harbour.id, user_id: superint.id, action: "logged safety incident", details: "Minor — drywall helper" },
    { project_id: quay.id, client_id: harbour.id, user_id: pm.id, action: "scheduled delivery", details: "Curtain wall levels 8–12" },
    { project_id: warehouse.id, client_id: nordique.id, user_id: pm.id, action: "created project", details: "Anjou Cold Storage entered precon" },
    { client_id: nordique.id, user_id: admin.id, action: "added client user", details: "Julien Roy invited as owner's representative" },
  ]);

  await ensureDefaultGroups();
  await seedBillingIfEmpty();
}
