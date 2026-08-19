import type { Plugin } from "vite";
import nodemailer from "nodemailer";

export function mailDevServer(): Plugin {
  return {
    name: "mail-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/mail/send", async (req, res) => {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
          const smtp = body.smtp ?? {};
          const to = String(body.to ?? "").trim();
          if (!smtp.host || !smtp.from_email) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "SMTP is not configured." }));
            return;
          }
          if (!to) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Recipient email is required." }));
            return;
          }
          const port = Number(smtp.port) || 587;
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port,
            secure: Boolean(smtp.secure) || port === 465,
            auth: smtp.username ? { user: smtp.username, pass: smtp.password || "" } : undefined,
          });
          await transporter.sendMail({
            from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
            to,
            subject: String(body.subject ?? "Invoice"),
            text: String(body.text ?? ""),
            attachments: body.pdfBase64
              ? [
                  {
                    filename: String(body.filename ?? "invoice.pdf"),
                    content: Buffer.from(String(body.pdfBase64), "base64"),
                    contentType: "application/pdf",
                  },
                ]
              : [],
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Send failed" }));
        }
      });
    },
  };
}
