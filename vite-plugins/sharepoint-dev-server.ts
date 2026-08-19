import type { Plugin } from "vite";
import handler from "../api/sharepoint";

export function sharepointDevServer(): Plugin {
  return {
    name: "sharepoint-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/sharepoint", async (req, res) => {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          });
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: Record<string, unknown> = {};
        if (chunks.length) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
          } catch {
            body = {};
          }
        }
        const url = new URL(req.url || "/", "http://localhost");
        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          query[k] = v;
        });
        const fakeRes = {
          statusCode: 200,
          headers: {} as Record<string, string>,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          setHeader(k: string, v: string) {
            this.headers[k] = v;
          },
          json(payload: unknown) {
            res.writeHead(this.statusCode, { "Content-Type": "application/json", ...this.headers });
            res.end(JSON.stringify(payload));
          },
          end(payload?: unknown) {
            res.writeHead(this.statusCode, this.headers);
            res.end(payload as Buffer | string | undefined);
          },
        };
        await handler({ method: req.method, query, body }, fakeRes);
      });
    },
  };
}
