import { useMemo, useState } from "react";
import { ChevronRight, FolderOpen, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { callSharePoint, type SpItem } from "@/lib/sharepoint";
import type { SharePointFolder } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export type BrowseFolder = SharePointFolder | { id: 0; name: string; sp_item_id: string; sp_drive_id: string; path: string };

type TreeNode = {
  folder: BrowseFolder;
  children: TreeNode[];
};

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function folderKey(folder: BrowseFolder) {
  return folder.sp_item_id || `db-${folder.id}`;
}

function parentOf(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function buildFolderTree(folders: BrowseFolder[]): TreeNode[] {
  const library = folders.find((f) => f.id === 0);
  const assigned = folders.filter((f) => f.id !== 0);
  const nodes = new Map<string, TreeNode>();
  const order = [...assigned].sort(
    (a, b) => normalizePath(a.path).split("/").filter(Boolean).length - normalizePath(b.path).split("/").filter(Boolean).length,
  );
  for (const folder of order) nodes.set(folderKey(folder), { folder, children: [] });

  const hanging: TreeNode[] = [];
  for (const folder of order) {
    const node = nodes.get(folderKey(folder));
    if (!node) continue;
    const parentPath = parentOf(folder.path);
    let parent: TreeNode | undefined;
    if (parentPath) {
      for (const candidate of order) {
        if (normalizePath(candidate.path) === parentPath) {
          parent = nodes.get(folderKey(candidate));
          break;
        }
      }
    }
    if (parent && parent !== node) parent.children.push(node);
    else hanging.push(node);
  }

  if (library) return [{ folder: library, children: hanging }];
  return hanging;
}

export function FolderTreePanel({
  folders,
  driveId,
  currentKey,
  onOpen,
  shareCounts,
  loadLive = true,
}: {
  folders: BrowseFolder[];
  driveId: string;
  currentKey: string;
  onOpen: (root: BrowseFolder, trail: { id: string; name: string }[]) => void;
  shareCounts?: Record<string, number>;
  loadLive?: boolean;
}) {
  const { t } = useI18n();
  const [extra, setExtra] = useState<Record<string, SpItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const tree = useMemo(() => {
    const built = buildFolderTree(folders);
    if (!loadLive) return built;
    return built.map((node) => (node.folder.id === 0 ? { ...node, children: [] } : node));
  }, [folders, loadLive]);
  const assigned = useMemo(() => folders.filter((f) => f.id !== 0), [folders]);
  const registeredByItem = useMemo(() => {
    const map = new Map<string, BrowseFolder>();
    for (const folder of assigned) {
      if (folder.sp_item_id) map.set(folder.sp_item_id, folder);
    }
    return map;
  }, [assigned]);

  async function loadKids(key: string, itemId: string) {
    if (!loadLive || extra[key]) return;
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
    const key = folderKey(folder);
    const knownIds = new Set(node.children.map((child) => child.folder.sp_item_id).filter(Boolean));
    const live = (extra[key] ?? []).filter((item) => !knownIds.has(item.id));
    const isOpen = Boolean(expanded[key]);
    const selected = currentKey === key || currentKey === folder.sp_item_id;
    const count = shareCounts?.[`${folder.id}`] ?? 0;
    const openTarget = folder.id !== 0 ? folder : ancestor;
    const openTrail = folder.id !== 0 && trail.length === 0 ? [] : trail;
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
            onClick={() => onOpen(openTarget, openTrail)}
          >
            {folder.id === 0 && trail.length === 0 ? (
              <Home className="size-3.5 shrink-0 opacity-70" />
            ) : (
              <FolderOpen className="size-3.5 shrink-0 opacity-70" />
            )}
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {count ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {count}
              </Badge>
            ) : null}
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
              const registered = registeredByItem.get(child.id);
              const nextFolder: BrowseFolder = registered ?? {
                id: 0,
                name: child.name,
                sp_item_id: child.id,
                sp_drive_id: driveId,
                path: `${normalizePath(folder.path)}/${child.name}`.replace(/^\/+/, ""),
              };
              const assignedKids = assigned.filter(
                (item) => item.sp_item_id !== child.id && parentOf(item.path) === normalizePath(nextFolder.path),
              );
              const nextAncestor = nextFolder.id !== 0 ? nextFolder : folder.id !== 0 ? folder : ancestor;
              const nextTrail =
                nextFolder.id !== 0
                  ? []
                  : folder.id !== 0
                    ? [{ id: child.id, name: child.name }]
                    : [...trail, { id: child.id, name: child.name }];
              return (
                <Node
                  key={child.id}
                  node={{
                    folder: nextFolder,
                    children: assignedKids.map((item) => ({ folder: item, children: [] })),
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
    <div className="max-h-[36rem] overflow-auto">
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
  );
}
