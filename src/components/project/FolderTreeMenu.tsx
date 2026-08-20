import { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { callSharePoint, type SpItem } from "@/lib/sharepoint";
import type { SharePointFolder } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type BrowseFolder = SharePointFolder | { id: 0; name: string; sp_item_id: string; sp_drive_id: string; path: string };

export function FolderTreeMenu({
  folders,
  driveId,
  currentKey,
  onOpen,
}: {
  folders: BrowseFolder[];
  driveId: string;
  currentKey: string;
  onOpen: (root: BrowseFolder, trail: { id: string; name: string }[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Record<string, SpItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function loadKids(key: string, itemId: string) {
    if (children[key]) return;
    setLoadingKey(key);
    try {
      const data = await callSharePoint<{ items: SpItem[] }>("list", { driveId, itemId: itemId || undefined });
      setChildren((prev) => ({ ...prev, [key]: (data.items ?? []).filter((item) => item.isFolder) }));
    } catch {
      setChildren((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingKey(null);
    }
  }

  function toggle(key: string, itemId: string) {
    setExpanded((prev) => {
      const next = !prev[key];
      if (next) void loadKids(key, itemId);
      return { ...prev, [key]: next };
    });
  }

  function Node({
    folder,
    root,
    trail,
    depth,
  }: {
    folder: BrowseFolder;
    root: BrowseFolder;
    trail: { id: string; name: string }[];
    depth: number;
  }) {
    const key = folder.sp_item_id || `db-${folder.id}`;
    const kids = children[key];
    const isOpen = Boolean(expanded[key]);
    const selected = currentKey === key || currentKey === folder.sp_item_id;
    return (
      <div>
        <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 12 }}>
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted"
            onClick={() => toggle(key, folder.sp_item_id)}
            aria-label={isOpen ? t("projects.collapse") : t("projects.expand")}
          >
            {loadingKey === key ? (
              <span className="size-3 animate-pulse rounded-full bg-muted-foreground/40" />
            ) : (
              <ChevronRight className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            )}
          </button>
          <button
            type="button"
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
              selected ? "bg-primary/12 font-medium" : "hover:bg-muted"
            }`}
            onClick={() => {
              onOpen(root, trail);
              setOpen(false);
            }}
          >
            {folder.id === 0 && trail.length === 0 ? (
              <Home className="size-3.5 shrink-0 opacity-70" />
            ) : (
              <FolderOpen className="size-3.5 shrink-0 opacity-70" />
            )}
            <span className="truncate">{folder.name}</span>
          </button>
        </div>
        {isOpen
          ? (kids ?? []).map((child) => (
              <Node
                key={child.id}
                folder={{
                  ...(root as BrowseFolder),
                  name: child.name,
                  sp_item_id: child.id,
                  sp_drive_id: driveId,
                  path: child.name,
                }}
                root={root}
                trail={[...trail, { id: child.id, name: child.name }]}
                depth={depth + 1}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <FolderOpen className="size-4" />
          {t("sp.folderTree")}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-2">
        <p className="mb-2 px-1 text-xs text-muted-foreground">{t("sp.folderTreeHint")}</p>
        <div className="max-h-80 overflow-auto">
          {folders.map((folder) => (
            <Node key={`${folder.id}-${folder.sp_item_id}`} folder={folder} root={folder} trail={[]} depth={0} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
