import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "../db";
import { hashPassword, verifyPassword } from "./password";
import { SESSION_KEY, VIEW_AS_KEY } from "./constants";
import { createFirstAdmin, hasAnyUsers, seedIfEmpty } from "./seed";
import { loadAccessBundle, loadDefaultRolePermissions, mergeGroupPermissions } from "./access";
import type { Locale, Permission, SessionUser, ThemePref, ViewAsMode } from "./types";
import { can } from "./permissions";
import type { Action, ModuleId } from "./types";
import { useI18n } from "./i18n";
import { useTheme } from "./theme";

function readViewAs(): ViewAsMode {
  if (typeof window === "undefined") return "admin";
  const raw = localStorage.getItem(VIEW_AS_KEY);
  return raw === "staff" || raw === "client" ? raw : "admin";
}

function applyViewAs(session: SessionUser, mode: ViewAsMode): SessionUser {
  if (mode === "staff") {
    return { ...session, is_admin: 0, user_type: "internal", title: session.title || "Staff", view_as: "staff" };
  }
  if (mode === "client") {
    return { ...session, is_admin: 0, user_type: "external", title: "Client", view_as: "client" };
  }
  return { ...session, view_as: "admin" };
}

type AuthContextValue = {
  user: SessionUser | null;
  realUser: SessionUser | null;
  viewAs: ViewAsMode;
  setViewAs: (mode: ViewAsMode) => void;
  permissions: Permission[];
  ready: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  needsSetup: boolean;
  setupAdmin: (input: { name: string; email: string; password: string }) => Promise<string | null>;
  logout: () => void;
  refreshPermissions: () => Promise<void>;
  updateProfile: (patch: {
    name?: string;
    title?: string | null;
    phone?: string | null;
    locale?: Locale;
    theme?: ThemePref;
  }) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<string | null>;
  can: (module: ModuleId, action: Action, scope?: { projectId?: number; clientId?: number }) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toSession(row: Record<string, unknown> | typeof schema.users.$inferSelect): SessionUser {
  const data = row as Record<string, unknown>;
  return {
    id: Number(data.id),
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    user_type: data.user_type === "external" ? "external" : "internal",
    title: data.title == null ? null : String(data.title),
    phone: data.phone == null ? null : String(data.phone),
    is_active: Number(data.is_active ?? 1),
    is_admin: Number(data.is_admin ?? 0),
    avatar_initials: data.avatar_initials == null ? null : String(data.avatar_initials),
    locale: data.locale === "fr" ? "fr" : "en",
    theme: data.theme === "dark" ? "dark" : "light",
    all_clients: Number(data.all_clients ?? 1),
    created_at: (data.created_at as Date) ?? new Date(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<SessionUser | null>(null);
  const [viewAs, setViewAsState] = useState<ViewAsMode>(readViewAs);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { setLocale } = useI18n();
  const { setTheme } = useTheme();
  const user = useMemo(
    () => (realUser && realUser.is_admin ? applyViewAs(realUser, viewAs) : realUser),
    [realUser, viewAs],
  );

  const applyPrefs = useCallback(
    (session: SessionUser) => {
      setLocale(session.locale);
      setTheme(session.theme);
    },
    [setLocale, setTheme],
  );

  const loadPermissions = useCallback(async (userId: number, mode: ViewAsMode = "admin", isAdmin = false) => {
    if (isAdmin && mode === "staff") {
      setPermissions(await loadDefaultRolePermissions(userId, "internal"));
      return;
    }
    if (isAdmin && mode === "client") {
      setPermissions(await loadDefaultRolePermissions(userId, "external"));
      return;
    }
    const rows = (await db
      .select()
      .from(schema.user_permissions)
      .where(eq(schema.user_permissions.user_id, userId))) as Permission[];
    const bundle = await loadAccessBundle(userId);
    setPermissions([...rows, ...mergeGroupPermissions(userId, bundle)]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await seedIfEmpty();
        if (!(await hasAnyUsers())) setNeedsSetup(true);
        const res = await fetch("/api/db", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "session" }),
        });
        const data = (await res.json().catch(() => ({}))) as { user?: Record<string, unknown> };
        if (!cancelled && data.user?.id) {
          const session = toSession(data.user);
          setRealUser(session);
          applyPrefs(session);
          const mode = session.is_admin ? readViewAs() : "admin";
          await loadPermissions(session.id, mode, Boolean(session.is_admin));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (err) {
        console.error("auth bootstrap failed", err);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPermissions, applyPrefs]);

  const login = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    try {
      try {
        const res = await fetch("/api/db", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email: cleanEmail, password: cleanPassword }),
        });
        let data: Record<string, unknown> = {};
        try {
          data = (await res.json()) as Record<string, unknown>;
        } catch {
          data = {};
        }
        if (res.ok && !data.error && (data.user as Record<string, unknown> | undefined)?.id) {
          const session = toSession(data.user as Record<string, unknown>);
          setRealUser(session);
          setViewAsState("admin");
          localStorage.removeItem(VIEW_AS_KEY);
          applyPrefs(session);
          localStorage.removeItem(SESSION_KEY);
          try {
            await loadPermissions(session.id, "admin", Boolean(session.is_admin));
          } catch (err) {
            console.error("permissions after login failed", err);
          }
          return null;
        }
        if (res.ok && data.error) return String(data.error);
        if (res.status === 401 || res.status === 403) return String(data.error || "login.error.invalid");
      } catch {
        /* fall through to local store when the API is unavailable */
      }
      await dbReady;
      const rows = await db.select().from(schema.users).where(eq(schema.users.email, cleanEmail.toLowerCase()));
      const fallback = rows.length
        ? rows
        : await db.select().from(schema.users).where(eq(schema.users.email, cleanEmail));
      const match = fallback.find((u) => u.email.toLowerCase() === cleanEmail.toLowerCase());
      if (!match || !(await verifyPassword(cleanPassword, match.password))) return "login.error.invalid";
      if (!match.is_active) return "login.error.inactive";
      const session = toSession(match);
      setRealUser(session);
      setViewAsState("admin");
      localStorage.removeItem(VIEW_AS_KEY);
      applyPrefs(session);
      localStorage.removeItem(SESSION_KEY);
      await loadPermissions(match.id, "admin", Boolean(session.is_admin));
      return null;
    } catch (err) {
      console.error("login failed", err);
      return err instanceof Error ? err.message : "login.error.invalid";
    }
  }, [loadPermissions, applyPrefs]);

  const setupAdmin = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const err = await createFirstAdmin(input);
      if (err) return err;
      setNeedsSetup(false);
      return login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    setRealUser(null);
    setViewAsState("admin");
    setPermissions([]);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(VIEW_AS_KEY);
    void fetch("/api/db", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
  }, []);

  const setViewAs = useCallback(
    (mode: ViewAsMode) => {
      setViewAsState(mode);
      if (mode === "admin") localStorage.removeItem(VIEW_AS_KEY);
      else localStorage.setItem(VIEW_AS_KEY, mode);
      if (realUser) void loadPermissions(realUser.id, mode, Boolean(realUser.is_admin));
    },
    [realUser, loadPermissions],
  );

  const refreshPermissions = useCallback(async () => {
    if (realUser) await loadPermissions(realUser.id, viewAs, Boolean(realUser.is_admin));
  }, [realUser, viewAs, loadPermissions]);

  const updateProfile = useCallback(
    async (patch: {
      name?: string;
      title?: string | null;
      phone?: string | null;
      locale?: Locale;
      theme?: ThemePref;
    }) => {
      if (!realUser) return;
      await db.update(schema.users).set(patch).where(eq(schema.users.id, realUser.id));
      const next = { ...realUser, ...patch };
      setRealUser(next);
      applyPrefs(next);
    },
    [realUser, applyPrefs],
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!realUser) return "login.error.invalid";
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, realUser.id));
      if (!rows[0] || !(await verifyPassword(current, rows[0].password))) return "profile.passwordWrong";
      await db.update(schema.users).set({ password: await hashPassword(next) }).where(eq(schema.users.id, realUser.id));
      return null;
    },
    [realUser],
  );

  const canFn = useCallback(
    (module: ModuleId, action: Action, scope?: { projectId?: number; clientId?: number }) =>
      can(user, permissions, module, action, scope),
    [user, permissions],
  );

  const value = useMemo(
    () => ({
      user,
      realUser,
      viewAs: realUser?.is_admin ? viewAs : "admin",
      setViewAs,
      permissions,
      ready,
      login,
      needsSetup,
      setupAdmin,
      logout,
      refreshPermissions,
      updateProfile,
      changePassword,
      can: canFn,
    }),
    [user, realUser, viewAs, setViewAs, permissions, ready, login, needsSetup, setupAdmin, logout, refreshPermissions, updateProfile, changePassword, canFn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
