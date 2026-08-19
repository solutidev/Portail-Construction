import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { Project, TimePunch } from "./types";

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function projectFence(project: Project) {
  if (!project.require_geofence) return null;
  if (project.geo_lat == null || project.geo_lng == null) return null;
  return {
    lat: project.geo_lat,
    lng: project.geo_lng,
    radius: project.geo_radius_m && project.geo_radius_m > 0 ? project.geo_radius_m : 200,
  };
}

export function minutesBetween(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function weekStartISO(value = new Date()) {
  const d = new Date(value);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type TimeEntry = {
  punchIn: TimePunch;
  punchOut: TimePunch | null;
  minutes: number;
  open: boolean;
};

export function pairPunches(punches: TimePunch[]): TimeEntry[] {
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  const entries: TimeEntry[] = [];
  let open: TimePunch | null = null;
  for (const punch of sorted) {
    if (punch.kind === "in") {
      if (open) {
        entries.push({ punchIn: open, punchOut: null, minutes: 0, open: true });
      }
      open = punch;
      continue;
    }
    if (open) {
      entries.push({
        punchIn: open,
        punchOut: punch,
        minutes: minutesBetween(open.punched_at, punch.punched_at),
        open: false,
      });
      open = null;
    }
  }
  if (open) entries.push({ punchIn: open, punchOut: null, minutes: 0, open: true });
  return entries.reverse();
}

export async function loadUserPunches(userId: number) {
  return (await db
    .select()
    .from(schema.time_punches)
    .where(eq(schema.time_punches.user_id, userId))
    .orderBy(desc(schema.time_punches.punched_at))) as TimePunch[];
}

export async function openPunchForUser(userId: number) {
  const punches = await loadUserPunches(userId);
  const last = punches[0];
  return last?.kind === "in" ? last : null;
}

export async function createPunch(input: {
  userId: number;
  projectId: number;
  kind: "in" | "out";
  punchedAt: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  status: string;
  note?: string | null;
}) {
  const [row] = await db
    .insert(schema.time_punches)
    .values({
      user_id: input.userId,
      project_id: input.projectId,
      kind: input.kind,
      punched_at: input.punchedAt,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracy: input.accuracy ?? null,
      distance_m: input.distance ?? null,
      status: input.status,
      note: input.note ?? null,
    })
    .returning();
  return row as TimePunch;
}

export async function loadProjectPunches(projectId: number) {
  return (await db
    .select()
    .from(schema.time_punches)
    .where(eq(schema.time_punches.project_id, projectId))
    .orderBy(desc(schema.time_punches.punched_at))) as TimePunch[];
}

export async function loadAllPunches() {
  return (await db.select().from(schema.time_punches).orderBy(desc(schema.time_punches.punched_at))) as TimePunch[];
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation-unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
    });
  });
}

export async function lastInForUserOnProject(userId: number, projectId: number) {
  const rows = (await db
    .select()
    .from(schema.time_punches)
    .where(and(eq(schema.time_punches.user_id, userId), eq(schema.time_punches.project_id, projectId)))
    .orderBy(desc(schema.time_punches.punched_at))) as TimePunch[];
  return rows[0] ?? null;
}
