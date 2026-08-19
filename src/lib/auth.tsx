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

function toSession(row: typeof schema.users.$inferSelect): SessionUser {
  const { password: _pw, ...rest } = row;
  void _pw;
  return {
    ...rest,
    user_type: rest.user_type as SessionUser["user_type"],
    locale: rest.locale === "fr" ? "fr" : "en",
    theme: rest.theme === "dark" ? "dark" : "light",
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
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const id = Number(raw);
          if (!Number.isNaN(id)) {
            const rows = await db.select().from(schema.users).where(eq(schema.users.id, id));
            if (!cancelled && rows[0] && rows[0].is_active) {
              const session = toSession(rows[0]);
              setRealUser(session);
              applyPrefs(session);
              const mode = session.is_admin ? readViewAs() : "admin";
              await loadPermissions(rows[0].id, mode, Boolean(session.is_admin));
            } else {
              localStorage.removeItem(SESSION_KEY);
            }
          }
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
    try {
      await dbReady;
    } catch (err) {
      console.error("database not ready", err);
      return "login.error.invalid";
    }
    try {
      const rows = await db.select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase()));
      const fallback = rows.length
        ? rows
        : await db.select().from(schema.users).where(eq(schema.users.email, email.trim()));
      const match = fallback.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!match || match.password !== password) return "login.error.invalid";
      if (!match.is_active) return "login.error.inactive";
      const session = toSession(match);
      setRealUser(session);
      setViewAsState("admin");
      localStorage.removeItem(VIEW_AS_KEY);
      applyPrefs(session);
      localStorage.setItem(SESSION_KEY, String(match.id));
      await loadPermissions(match.id, "admin", Boolean(session.is_admin));
      return null;
    } catch (err) {
      console.error("login failed", err);
      return "login.error.invalid";
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
      if (!rows[0] || rows[0].password !== current) return "profile.passwordWrong";
      await db.update(schema.users).set({ password: next }).where(eq(schema.users.id, realUser.id));
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
