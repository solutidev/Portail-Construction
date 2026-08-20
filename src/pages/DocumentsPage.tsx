import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, ChevronRight, FolderKanban, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";
import { projectSectionPath } from "@/lib/project-nav";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { SharePointLibrary } from "@/components/project/SharePointLibrary";
import { ShareAccessBoard } from "@/components/project/ShareAccessBoard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Client, Project } from "@/lib/types";

function DocumentsProjectsIndex({
  clients,
  projects,
}: {
  clients: Client[];
  projects: Project[];
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...clients]
      .sort((a, b) => a.company_name.localeCompare(b.company_name))
      .map((client) => ({
        client,
        jobs: projects
          .filter((p) => p.client_id === client.id)
          .filter((p) => {
            if (!q) return true;
            return (
              client.company_name.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.project_number.toLowerCase().includes(q) ||
              (p.city ?? "").toLowerCase().includes(q)
            );
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.jobs.length > 0 || (!q && projects.some((p) => p.client_id === group.client.id)));
  }, [clients, projects, query]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("sp.projectsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("sp.projectsHint")}</p>
      </div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("sp.projectsSearch")} />
      </div>
      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("sp.projectsEmpty")}</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ client, jobs }) => (
            <Card key={client.id} className="gap-0 overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client.company_name}</p>
                    <p className="text-xs text-muted-foreground">{t("sp.projectCount", { n: jobs.length })}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/clients/${client.id}`}>
                    {t("dash.viewAll")}
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </div>
              {jobs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t("nav.noProjectsYet")}</p>
              ) : (
                <ul className="divide-y">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <Link
                        to={projectSectionPath(job.id, "documents")}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{job.name}</p>
                            <StatusBadge value={job.status} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {job.project_number}
                            {job.city ? ` · ${job.city}` : ""}
                          </p>
                        </div>
                        <span className="hidden text-xs text-muted-foreground sm:inline">{t("sp.openDocs")}</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentsPage() {
  const { t } = useI18n();
  const { can, user } = useAuth();
  const { selectedClient, clientProjects, projects, clients } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab = rawTab === "access" || rawTab === "projects" ? rawTab : "library";
  const canManage = Boolean(user?.is_admin || user?.user_type === "internal") && user?.view_as !== "client";
  const forClient = selectedClient;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.documents")}
        description={
          forClient
            ? t("sp.assignFolderHint")
            : t("sp.accessPanelHint")
        }
      />
      {canManage ? (
        <Tabs
          value={tab}
          onValueChange={(next) =>
            setParams(next === "library" ? {} : { tab: next }, { replace: true })
          }
        >
          <TabsList>
            <TabsTrigger value="library">{t("nav.documents")}</TabsTrigger>
            <TabsTrigger value="projects">{t("sp.tab.projects")}</TabsTrigger>
            <TabsTrigger value="access">{t("sp.manageAccess")}</TabsTrigger>
          </TabsList>
          <TabsContent value="library">
            <SharePointLibrary
              projectId={0}
              projectName={t("nav.documents")}
              client={forClient}
              canCreate={can("documents", "create")}
              scopeProjectIds={(forClient ? clientProjects : projects).map((p) => p.id)}
            />
          </TabsContent>
          <TabsContent value="projects">
            <DocumentsProjectsIndex clients={clients} projects={projects} />
          </TabsContent>
          <TabsContent value="access">
            <ShareAccessBoard />
          </TabsContent>
        </Tabs>
      ) : (
        <SharePointLibrary
          projectId={0}
          projectName={t("nav.documents")}
          client={forClient}
          canCreate={can("documents", "create")}
        />
      )}
    </div>
  );
}
