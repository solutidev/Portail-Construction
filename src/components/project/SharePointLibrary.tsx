import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, FileText, FolderPlus, Share2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";
import { downloadBlob } from "@/lib/download";
import { formatDate } from "@/lib/format";
import {
  callSharePoint,
  canManageLibrary,
  clientHasRootShare,
  foldersVisibleTo,
  itemVisibleTo,
  loadAllFolders,
  loadFolderShares,
  loadProjectFolders,
  shareFor,
  upsertShare,
  type SpItem,
} from "@/lib/sharepoint";
import { getSharePointSettings, sharepointReady } from "@/lib/settings";
import { db, schema } from "../../db";
import type { Client, SharePointFolder, SharePointSettings, SharePointShare } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BrowseFolder = SharePointFolder | { id: 0; name: string; sp_item_id: string; sp_drive_id: string; path: string };

export function SharePointLibrary({
  projectId,
  projectName,
  client,
  canCreate,
  compact = false,
}: {
  projectId: number;
  projectName: string;
  client: Client | null;
  canCreate: boolean;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { clients } = useWorkspace();
  const manager = canManageLibrary(user);
  const [settings, setSettings] = useState<SharePointSettings | null>(null);
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [shares, setShares] = useState<SharePointShare[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [items, setItems] = useState<SpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ folderId: number; itemId: string; name: string } | null>(null);

  const libraryRoot: BrowseFolder | null = settings
    ? {
        id: 0,
        name: t("sp.wholeLibrary"),
        sp_item_id: "",
        sp_drive_id: settings.drive_id,
        path: "/",
      }
    : null;

  const visible = useMemo(
    () => foldersVisibleTo(folders, shares, user, client?.id ?? null),
    [folders, shares, user, client],
  );
  const showRootForClient = Boolean(libraryRoot && clientHasRootShare(shares, client?.id ?? null));
  const navFolders: BrowseFolder[] =
    manager && libraryRoot ? [libraryRoot, ...visible] : showRootForClient && libraryRoot ? [libraryRoot, ...visible] : visible;
  const active = navFolders.find((f) => f.id === activeId) ?? navFolders[0] ?? null;
  const folderShare = active && active.id && client ? shareFor(shares, active.id, client.id, "") : null;
  const canUpload = Boolean(manager || (canCreate && folderShare?.can_upload && active && active.id !== 0));
  const canEditFolder = Boolean(manager || folderShare?.can_edit);

  const visibleItems = useMemo(() => {
    if (!active) return [];
    if (manager || active.id === 0) return items;
    return items.filter((item) => itemVisibleTo(shares, active.id, item.id, user, client?.id ?? null));
  }, [items, active, manager, shares, user, client]);

  async function reloadMeta() {
    const nextFolders = projectId === 0 ? await loadAllFolders() : await loadProjectFolders(projectId);
    const nextShares = await loadFolderShares(nextFolders.map((f) => f.id));
    setFolders(nextFolders);
    setShares(nextShares);
    return { nextFolders, nextShares };
  }

  async function loadItems(folder: BrowseFolder, driveFallback?: string) {
    const data = await callSharePoint<{ items: SpItem[]; driveId?: string }>("list", {
      driveId: folder.sp_drive_id || driveFallback || "",
      itemId: folder.sp_item_id || undefined,
    });
    setItems(data.items);
    if (data.driveId && settings && !settings.drive_id) {
      setSettings({ ...settings, drive_id: data.driveId });
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getSharePointSettings();
        setSettings(cfg);
        const { nextFolders, nextShares } = await reloadMeta();
        if (!sharepointReady(cfg)) {
          setItems([]);
          return;
        }
        const first = manager
          ? { id: 0 as const }
          : foldersVisibleTo(nextFolders, nextShares, user, client?.id ?? null)[0];
        if (first) setActiveId(first.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "SharePoint error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.id, user?.view_as, client?.id]);

  useEffect(() => {
    if (loading || !active || !settings || !sharepointReady(settings)) return;
    void loadItems(active, settings.drive_id).catch((err) =>
      setError(err instanceof Error ? err.message : "SharePoint error"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, active?.id, active?.sp_item_id, settings?.connected, settings?.site_url]);

  async function createLinkedFolder() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await callSharePoint<{ driveId: string; folder: { id: string; name: string } }>("mkdir", {
        name: newName.trim(),
        parentId: active && active.id !== 0 ? active.sp_item_id : undefined,
      });
      await db.insert(schema.sharepoint_folders).values({
        project_id: projectId,
        name: created.folder.name,
        sp_item_id: created.folder.id,
        sp_drive_id: created.driveId,
        path: created.folder.name,
      });
      setNewName("");
      const { nextFolders } = await reloadMeta();
      const just = nextFolders.find((f) => f.sp_item_id === created.folder.id);
      if (just) setActiveId(just.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    if (!active || active.id === 0) return;
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      await callSharePoint("upload", {
        driveId: active.sp_drive_id,
        parentId: active.sp_item_id,
        name: file.name,
        content: btoa(binary),
      });
      await loadItems(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(item: SpItem) {
    if (!active) return;
    const settingsNow = settings ?? (await getSharePointSettings());
    const params = new URLSearchParams({
      action: "download",
      driveId: active.sp_drive_id || settingsNow.drive_id,
      itemId: item.id,
      name: item.name,
      tenant_id: settingsNow.tenant_id,
      client_id: settingsNow.client_id,
      site_url: settingsNow.site_url,
      drive_id: active.sp_drive_id || settingsNow.drive_id,
    });
    const res = await fetch(`/api/sharepoint?${params.toString()}`);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Download failed");
      return;
    }
    downloadBlob(await res.blob(), item.name);
  }

  function openShare(folderId: number, itemId: string, name: string) {
    setShareTarget({ folderId, itemId, name });
    setShareOpen(true);
  }

  async function setFlags(
    folderId: number,
    clientId: number,
    itemId: string,
    key: "can_view" | "can_upload" | "can_edit",
    on: boolean,
    current: SharePointShare | null,
  ) {
    const next = {
      can_view: key === "can_view" ? on : Boolean(current?.can_view) || on,
      can_upload: itemId ? false : key === "can_upload" ? on : Boolean(current?.can_upload),
      can_edit: key === "can_edit" ? on : Boolean(current?.can_edit),
    };
    if (next.can_upload || next.can_edit) next.can_view = true;
    await upsertShare(folderId, clientId, next, itemId);
    setShares(await loadFolderShares(folders.map((f) => f.id)));
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("sp.loading")}</p>;
  }
  if (!settings || !sharepointReady(settings)) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title={t("sp.notConfigured")}
        description={t("sp.notConfiguredHint")}
      />
    );
  }

  const accessFolderId = shareTarget?.folderId ?? active?.id ?? 0;
  const accessItemId = shareTarget?.itemId ?? "";
  const accessName = shareTarget?.name ?? active?.name ?? t("sp.wholeLibrary");

  return (
    <div className={compact ? "space-y-3" : "grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_280px]"}>
      <Card className="gap-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("sp.folders")}</p>
        {navFolders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{manager ? t("sp.noFoldersStaff") : t("sp.noFoldersClient")}</p>
        ) : (
          <ul className="space-y-1">
            {navFolders.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(folder.id)}
                  className={`w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm ${
                    active?.id === folder.id ? "bg-primary/12 font-medium text-foreground" : "hover:bg-muted"
                  }`}
                >
                  {folder.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {manager ? (
          <div className="space-y-2 border-t pt-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("sp.folderName")} />
            <Button size="sm" className="w-full" disabled={busy || !newName.trim()} onClick={() => void createLinkedFolder()}>
              <FolderPlus className="size-4" />
              {t("sp.createFolder")}
            </Button>
          </div>
        ) : null}
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{active?.name ?? t("project.nav.documents")}</h2>
            <p className="text-xs text-muted-foreground">{t("sp.aclHint", { project: projectName })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {manager && active ? (
              <Button size="sm" variant="outline" onClick={() => openShare(active.id, "", active.name)}>
                <Share2 className="size-4" />
                {t("sp.shareFolder")}
              </Button>
            ) : null}
            {canUpload && active && active.id !== 0 ? (
              <Button size="sm" asChild disabled={busy}>
                <label className="cursor-pointer">
                  <Upload className="size-4" />
                  {t("sp.upload")}
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
            ) : null}
          </div>
        </div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {!active ? (
          <EmptyState icon={<FileText className="size-5" />} title={t("sp.pickFolder")} description="" />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<FileText className="size-5" />} title={t("sp.emptyFolder")} description={t("sp.emptyFolderHint")} />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {visibleItems.map((item) => {
              const fileShare = active.id && client ? shareFor(shares, active.id, client.id, item.id) : null;
              const canEdit = Boolean(manager || fileShare?.can_edit || canEditFolder);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.isFolder ? t("sp.folder") : `${Math.max(1, Math.round(item.size / 1024))} KB`}
                      {item.lastModified ? ` · ${formatDate(item.lastModified, locale)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {manager && !item.isFolder ? (
                      <Button size="sm" variant="outline" onClick={() => openShare(active.id, item.id, item.name)}>
                        <Share2 className="size-4" />
                        {t("sp.shareFile")}
                      </Button>
                    ) : null}
                    {item.isFolder && manager ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const linked = folders.find((f) => f.sp_item_id === item.id);
                          if (linked) setActiveId(linked.id);
                        }}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    ) : null}
                    {!item.isFolder ? (
                      <Button size="sm" variant="outline" onClick={() => void onDownload(item)}>
                        <Download className="size-4" />
                        {t("sp.download")}
                      </Button>
                    ) : null}
                    {canEdit && item.editUrl ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={item.editUrl} target="_blank" rel="noreferrer">
                          {t("sp.edit")}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {manager ? (
        <Card className="gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("sp.accessPanel")}</p>
            <p className="mt-1 text-sm font-medium">{accessName}</p>
            <p className="text-xs text-muted-foreground">
              {accessItemId ? t("sp.accessThisFile") : t("sp.accessThisFolder")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("sp.accessPanelHint")}</p>
          </div>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("sp.noClients")}</p>
          ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-auto pr-1">
              {clients.map((c) => {
                const share = shareFor(shares, accessFolderId, c.id, accessItemId);
                return (
                  <li key={c.id} className="rounded-lg border p-3">
                    <p className="mb-2 truncate text-sm font-medium">{c.company_name}</p>
                    <div className="grid gap-2">
                      {(
                        [
                          ["can_view", t("sp.canView")],
                          ["can_upload", t("sp.canUpload")],
                          ["can_edit", t("sp.canEdit")],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center justify-between gap-2 text-xs">
                          {label}
                          <Switch
                            checked={Boolean(share?.[key])}
                            disabled={Boolean(accessItemId) && key === "can_upload"}
                            onCheckedChange={(on) => {
                              void setFlags(accessFolderId, c.id, accessItemId, key, on, share);
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{shareTarget?.itemId ? t("sp.shareFileTitle") : t("sp.shareTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {shareTarget?.name} — {t("sp.shareHint")}
          </p>
          <ul className="max-h-80 space-y-3 overflow-auto">
            {clients.map((c) => {
              const share = shareTarget
                ? shareFor(shares, shareTarget.folderId, c.id, shareTarget.itemId)
                : null;
              return (
                <li key={c.id} className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-medium">{c.company_name}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["can_view", t("sp.canView")],
                        ["can_upload", t("sp.canUpload")],
                        ["can_edit", t("sp.canEdit")],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center justify-between gap-2 text-xs">
                        {label}
                        <Switch
                          checked={Boolean(share?.[key])}
                          disabled={Boolean(shareTarget?.itemId) && key === "can_upload"}
                          onCheckedChange={(on) => {
                            if (!shareTarget) return;
                            void setFlags(shareTarget.folderId, c.id, shareTarget.itemId, key, on, share);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button onClick={() => setShareOpen(false)}>{t("project.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
