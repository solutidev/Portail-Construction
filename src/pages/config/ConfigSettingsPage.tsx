import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Cloud, FileText, Mail, Settings, Users, Wallet } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  COMPANY_KEY,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATES_KEY,
  EMPTY_QUICKBOOKS,
  EMPTY_SHAREPOINT,
  EMPTY_SMTP,
  QUICKBOOKS_KEY,
  SHAREPOINT_KEY,
  SMTP_KEY,
  getCompanyProfile,
  getEmailTemplates,
  getQuickBooksSettings,
  getSharePointSettings,
  getSmtpSettings,
  quickbooksReady,
  setSetting,
  sharepointReady,
} from "@/lib/settings";
import { DEFAULT_COMPANY } from "@/lib/invoice";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigClientsPage } from "./ConfigClientsPage";
import { ConfigInternalUsersPage } from "./ConfigInternalUsersPage";
import type { CompanyProfile, EmailTemplates, QuickBooksSettings, SharePointSettings, SmtpSettings } from "@/lib/types";

const TABS = ["company", "email", "templates", "quickbooks", "sharepoint", "clients", "users"] as const;
type SetupTab = (typeof TABS)[number];

function isSetupTab(value: string | null): value is SetupTab {
  return TABS.includes(value as SetupTab);
}

export function ConfigSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [smtp, setSmtp] = useState<SmtpSettings>(EMPTY_SMTP);
  const [qb, setQb] = useState<QuickBooksSettings>(EMPTY_QUICKBOOKS);
  const [sp, setSp] = useState<SharePointSettings>(EMPTY_SHAREPOINT);
  const [templates, setTemplates] = useState<EmailTemplates>(DEFAULT_EMAIL_TEMPLATES);
  const [spTest, setSpTest] = useState<string | null>(null);

  const tab = useMemo<SetupTab>(() => {
    const requested = params.get("tab");
    return isSetupTab(requested) ? requested : "company";
  }, [params]);

  useEffect(() => {
    void (async () => {
      setCompany(await getCompanyProfile());
      setSmtp(await getSmtpSettings());
      setQb(await getQuickBooksSettings());
      setSp(await getSharePointSettings());
      setTemplates(await getEmailTemplates());
      setLoading(false);
    })();
  }, []);

  function setTab(next: string) {
    const value = isSetupTab(next) ? next : "company";
    setSaved(false);
    setParams(value === "company" ? {} : { tab: value }, { replace: true });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user?.is_admin) return;
    setSaving(true);
    setSaved(false);
    await setSetting(COMPANY_KEY, JSON.stringify(company));
    await setSetting(SMTP_KEY, JSON.stringify(smtp));
    await setSetting(QUICKBOOKS_KEY, JSON.stringify(qb));
    await setSetting(SHAREPOINT_KEY, JSON.stringify(sp));
    await setSetting(EMAIL_TEMPLATES_KEY, JSON.stringify(templates));
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <PageSkeleton />;
  if (!user?.is_admin) {
    return (
      <EmptyState
        icon={<Settings className="size-5" />}
        title={t("config.restricted")}
        description={t("config.restrictedDesc")}
      />
    );
  }

  return (
    <div>
      <PageHeader eyebrow={t("nav.setup")} title={t("settings.title")} description={t("settings.desc")} />

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="company">
            <Building2 className="size-3.5" />
            {t("settings.tab.company")}
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="size-3.5" />
            {t("settings.tab.email")}
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="size-3.5" />
            {t("settings.tab.templates")}
          </TabsTrigger>
          <TabsTrigger value="quickbooks">
            <Wallet className="size-3.5" />
            {t("settings.tab.quickbooks")}
          </TabsTrigger>
          <TabsTrigger value="sharepoint">
            <Cloud className="size-3.5" />
            {t("settings.tab.sharepoint")}
          </TabsTrigger>
          <TabsTrigger value="clients">
            <Building2 className="size-3.5" />
            {t("settings.tab.clients")}
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="size-3.5" />
            {t("settings.tab.users")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <form onSubmit={onSave} className="grid gap-5">
            <Card className="gap-4 p-5">
              <div>
                <p className="text-sm font-medium">{t("settings.company")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.companyHint")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.legalName")}>
                  <Input value={company.legal_name} onChange={(e) => setCompany({ ...company, legal_name: e.target.value })} />
                </Field>
                <Field label={t("clients.email")}>
                  <Input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                </Field>
                <Field label={t("clients.street")}>
                  <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
                </Field>
                <Field label={t("clients.phone")}>
                  <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
                </Field>
                <Field label={t("clients.city")}>
                  <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("clients.province")}>
                    <Input value={company.province} onChange={(e) => setCompany({ ...company, province: e.target.value })} />
                  </Field>
                  <Field label={t("clients.postal")}>
                    <Input value={company.postal} onChange={(e) => setCompany({ ...company, postal: e.target.value })} />
                  </Field>
                </div>
                <Field label={t("settings.gst")}>
                  <Input value={company.gst} onChange={(e) => setCompany({ ...company, gst: e.target.value })} />
                </Field>
                <Field label={t("settings.qst")}>
                  <Input value={company.qst} onChange={(e) => setCompany({ ...company, qst: e.target.value })} />
                </Field>
              </div>
            </Card>
            <SaveBar saved={saved} saving={saving} />
          </form>
        </TabsContent>

        <TabsContent value="email">
          <form onSubmit={onSave} className="grid gap-5">
            <Card className="gap-4 p-5">
              <div>
                <p className="text-sm font-medium">{t("settings.smtp")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.smtpHint")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.host")}>
                  <Input placeholder="smtp.office365.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
                </Field>
                <Field label={t("settings.port")}>
                  <Input value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} />
                </Field>
                <Field label={t("settings.username")}>
                  <Input autoComplete="off" value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} />
                </Field>
                <Field label={t("settings.password")}>
                  <Input type="password" autoComplete="new-password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} />
                </Field>
                <Field label={t("settings.fromName")}>
                  <Input value={smtp.from_name} onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })} />
                </Field>
                <Field label={t("settings.fromEmail")}>
                  <Input type="email" value={smtp.from_email} onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{t("settings.secure")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.secureHint")}</p>
                </div>
                <Switch checked={smtp.secure} onCheckedChange={(v) => setSmtp({ ...smtp, secure: v })} />
              </div>
            </Card>
            <SaveBar saved={saved} saving={saving} />
          </form>
        </TabsContent>

        <TabsContent value="templates">
          <form onSubmit={onSave} className="grid gap-5">
            <Card className="gap-4 p-5">
              <div>
                <p className="text-sm font-medium">{t("settings.templates.title")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.templates.hint")}</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {(["send_invoice", "send_quote"] as const).map((key) => (
                  <div key={key} className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-medium">
                      {key === "send_invoice" ? t("settings.templates.invoice") : t("settings.templates.quote")}
                    </p>
                    <Field label={t("settings.templates.subject")}>
                      <Input
                        value={templates[key].subject}
                        onChange={(e) =>
                          setTemplates({
                            ...templates,
                            [key]: { ...templates[key], subject: e.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field label={t("settings.templates.body")}>
                      <Textarea
                        rows={7}
                        value={templates[key].body}
                        onChange={(e) =>
                          setTemplates({
                            ...templates,
                            [key]: { ...templates[key], body: e.target.value },
                          })
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </Card>
            <SaveBar saved={saved} saving={saving} />
          </form>
        </TabsContent>

        <TabsContent value="quickbooks">
          <form onSubmit={onSave} className="grid gap-5">
            <Card className="gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("settings.qb.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.qb.hint")}</p>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {qb.connected ? t("settings.qb.connected") : t("settings.qb.disconnected")}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.qb.clientId")}>
                  <Input value={qb.client_id} onChange={(e) => setQb({ ...qb, client_id: e.target.value })} autoComplete="off" />
                </Field>
                <Field label={t("settings.qb.clientSecret")}>
                  <Input type="password" value={qb.client_secret} onChange={(e) => setQb({ ...qb, client_secret: e.target.value })} autoComplete="new-password" />
                </Field>
                <Field label={t("settings.qb.realm")}>
                  <Input value={qb.realm_id} onChange={(e) => setQb({ ...qb, realm_id: e.target.value })} />
                </Field>
                <Field label={t("settings.qb.env")}>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={qb.environment}
                    onChange={(e) => setQb({ ...qb, environment: e.target.value === "production" ? "production" : "sandbox" })}
                  >
                    <option value="sandbox">{t("settings.qb.sandbox")}</option>
                    <option value="production">{t("settings.qb.production")}</option>
                  </select>
                </Field>
              </div>
              {qb.last_sync ? <p className="text-xs text-muted-foreground">{t("settings.qb.lastSync", { date: qb.last_sync })}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!quickbooksReady(qb)}
                  onClick={() => setQb({ ...qb, connected: !qb.connected })}
                >
                  {qb.connected ? t("settings.qb.disconnect") : t("settings.qb.connect")}
                </Button>
                {!quickbooksReady(qb) ? <p className="self-center text-xs text-muted-foreground">{t("settings.qb.needKeys")}</p> : null}
              </div>
            </Card>
            <SaveBar saved={saved} saving={saving} />
          </form>
        </TabsContent>

        <TabsContent value="sharepoint">
          <form onSubmit={onSave} className="grid gap-5">
            <Card className="gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("settings.sp.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.sp.hint")}</p>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {sp.connected ? t("settings.sp.connected") : t("settings.sp.disconnected")}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.sp.tenant")}>
                  <Input value={sp.tenant_id} onChange={(e) => setSp({ ...sp, tenant_id: e.target.value })} autoComplete="off" />
                </Field>
                <Field label={t("settings.sp.clientId")}>
                  <Input value={sp.client_id} onChange={(e) => setSp({ ...sp, client_id: e.target.value })} autoComplete="off" />
                </Field>
                <Field label={t("settings.sp.clientSecret")}>
                  <Input
                    type="password"
                    value={sp.client_secret}
                    onChange={(e) => setSp({ ...sp, client_secret: e.target.value })}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label={t("settings.sp.site")}>
                  <Input
                    placeholder="https://contoso.sharepoint.com/sites/Jobs"
                    value={sp.site_url}
                    onChange={(e) => setSp({ ...sp, site_url: e.target.value })}
                  />
                </Field>
                <Field label={t("settings.sp.library")}>
                  <Input value={sp.library_name} onChange={(e) => setSp({ ...sp, library_name: e.target.value })} />
                </Field>
                <Field label={t("settings.sp.drive")}>
                  <Input value={sp.drive_id} onChange={(e) => setSp({ ...sp, drive_id: e.target.value })} placeholder={t("settings.sp.driveHint")} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.sp.aclNote")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? t("clients.saving") : t("settings.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!sharepointReady(sp)}
                  onClick={async () => {
                    setSpTest(null);
                    try {
                      const res = await fetch("/api/sharepoint", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "test", config: sp }),
                      });
                      const payload = (await res.json()) as { ok?: boolean; driveId?: string; error?: string };
                      if (!res.ok) throw new Error(payload.error || "Test failed");
                      setSp({ ...sp, connected: true, drive_id: payload.driveId || sp.drive_id });
                      setSpTest(t("settings.sp.testOk"));
                    } catch (err) {
                      setSp({ ...sp, connected: false });
                      setSpTest(err instanceof Error ? err.message : t("settings.sp.testFail"));
                    }
                  }}
                >
                  {t("settings.sp.test")}
                </Button>
                {spTest ? <p className="text-sm text-muted-foreground">{spTest}</p> : null}
              </div>
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="clients">
          <ConfigClientsPage embedded />
        </TabsContent>
        <TabsContent value="users">
          <ConfigInternalUsersPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SaveBar({ saved, saving }: { saved: boolean; saving: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-end gap-3">
      {saved ? <p className="text-sm text-muted-foreground">{t("settings.saved")}</p> : null}
      <Button type="submit" disabled={saving}>
        {saving ? t("clients.saving") : t("settings.save")}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
