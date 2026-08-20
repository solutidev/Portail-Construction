import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 120_000;
const KEY_LEN = 32;

export function isHashedPassword(value: string) {
  return value.startsWith("pbkdf2$");
}

export function hashPassword(plain: string) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(plain, salt, ITERATIONS, KEY_LEN, "sha256");
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string) {
  if (!stored) return false;
  if (!isHashedPassword(stored)) return stored === plain;
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]) || ITERATIONS;
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  const actual = pbkdf2Sync(plain, salt, iterations, expected.length, "sha256");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function hashPasswordParams(sql: string, params: unknown[]) {
  const next = [...params];
  const insert = sql.match(/insert\s+into\s+"?users"?\s*\(([^)]+)\)/i);
  if (insert) {
    const cols = insert[1].split(",").map((s) => s.replace(/"/g, "").trim().toLowerCase());
    const idx = cols.indexOf("password");
    if (idx >= 0 && typeof next[idx] === "string" && next[idx] && !isHashedPassword(String(next[idx]))) {
      next[idx] = hashPassword(String(next[idx]));
    }
  }
  if (/update\s+"?users"?/i.test(sql)) {
    const m = sql.match(/"?password"?\s*=\s*\$(\d+)/i);
    if (m) {
      const i = Number(m[1]) - 1;
      if (typeof next[i] === "string" && next[i] && !isHashedPassword(String(next[i]))) {
        next[i] = hashPassword(String(next[i]));
      }
    }
  }
  return next;
}
