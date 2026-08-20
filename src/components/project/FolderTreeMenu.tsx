import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { callSharePoint, type SpItem } from "@/lib/sharepoint";
import type { SharePointFolder } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type BrowseFolder = SharePointFolder | { id: 0; name: string; sp_item_id: string; sp_drive_id: string; path: string };

type TreeNode = {
  folder: BrowseFolder;
  children: TreeNode[];
};

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function buildFolderTree(folders: BrowseFolder[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const order = [...folders].sort((a, b) => normalizePath(a.path).split("/").filter(Boolean).length - normalizePath(b.path).split("/").filter(Boolean).length);

  for (const folder of order) {
    nodes.set(`${folder.id}:${folder.sp_item_id}`, { folder, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const folder of order) {
    const node = nodes.get(`${folder.id}:${folder.sp_item_id}`);
    if (!node) continue;
    if (folder.id === 0) {
      roots.push(node);
      continue;
    }
    const mine = normalizePath(folder.path);
    let parent: TreeNode | undefined;
    let best = -1;
    for (const candidate of order) {
      if (candidate === folder) continue;
      const theirs = normalizePath(candidate.path);
      const isLibrary = candidate.id === 0;
      const match = isLibrary
        ? true
        : Boolean(theirs) && (mine === theirs || mine.startsWith(`${theirs}/`));
      if (!match) continue;
      const depth = isLibrary ? 0 : theirs.split("/").filter(Boolean).length;
      if (depth > best && (isLibrary || depth < mine.split("/").filter(Boolean).length)) {
        best = depth;
        parent = nodes.get(`${candidate.id}:${candidate.sp_item_id}`);
      }
    }
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

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
  const [extra, setExtra] = useState<Record<string, SpItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  async function loadKids(key: string, itemId: string) {
    if (extra[key]) return;
    setLoadingKey(key);
    try {
      const data = await callSharePoint<{ items: SpItem[] }>("list", { driveId, itemId: itemId || undefined });
      setExtra((prev) => ({ ...prev, [key]: (data.items ?? []).filter((item) => item.isFolder) }));
    } catch {
      setExtra((prev) => ({ ...prev, [key]: [] }));
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
    node,
    ancestor,
    trail,
    depth,
  }: {
    node: TreeNode;
    ancestor: BrowseFolder;
    trail: { id: string; name: string }[];
    depth: number;
  }) {
    const folder = node.folder;
    const key = folder.sp_item_id || `db-${folder.id}`;
    const knownIds = new Set(node.children.map((child) => child.folder.sp_item_id).filter(Boolean));
    const live = (extra[key] ?? []).filter((item) => !knownIds.has(item.id));
    const isOpen = Boolean(expanded[key]);
    const selected = currentKey === key || currentKey === folder.sp_item_id;
    const isRegistered = folder.id !== 0 || trail.length === 0;
    return (
      <div>
        <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 14 }}>
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
              if (folder.id !== 0 && trail.length === 0) onOpen(folder, []);
              else if (isRegistered && folder.id !== 0) onOpen(folder, []);
              else onOpen(ancestor, trail);
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
        {isOpen ? (
          <>
            {node.children.map((child) => (
              <Node
                key={`${child.folder.id}-${child.folder.sp_item_id}`}
                node={child}
                ancestor={child.folder.id !== 0 ? child.folder : ancestor}
                trail={child.folder.id !== 0 ? [] : [...trail, { id: child.folder.sp_item_id, name: child.folder.name }]}
                depth={depth + 1}
              />
            ))}
            {live.map((child) => {
              const nextAncestor = folder.id !== 0 ? folder : ancestor;
              const nextTrail =
                folder.id !== 0
                  ? [{ id: child.id, name: child.name }]
                  : [...trail, { id: child.id, name: child.name }];
              return (
                <Node
                  key={child.id}
                  node={{
                    folder: {
                      id: 0,
                      name: child.name,
                      sp_item_id: child.id,
                      sp_drive_id: driveId,
                      path: `${normalizePath(folder.path)}/${child.name}`.replace(/^\/+/, ""),
                    },
                    children: [],
                  }}
                  ancestor={nextAncestor}
                  trail={nextTrail}
                  depth={depth + 1}
                />
              );
            })}
          </>
        ) : null}
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
          {tree.map((node) => (
            <Node
              key={`${node.folder.id}-${node.folder.sp_item_id}`}
              node={node}
              ancestor={node.folder}
              trail={[]}
              depth={0}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
