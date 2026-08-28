import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { eq } from "drizzle-orm";
import { Plus, Search, Users } from "lucide-react";
import { db, dbReady, schema } from "../../db";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { groupFitsUser, isDefaultStaffGroup, setUserGroups } from "@/lib/access";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSkeleton } from "@/components/Skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { GroupPicker } from "./GroupPicker";
import { GroupsEditor } from "./GroupsEditor";
import type { AccessGroup, User, UserAccessGroup } from "@/lib/types";
import { hashPassword, randomPassword } from "@/lib/password";

const empty = {
  name: "",
  email: "",
  password: "",
  title: "",
  phone: "",
  is_admin: false,
  groupIds: [] as number[],
};

export function ConfigInternalUsersPage({ embedded = false }: { embedded?: boolean }) {
  const { realUser } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<User[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [memberships, setMemberships] = useState<UserAccessGroup[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    await dbReady;
    const rows = (await db.select().from(schema.users)) as User[];
    setPeople(rows.filter((p) => p.user_type === "internal"));
    setGroups((await db.select().from(schema.access_groups)) as AccessGroup[]);
    setMemberships((await db.select().from(schema.user_access_groups)) as UserAccessGroup[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const internalGroups = useMemo(
    () => groups.filter((g) => groupFitsUser(g, "internal")),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => [p.name, p.email, p.title].some((v) => v?.toLowerCase().includes(q)));
  }, [people, query]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!realUser?.is_admin) return;
    setSaving(true);
    setFormError(null);
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();
    try {
      const existing = await db.select().from(schema.users).where(eq(schema.users.email, email));
      if (existing.length) {
        setFormError("A user with this email already exists.");
        return;
      }
      await db.insert(schema.users).values({
        name,
        email,
        password: await hashPassword(form.password.trim() || randomPassword()),
        user_type: "internal",
        title: form.title.trim() || null,
        phone: form.phone.trim() || null,
        is_active: 1,
        is_admin: form.is_admin ? 1 : 0,
        avatar_initials: initials(name),
        locale: "en",
        theme: "light",
        all_clients: 1,
      });
      const createdRows = (await db.select().from(schema.users).where(eq(schema.users.email, email))) as User[];
      const created = createdRows[0];
      if (!created) throw new Error("User was not saved");
      if (form.groupIds.length) await setUserGroups(created.id, form.groupIds);
      await logActivity({
        action: "created user",
        details: `${name} (internal)`,
        userId: realUser.id,
      });
      setOpen(false);
      setForm(empty);
      await load();
    } catch (err) {
      console.error("create user failed", err);
      setFormError(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (!realUser?.is_admin) {
    return (
      <EmptyState
        icon={<Users className="size-5" />}
        title={t("config.restricted")}
        description={t("config.restrictedDesc")}
      />
    );
  }

  function openCreate() {
    setForm({
      ...empty,
      password: randomPassword(),
      groupIds: internalGroups.filter(isDefaultStaffGroup).map((g) => g.id),
    });
    setOpen(true);
  }

  return (
    <div>
      {embedded ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("config.internal.title")}</p>
            <p className="text-xs text-muted-foreground">{t("config.internal.desc")}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("config.internal.new")}
          </Button>
        </div>
      ) : (
        <PageHeader
          eyebrow={t("config.eyebrow")}
          title={t("config.internal.title")}
          description={t("config.internal.desc")}
          actions={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("config.internal.new")}
            </Button>
          }
        />
      )}

      <Tabs defaultValue="users" className="gap-5">
        <TabsList>
          <TabsTrigger value="users">{t("config.internal.tab.users")}</TabsTrigger>
          <TabsTrigger value="groups">{t("config.internal.tab.groups")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="relative mb-5 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("people.search")}
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title={t("people.noMatch")}
              description={t("people.noMatchDesc")}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <ul className="divide-y">
                {filtered.map((p) => {
                  const assigned = memberships
                    .filter((m) => m.user_id === p.id)
                    .map((m) => groups.find((g) => g.id === m.group_id)?.name)
                    .filter(Boolean);
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/config/users/${p.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <UserAvatar name={p.name} hint={p.avatar_initials} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {p.name}
                            {p.is_admin ? (
                              <span className="ml-2 text-[11px] font-medium text-primary">{t("nav.admin")}</span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.title || "—"} · {p.email}
                          </p>
                          {assigned.length > 0 && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{assigned.join(" · ")}</p>
                          )}
                        </div>
                        <StatusBadge value={p.is_active ? "active" : "inactive"} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups">
          <GroupsEditor compact audience="internal" />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("config.internal.new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="grid gap-4">
            <div className="space-y-1.5">
              <Label>{t("people.fullName")}</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("people.email")}</Label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("people.titleField")}</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("people.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("people.tempPassword")}</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_admin}
                onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
              />
              {t("people.adminCheck")}
            </label>
            <GroupPicker
              groups={internalGroups}
              selected={form.groupIds}
              onChange={(groupIds) => setForm({ ...form, groupIds })}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("people.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("people.creating") : t("people.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
