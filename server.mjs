import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import sharepointHandler from "./api/sharepoint.ts";
import mailHandler from "./api/mail/send.ts";
import dbHandler from "./api/db.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");
const port = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function adaptRes(res) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      res.setHeader(k, v);
    },
    json(body) {
      res.statusCode = this.statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    },
    end(body) {
      res.statusCode = this.statusCode;
      res.end(body);
    },
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    return {};
  }
}

function queryOf(url) {
  const q = {};
  url.searchParams.forEach((v, k) => {
    q[k] = v;
  });
  return q;
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = normalize(join(dist, rel));
  if (!file.startsWith(dist)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error("dir");
    res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
    createReadStream(file).pipe(res);
  } catch {
    const index = await readFile(join(dist, "index.html"));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(index);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      res.end();
      return;
    }
    if (url.pathname === "/api/sharepoint") {
      const body = req.method === "POST" ? await readJsonBody(req) : {};
      await sharepointHandler({ method: req.method, query: queryOf(url), body }, adaptRes(res));
      return;
    }
    if (url.pathname === "/api/mail/send") {
      const body = req.method === "POST" ? await readJsonBody(req) : {};
      await mailHandler({ method: req.method, body }, adaptRes(res));
      return;
    }
    if (url.pathname === "/api/db/ping" || (url.pathname === "/api/db" && req.method === "GET")) {
      await dbHandler({ method: "POST", body: { action: "ping" } }, adaptRes(res));
      return;
    }
    if (url.pathname === "/api/db") {
      const body = req.method === "POST" ? await readJsonBody(req) : {};
      await dbHandler({ method: req.method, body }, adaptRes(res));
      return;
    }
    if (url.pathname === "/healthz") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    await serveStatic(req, res, url);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`FRX portal listening on ${port}`);
});
