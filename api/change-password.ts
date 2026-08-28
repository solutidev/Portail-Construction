import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDbRequest } from "./db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = typeof req.body === "object" && req.body ? req.body : {};
  await handleDbRequest(
    {
      method: "POST",
      body: { ...body, action: "change_password" },
      headers: req.headers as Record<string, unknown>,
      query: { action: "change_password" },
      url: req.url,
    },
    res,
  );
}
