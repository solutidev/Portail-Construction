import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { desc, eq, inArray } from "drizzle-orm";
import {
  ArrowUpRight,
  Building2,
  FolderKanban,
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

type Activity = typeof schema.activities.$inferSelect;

export function DashboardPage() {
  const { user, can } = useAuth();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [openRfis, setOpenRfis] = useState(0);
  const [openPunch, setOpenPunch] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);

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

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={`${greeting}, ${user?.name.split(" ")[0]}`}
        description={
          user?.user_type === "external" ? t("dash.desc.external") : t("dash.desc.internal")
        }
        actions={
          can("clients", "create") ? (
            <Button asChild>
              <Link to="/clients">
                {t("dash.newClient")}
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          ) : null
        }
      />

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
          <BlurFade key={stat.label} delay={0.05 * i}>
            <Card className="gap-3 py-5">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Projects</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {projects.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {t("dash.noProjects")}
              </p>
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

        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            {activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing logged yet.</p>
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
                    {a.details && (
                      <p className="text-xs text-muted-foreground">{a.details}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
