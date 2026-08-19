import type { SmtpSettings } from "./types";

export async function sendInvoiceEmail(input: {
  smtp: SmtpSettings;
  to: string | string[];
  subject: string;
  text: string;
  filename: string;
  pdfBase64: string;
}) {
  const res = await fetch("/api/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  if (!res.ok) {
    throw new Error(payload.error || `Send failed (${res.status})`);
  }
  return payload;
}
