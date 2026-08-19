import {
  createFolder,
  deleteItem,
  downloadFile,
  getGraphToken,
  listChildren,
  mergeSharePointConfig,
  officeEditUrl,
  renameItem,
  resolveDrive,
  sharePointConfigured,
  uploadSmallFile,
  type SharePointConfig,
} from "./_lib/sharepoint.js";

type Req = { method?: string; query?: Record<string, string | string[]>; body?: Record<string, unknown> };
type Res = {
  status: (code: number) => { json: (body: unknown) => unknown; end?: (body?: unknown) => unknown };
  json: (body: unknown) => unknown;
  setHeader: (k: string, v: string) => void;
  end: (body?: unknown) => unknown;
};

function cfgFrom(body: Record<string, unknown> | undefined): SharePointConfig {
  return mergeSharePointConfig((body?.config as SharePointConfig) ?? {});
}

function q(req: Req, key: string) {
  const v = req.query?.[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: Req, res: Res) {
  try {
    const action = String(req.body?.action ?? q(req, "action") ?? "");
    if (req.method === "GET" && action === "download") {
      const cfg = mergeSharePointConfig({
        tenant_id: q(req, "tenant_id"),
        client_id: q(req, "client_id"),
        client_secret: process.env.SHAREPOINT_CLIENT_SECRET,
        site_url: q(req, "site_url"),
        drive_id: q(req, "drive_id"),
      });
      const token = await getGraphToken(cfg);
      const driveId = String(q(req, "driveId") ?? "");
      const itemId = String(q(req, "itemId") ?? "");
      const name = String(q(req, "name") ?? "file");
      const { buf, contentType } = await downloadFile(token, driveId, itemId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
      res.status(200);
      return res.end(buf);
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body ?? {};
    const actionName = String(body.action ?? action ?? "");
    const cfg = cfgFrom(body);
    if (!sharePointConfigured(cfg)) {
      if (actionName === "list") {
        return res.status(200).json({ configured: false, driveId: "", items: [] });
      }
      return res.status(400).json({
        error: "SharePoint is not configured. Add tenant ID, client ID, secret, and site URL under Setup → SharePoint.",
      });
    }
    const token = await getGraphToken(cfg);
    const driveId = String(body.driveId || "") || (await resolveDrive(token, cfg));

    if (action === "test") {
      await listChildren(token, driveId);
      return res.status(200).json({ ok: true, driveId });
    }
    if (action === "list") {
      const items = await listChildren(token, driveId, body.itemId ? String(body.itemId) : undefined);
      return res.status(200).json({
        driveId,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          size: item.size ?? 0,
          webUrl: item.webUrl ?? "",
          lastModified: item.lastModifiedDateTime ?? "",
          isFolder: Boolean(item.folder),
          mime: item.file?.mimeType ?? "",
          editUrl: item.file ? officeEditUrl(item.webUrl) : null,
        })),
      });
    }
    if (actionName === "mkdir" || action === "mkdir") {
      const name = String(body.name ?? "").trim();
      if (!name) return res.status(400).json({ error: "Folder name is required." });
      const folder = await createFolder(token, driveId, name, body.parentId ? String(body.parentId) : undefined);
      return res.status(200).json({
        driveId,
        folder: { id: folder.id, name: folder.name, webUrl: folder.webUrl ?? "" },
      });
    }
    if (actionName === "rename" || action === "rename") {
      const itemId = String(body.itemId ?? "").trim();
      const name = String(body.name ?? "").trim();
      if (!itemId || !name) return res.status(400).json({ error: "itemId and name are required." });
      const item = await renameItem(token, driveId, itemId, name);
      return res.status(200).json({ item: { id: item.id, name: item.name } });
    }
    if (actionName === "delete" || action === "delete") {
      const itemId = String(body.itemId ?? "").trim();
      if (!itemId) return res.status(400).json({ error: "itemId is required." });
      await deleteItem(token, driveId, itemId);
      return res.status(200).json({ ok: true });
    }
    if (action === "upload") {
      const name = String(body.name ?? "").trim();
      const parentId = String(body.parentId ?? "");
      const content = String(body.content ?? "");
      if (!name || !parentId || !content) return res.status(400).json({ error: "name, parentId, and content are required." });
      const bytes = Buffer.from(content, "base64");
      if (bytes.length > 4 * 1024 * 1024) {
        return res.status(400).json({ error: "Files over 4 MB need a larger upload session. Split or compress the file." });
      }
      const file = await uploadSmallFile(token, driveId, parentId, name, bytes);
      return res.status(200).json({
        file: {
          id: file.id,
          name: file.name,
          webUrl: file.webUrl ?? "",
          editUrl: officeEditUrl(file.webUrl),
        },
      });
    }
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "SharePoint error" });
  }
}
