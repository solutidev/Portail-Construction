import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { desc, eq, inArray } from "drizzle-orm";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Receipt,
  Settings2,
  Timer,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { db, dbReady, schema } from "../db";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { money, formatDateTime, percent } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/en";
import type { Client, Project } from "@/lib/types";
import {
  DEFAULT_DASHBOARD,
  loadDashboardLayout,
  saveDashboardLayout,
  type DashboardWidget,
  type DashboardWidgetId,
} from "@/lib/dashboard-layout";

type Activity = typeof schema.activities.$inferSelect;

export function DashboardPage() {
  const { user, can } = useAuth();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<DashboardWidget[]>(() => loadDashboardLayout(user?.id));
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [openRfis, setOpenRfis] = useState(0);
  const [openPunch, setOpenPunch] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    setLayout(loadDashboardLayout(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dbReady;
        const allClients = (await db.select().from(schema.clients)) as Client[];
        const allProjects = (await db.select().from(schema.projects)) as Project[];

        let visibleClients = allClients;
        let visibleProjects = allProjects;

        if (user && !user.is_admin && user.user_type === "external") {
          const links = await db
            .select()
            .from(schema.client_users)
            .where(eq(schema.client_users.user_id, user.id));
          const ids = new Set(links.map((l) => l.client_id));
          visibleClients = allClients.filter((c) => ids.has(c.id));
          visibleProjects = allProjects.filter((p) => ids.has(p.client_id));
        }

        const projectIds = visibleProjects.map((p) => p.id);
        let rfis = 0;
        let punch = 0;
        if (projectIds.length) {
          const rfiRows = await db
            .select()
            .from(schema.rfis)
            .where(inArray(schema.rfis.project_id, projectIds));
          rfis = rfiRows.filter((r) => r.status === "open").length;
          const punchRows = await db
            .select()
            .from(schema.punch_items)
            .where(inArray(schema.punch_items.project_id, projectIds));
          punch = punchRows.filter((r) => r.status !== "complete").length;
        }

        const acts = await db
          .select()
          .from(schema.activities)
          .orderBy(desc(schema.activities.created_at))
          .limit(8);

        if (!cancelled) {
          setClients(visibleClients);
          setProjects(visibleProjects);
          setOpenRfis(rfis);
          setOpenPunch(punch);
          setActivities(acts);
        }
      } catch (err) {
        console.error("dashboard load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function persist(next: DashboardWidget[]) {
    setLayout(next);
    saveDashboardLayout(next, user?.id);
  }

  function moveWidget(id: DashboardWidgetId, dir: -1 | 1) {
    const index = layout.findIndex((w) => w.id === id);
    const nextIndex = index + dir;
    if (index < 0 || nextIndex < 0 || nextIndex >= layout.length) return;
    const next = [...layout];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    persist(next);
  }

  function toggleWidget(id: DashboardWidgetId) {
    persist(layout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }

  const widgets = useMemo(
    () => (editing ? layout : layout.filter((w) => w.visible)),
    [editing, layout],
  );

  if (loading) return <PageSkeleton />;

  const active = projects.filter((p) => p.status === "active");
  const budget = projects.reduce((s, p) => s + p.budget, 0);
  const spent = projects.reduce((s, p) => s + p.spent, 0);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("dash.greeting.morning");
    if (h < 17) return t("dash.greeting.afternoon");
    return t("dash.greeting.evening");
  })();

  const shortcuts = [
    can("clients", "view") ? { to: "/clients", label: t("nav.clients"), icon: Building2 } : null,
    can("dashboard", "view") || user?.is_admin ? { to: "/projects", label: t("nav.projects"), icon: FolderKanban } : null,
    { to: "/documents", label: t("nav.documents"), icon: FileText },
    { to: "/tools/punch", label: t("nav.punch"), icon: Timer },
    user?.is_admin || can("billing", "view")
      ? { to: "/accounting/billing", label: t("nav.billing"), icon: Receipt }
      : null,
    { to: "/tools/timesheets", label: t("nav.timesheets"), icon: CalendarDays },
  ].filter(Boolean) as { to: string; label: string; icon: typeof Building2 }[];

  function renderWidget(id: DashboardWidgetId) {
    if (id === "stats") {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: t("dash.stat.activeJobs"),
              value: active.length,
              hint: t("dash.stat.total", { n: projects.length }),
              icon: FolderKanban,
            },
            {
              label: t("dash.stat.clients"),
              value: clients.filter((c) => c.status === "active").length,
              hint: t("dash.stat.onFile", { n: clients.length }),
              icon: Building2,
            },
            {
              label: t("dash.stat.openRfis"),
              value: openRfis,
              hint: t("dash.stat.punchOpen", { n: openPunch }),
              icon: TriangleAlert,
            },
            {
              label: t("dash.stat.portfolioSpend"),
              value: spent,
              hint: t("dash.stat.ofBudget", { pct: percent(spent, budget), amount: money(budget, locale) }),
              icon: Wallet,
              money: true,
            },
          ].map((stat, i) => (
            <BlurFade key={stat.label} delay={0.04 * i}>
              <Card className="gap-3 py-5">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5">
                  <CardTitle className="text-[13px] font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <stat.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-5">
                  <div className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                    {stat.money ? (
                      <>
                        $
                        <NumberTicker value={Math.round(stat.value / 1000)} className="font-display" />
                        k
                      </>
                    ) : (
                      <NumberTicker value={stat.value} className="font-display" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
                </CardContent>
              </Card>
            </BlurFade>
          ))}
        </div>
      );
    }

    if (id === "clients") {
      return (
        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("dash.widget.clients")}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/clients">{t("dash.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {clients.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("dash.noClients")}</p>
            ) : (
              <ul className="divide-y">
                {clients.slice(0, 6).map((c) => {
                  const jobs = projects.filter((p) => p.client_id === c.id);
                  return (
                    <li key={c.id}>
                      <Link
                        to={`/clients/${c.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{c.company_name}</p>
                            <StatusBadge value={c.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {c.city || c.name} · {t("clients.projectCount_plural", { n: jobs.length })}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }

    if (id === "projects") {
      return (
        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("dash.projects")}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects">{t("dash.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {projects.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("dash.noProjects")}</p>
            ) : (
              <ul className="divide-y">
                {projects.slice(0, 6).map((p) => {
                  const client = clients.find((c) => c.id === p.client_id);
                  const used = percent(p.spent, p.budget);
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/projects/${p.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{p.name}</p>
                            <StatusBadge value={p.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {p.project_number} · {client?.company_name ?? "—"} · {p.city}
                          </p>
                        </div>
                        <div className="hidden w-36 sm:block">
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                            <span className="tabular-nums">{money(p.spent)}</span>
                            <span>{used}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(used, 100)}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }

    if (id === "modules") {
      return (
        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4">
            <div>
              <CardTitle className="text-base">{t("dash.widget.modules")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t("dash.modulesHint")}</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {shortcuts.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-sm border border-border px-3 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/50"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="text-base">{t("dash.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          {activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("dash.nothingLogged")}</p>
          ) : (
            <ol className="space-y-4">
              {activities.map((a) => (
                <li key={a.id} className="relative pl-5">
                  <span className="absolute top-1.5 left-0 size-2 rounded-full bg-primary/70" />
                  <p className="text-sm capitalize">
                    {t(`activity.${a.action}` as MessageKey) === `activity.${a.action}`
                      ? a.action
                      : t(`activity.${a.action}` as MessageKey)}
                  </p>
                  {a.details && <p className="text-xs text-muted-foreground">{a.details}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={`${greeting}, ${user?.name.split(" ")[0]}`}
        description={
          editing
            ? t("dash.customizeHint")
            : user?.user_type === "external"
              ? t("dash.desc.external")
              : t("dash.desc.internal")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <Button variant="outline" onClick={() => persist(DEFAULT_DASHBOARD)}>
                {t("dash.reset")}
              </Button>
            ) : can("clients", "create") ? (
              <Button asChild>
                <Link to="/clients">
                  {t("dash.newClient")}
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button variant={editing ? "default" : "outline"} onClick={() => setEditing((v) => !v)}>
              {editing ? <LayoutDashboard className="size-4" /> : <Settings2 className="size-4" />}
              {editing ? t("dash.done") : t("dash.customize")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6">
        {widgets.map((widget, index) => (
          <section
            key={widget.id}
            className={editing ? "rounded-sm border border-dashed border-border p-3" : undefined}
          >
            {editing ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{t(`dash.widget.${widget.id}` as MessageKey)}</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => moveWidget(widget.id, -1)}
                    aria-label={t("dash.moveUp")}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === widgets.length - 1}
                    onClick={() => moveWidget(widget.id, 1)}
                    aria-label={t("dash.moveDown")}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => toggleWidget(widget.id)}
                  >
                    {widget.visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {widget.visible ? t("dash.hide") : t("dash.show")}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className={editing && !widget.visible ? "pointer-events-none opacity-40" : undefined}>
              {renderWidget(widget.id)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
