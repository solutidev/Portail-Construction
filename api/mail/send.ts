import nodemailer from "nodemailer";
import { requireApiUser, runSql } from "../db.ts";
import { mergeSmtp, type Smtp } from "../_lib/smtp.ts";

export default async function handler(
  req: { method?: string; body?: Record<string, unknown>; headers?: Record<string, unknown> },
  res: {
    status: (code: number) => { json: (body: unknown) => unknown };
    json: (body: unknown) => unknown;
  },
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireApiUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  let stored: Smtp | undefined;
  try {
    const { rows } = await runSql("SELECT value FROM app_settings WHERE key = $1 LIMIT 1", ["smtp"]);
    const raw = rows[0]?.[0];
    if (typeof raw === "string" && raw) stored = JSON.parse(raw) as Smtp;
  } catch {
    stored = undefined;
  }
  const smtp = mergeSmtp((req.body?.smtp ?? {}) as Smtp, stored);
  const toRaw = req.body?.to;
  const to = Array.isArray(toRaw)
    ? toRaw.map((item) => String(item).trim()).filter(Boolean).join(", ")
    : String(toRaw ?? "").trim();
  const subject = String(req.body?.subject ?? "Invoice");
  const text = String(req.body?.text ?? "");
  const filename = String(req.body?.filename ?? "invoice.pdf");
  const pdfBase64 = String(req.body?.pdfBase64 ?? "");

  if (!smtp.host || !smtp.from_email) {
    return res.status(400).json({ error: "SMTP is not configured." });
  }
  if (!to) return res.status(400).json({ error: "Recipient email is required." });

  const port = Number(smtp.port) || 587;
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port,
      secure: Boolean(smtp.secure) || port === 465,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password || "" } : undefined,
    });
    await transporter.sendMail({
      from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
      to,
      subject,
      text,
      attachments: pdfBase64
        ? [{ filename, content: Buffer.from(pdfBase64, "base64"), contentType: "application/pdf" }]
        : [],
    });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Send failed" });
  }
}
