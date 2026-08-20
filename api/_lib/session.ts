import { randomBytes } from "node:crypto";

const COOKIE = "frx_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export function requireSessionSecret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is required (min 16 characters). Do not reuse POSTGRES_PASSWORD.");
    }
    return "dev-preview-session-secret";
  }
  return value;
}

export function newSessionToken() {
  requireSessionSecret();
  return randomBytes(32).toString("hex");
}

export function sessionMaxAgeSeconds() {
  return MAX_AGE;
}

function cookieSecureFlag() {
  // Only mark Secure when the site is actually served over HTTPS.
  // NODE_ENV=production on http://server-ip:8080 would otherwise drop the cookie.
  if (process.env.COOKIE_SECURE === "1" || process.env.COOKIE_SECURE === "true") return "; Secure";
  return "";
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
