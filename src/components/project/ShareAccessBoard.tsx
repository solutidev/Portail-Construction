import { useEffect, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";
import {
  callSharePoint,
  loadAllFolders,
  loadFolderShares,
  shareFor,
  upsertShare,
  type SpItem,
} from "@/lib/sharepoint";
import { getSharePointSettings, sharepointReady } from "@/lib/settings";
import type { SharePointFolder, SharePointSettings, SharePointShare } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type BrowseFolder = SharePointFolder | { id: 0; name: string; sp_item_id: string; sp_drive_id: string; path: string };

export function ShareAccessBoard() {
  const { t } = useI18n();
  const { clients } = useWorkspace();
  const [settings, setSettings] = useState<SharePointSettings | null>(null);
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [shares, setShares] = useState<SharePointShare[]>([]);
  const [items, setItems] = useState<SpItem[]>([]);
  const [active, setActive] = useState<BrowseFolder | null>(null);
  const [selectedFile, setSelectedFile] = useState<SpItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const libraryRoot: BrowseFolder | null = settings
    ? { id: 0, name: t("sp.wholeLibrary"), sp_item_id: "", sp_drive_id: settings.drive_id, path: "/" }
    : null;

  async function refreshShares() {
    const nextFolders = await loadAllFolders();
    setFolders(nextFolders);
    setShares(await loadFolderShares(nextFolders.map((f) => f.id)));
  }

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getSharePointSettings();
        setSettings(cfg);
        if (!sharepointReady(cfg)) return;
        const nextFolders = await loadAllFolders();
        setFolders(nextFolders);
        setShares(await loadFolderShares(nextFolders.map((f) => f.id)));
        const root: BrowseFolder = {
          id: 0,
          name: t("sp.wholeLibrary"),
          sp_item_id: "",
          sp_drive_id: cfg.drive_id,
          path: "/",
        };
        setActive(root);
        const listed = await callSharePoint<{ items: SpItem[] }>("list", { driveId: cfg.drive_id });
        setItems(listed.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "SharePoint error");
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function openFolder(folder: BrowseFolder) {
    setActive(folder);
    setSelectedFile(null);
    setError(null);
    try {
      const listed = await callSharePoint<{ items: SpItem[] }>("list", {
        driveId: folder.sp_drive_id || settings?.drive_id,
        itemId: folder.sp_item_id || undefined,
      });
      setItems(listed.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SharePoint error");
    }
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
    await refreshShares();
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t("sp.loading")}</p>;
  if (!settings || !sharepointReady(settings)) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title={t("sp.notConfigured")}
        description={t("sp.notConfiguredHint")}
      />
    );
  }

  const accessFolderId = selectedFile ? active?.id ?? 0 : active?.id ?? 0;
  const accessItemId = selectedFile?.id ?? "";
  const accessName = selectedFile?.name ?? active?.name ?? t("sp.wholeLibrary");
  const nav: BrowseFolder[] = libraryRoot ? [libraryRoot, ...folders] : folders;

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
      <Card className="gap-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("sp.folders")}</p>
        <ul className="space-y-1">
          {nav.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => void openFolder(folder)}
                className={`flex w-full items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-left text-sm ${
                  active?.id === folder.id && !selectedFile ? "bg-primary/12 font-medium" : "hover:bg-muted"
                }`}
              >
                <FolderOpen className="size-3.5 shrink-0 opacity-70" />
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b px-4 py-3">
          <p className="font-medium">{active?.name}</p>
          <p className="text-xs text-muted-foreground">{t("sp.accessPanelHint")}</p>
        </div>
        {error ? <p className="px-4 py-2 text-sm text-destructive">{error}</p> : null}
        {items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">{t("sp.emptyFolder")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.isFolder) {
                      const linked = folders.find((f) => f.sp_item_id === item.id);
                      void openFolder(
                        linked ?? {
                          id: 0,
                          name: item.name,
                          sp_item_id: item.id,
                          sp_drive_id: active?.sp_drive_id || settings.drive_id,
                          path: item.name,
                        },
                      );
                      return;
                    }
                    setSelectedFile(item);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/60 ${
                    selectedFile?.id === item.id ? "bg-primary/8" : ""
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.isFolder ? t("sp.folder") : t("sp.shareFile")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("sp.accessPanel")}</p>
          <p className="mt-1 text-sm font-medium">{accessName}</p>
          <p className="text-xs text-muted-foreground">
            {accessItemId ? t("sp.accessThisFile") : t("sp.accessThisFolder")}
          </p>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("sp.noClients")}</p>
        ) : (
          <ul className="max-h-[32rem] space-y-3 overflow-auto pr-1">
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
    </div>
  );
}
