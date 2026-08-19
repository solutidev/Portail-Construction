import type { BillingDocument, Client, CompanyProfile, InvoiceLine, Locale, Project } from "./types";

export const GST_RATE = 0.05;
export const QST_RATE = 0.09975;

export const DEFAULT_COMPANY: CompanyProfile = {
  legal_name: "FRX Construction Inc.",
  address: "1200 Boulevard René-Lévesque O",
  city: "Montréal",
  province: "QC",
  postal: "H3B 4W8",
  phone: "450-555-0100",
  email: "facturation@frxconstruction.ca",
  gst: "123456789RT0001",
  qst: "1234567890TQ0001",
};

export function parseLines(raw: string | null | undefined): InvoiceLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as InvoiceLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((line) => ({
      description: String(line.description ?? ""),
      quantity: Number(line.quantity) || 0,
      unit: String(line.unit ?? "un"),
      unit_price: Number(line.unit_price) || 0,
    }));
  } catch {
    return [];
  }
}

export function lineAmount(line: InvoiceLine) {
  return roundMoney(line.quantity * line.unit_price);
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function totalsFromLines(lines: InvoiceLine[]) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + lineAmount(line), 0));
  const tax_gst = roundMoney(subtotal * GST_RATE);
  const tax_qst = roundMoney(subtotal * QST_RATE);
  const amount = roundMoney(subtotal + tax_gst + tax_qst);
  return { subtotal, tax_gst, tax_qst, amount };
}

export function linesForDocument(doc: BillingDocument): InvoiceLine[] {
  const parsed = parseLines(doc.line_items);
  if (parsed.length > 0) return parsed;
  return [
    {
      description: doc.description || doc.title,
      quantity: 1,
      unit: "un",
      unit_price: Number(doc.subtotal ?? doc.amount) || 0,
    },
  ];
}

export function documentTotals(doc: BillingDocument) {
  const lines = linesForDocument(doc);
  const computed = totalsFromLines(lines);
  return {
    lines,
    subtotal: doc.subtotal ?? computed.subtotal,
    tax_gst: doc.tax_gst ?? computed.tax_gst,
    tax_qst: doc.tax_qst ?? computed.tax_qst,
    amount: doc.amount || computed.amount,
  };
}

export function emptyLine(): InvoiceLine {
  return { description: "", quantity: 1, unit: "un", unit_price: 0 };
}

export function formatAddress(client: Client) {
  return [client.address, [client.city, client.state, client.zip].filter(Boolean).join(" ")].filter(
    (line): line is string => Boolean(line),
  );
}

export function invoiceTitle(kind: BillingDocument["kind"], locale: Locale) {
  if (locale === "fr") return kind === "invoice" ? "FACTURE" : "SOUMISSION";
  return kind === "invoice" ? "INVOICE" : "QUOTE";
}

export function clientEmail(client: Client) {
  return client.email?.trim() || "";
}

export function serializeLines(lines: InvoiceLine[]) {
  return JSON.stringify(lines.filter((line) => line.description.trim()));
}

export function projectLabel(project?: Project | null) {
  if (!project) return "";
  return project.project_number ? `${project.project_number} — ${project.name}` : project.name;
}
