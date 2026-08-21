import { randomBytes } from "node:crypto";

const COOKIE = "frx_session";
const MAX_AGE = 60 * 60 * 24 * 7;
let generatedDevSecret: string | null = null;

export function requireSessionSecret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required (min 16 characters). Do not reuse POSTGRES_PASSWORD.");
  }
  if (!generatedDevSecret) generatedDevSecret = randomBytes(32).toString("hex");
  return generatedDevSecret;
}

export function newSessionToken() {
  requireSessionSecret();
  return randomBytes(32).toString("hex");
}

export function sessionMaxAgeSeconds() {
  return MAX_AGE;
}

function cookieSecureFlag() {
  if (process.env.COOKIE_INSECURE === "1" || process.env.COOKIE_INSECURE === "true") return "";
  return "; Secure";
}

export function sessionCookie(token: string) {
  requireSessionSecret();
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${cookieSecureFlag()}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecureFlag()}`;
}

export function tokenFromCookieHeader(header: string | undefined | null) {
  if (!header) return null;
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const token = match.slice(COOKIE.length + 1).trim();
  if (!token || token.length < 32) return null;
  return token;
}

export function cookieHeaderOf(req: { headers?: Record<string, unknown> | { cookie?: string } }) {
  const headers = req.headers as Record<string, unknown> | undefined;
  if (!headers) return "";
  const raw = headers.cookie ?? headers.Cookie;
  return typeof raw === "string" ? raw : "";
}

export function originAllowed(req: { headers?: Record<string, unknown> }) {
  const headers = req.headers as Record<string, unknown> | undefined;
  if (!headers) return true;
  const origin = typeof headers.origin === "string" ? headers.origin : "";
  if (!origin) return true;
  const host = typeof headers.host === "string" ? headers.host : "";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
