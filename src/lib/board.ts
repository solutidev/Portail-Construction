import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { BoardColumn } from "./types";

export const BOARD_COLORS = [
  { id: "sky", swatch: "bg-sky-500", name: "bg-sky-500/15 text-sky-800 border-sky-500/25 dark:text-sky-300" },
  { id: "emerald", swatch: "bg-emerald-500", name: "bg-emerald-500/15 text-emerald-800 border-emerald-500/25 dark:text-emerald-300" },
  { id: "amber", swatch: "bg-amber-500", name: "bg-amber-500/18 text-amber-900 border-amber-500/30 dark:text-amber-300" },
  { id: "slate", swatch: "bg-slate-500", name: "bg-slate-500/15 text-slate-800 border-slate-500/25 dark:text-slate-300" },
  { id: "primary", swatch: "bg-primary", name: "bg-primary/18 text-foreground border-primary/35" },
  { id: "rose", swatch: "bg-rose-500", name: "bg-rose-500/15 text-rose-800 border-rose-500/25 dark:text-rose-300" },
  { id: "violet", swatch: "bg-violet-500", name: "bg-violet-500/15 text-violet-800 border-violet-500/25 dark:text-violet-300" },
  { id: "orange", swatch: "bg-orange-500", name: "bg-orange-500/18 text-orange-900 border-orange-500/30 dark:text-orange-300" },
  { id: "teal", swatch: "bg-teal-500", name: "bg-teal-500/15 text-teal-800 border-teal-500/25 dark:text-teal-300" },
  { id: "concrete", swatch: "bg-[#51514E]", name: "bg-[#51514E]/12 text-[#51514E] border-[#51514E]/25 dark:text-[#D1D3D4]" },
] as const;

export type BoardColorId = (typeof BOARD_COLORS)[number]["id"];

const SYSTEM: { slug: string; label: string; sort_order: number; color: BoardColorId }[] = [
  { slug: "planning", label: "Planning", sort_order: 0, color: "sky" },
  { slug: "active", label: "Active", sort_order: 1, color: "emerald" },
  { slug: "on_hold", label: "On hold", sort_order: 2, color: "amber" },
  { slug: "completed", label: "Completed", sort_order: 3, color: "slate" },
];

export function boardColor(id: string | null | undefined) {
  return BOARD_COLORS.find((c) => c.id === id) ?? BOARD_COLORS[3];
}

export async function ensureBoardColumns() {
  const existing = (await db.select().from(schema.board_columns)) as BoardColumn[];
  if (existing.length > 0) return existing.sort((a, b) => a.sort_order - b.sort_order);

  const inserted: BoardColumn[] = [];
  for (const col of SYSTEM) {
    const [row] = await db
      .insert(schema.board_columns)
      .values({ ...col, is_system: 1 })
      .returning();
    inserted.push(row as BoardColumn);
  }
  return inserted;
}

export function slugifyColumn(label: string, taken: Set<string>) {
  const base =
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "section";
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export async function loadBoardColumns() {
  const cols = await ensureBoardColumns();
  return cols.sort((a, b) => a.sort_order - b.sort_order);
}

export async function createBoardColumn(label: string, color: string = "slate") {
  const cols = await loadBoardColumns();
  const slug = slugifyColumn(label, new Set(cols.map((c) => c.slug)));
  const sort_order = (cols[cols.length - 1]?.sort_order ?? -1) + 1;
  const [row] = await db
    .insert(schema.board_columns)
    .values({ slug, label: label.trim(), sort_order, is_system: 0, color })
    .returning();
  return row as BoardColumn;
}

export async function renameBoardColumn(id: number, label: string) {
  await db
    .update(schema.board_columns)
    .set({ label: label.trim(), is_system: 0 })
    .where(eq(schema.board_columns.id, id));
}

export async function updateBoardColumnColor(id: number, color: string) {
  await db.update(schema.board_columns).set({ color }).where(eq(schema.board_columns.id, id));
}

export async function deleteBoardColumn(id: number) {
  const cols = await loadBoardColumns();
  const target = cols.find((c) => c.id === id);
  if (!target || cols.length <= 1) return null;
  const fallback = cols.find((c) => c.id !== id);
  if (!fallback) return null;
  await db
    .update(schema.projects)
    .set({ status: fallback.slug })
    .where(eq(schema.projects.status, target.slug));
  await db.delete(schema.board_columns).where(eq(schema.board_columns.id, id));
  return fallback.slug;
}

export async function persistProjectMove(projectId: number, status: string, sortOrder: number) {
  await db
    .update(schema.projects)
    .set({ status, sort_order: sortOrder })
    .where(eq(schema.projects.id, projectId));
}

export async function reorderBoardColumns(orderedIds: number[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(schema.board_columns).set({ sort_order: index }).where(eq(schema.board_columns.id, id)),
    ),
  );
}
