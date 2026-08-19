import nodemailer from "nodemailer";

type Smtp = {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  from_name?: string;
  from_email?: string;
  secure?: boolean;
};

export default async function handler(req: { method?: string; body?: Record<string, unknown> }, res: {
  status: (code: number) => { json: (body: unknown) => unknown };
  json: (body: unknown) => unknown;
}) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const smtp = (req.body?.smtp ?? {}) as Smtp;
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
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port,
    secure: Boolean(smtp.secure) || port === 465,
    auth: smtp.username
      ? { user: smtp.username, pass: smtp.password || "" }
      : undefined,
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
}
