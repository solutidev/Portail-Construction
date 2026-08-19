import { downloadBlob } from "./download";
import { formatDuration, pairPunches } from "./timeclock";
import type { BillingDocument, Client, Project, TimePunch, User } from "./types";

export type QuickBooksExportScope = "all" | "invoices" | "quotes" | "hours";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function clientName(clients: Client[], id: number) {
  return clients.find((c) => c.id === id)?.company_name ?? `Client ${id}`;
}

function projectName(projects: Project[], id: number | null) {
  if (!id) return "";
  const project = projects.find((p) => p.id === id);
  return project ? `${project.project_number} ${project.name}` : "";
}

export function buildInvoiceCsv(docs: BillingDocument[], clients: Client[], projects: Project[]) {
  const header = ["DocNumber", "Customer", "TxnDate", "DueDate", "Item", "Description", "Amount", "Status", "Memo"];
  const lines = [header.join(",")];
  for (const doc of docs) {
    lines.push(
      [
        csvEscape(doc.number),
        csvEscape(clientName(clients, doc.client_id)),
        doc.issued_on ?? "",
        doc.due_on ?? "",
        doc.kind === "invoice" ? "Services" : "Estimate",
        csvEscape(doc.title),
        String(doc.amount ?? 0),
        doc.status,
        csvEscape(projectName(projects, doc.project_id)),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function buildHoursCsv(punches: TimePunch[], people: User[], projects: Project[]) {
  const header = ["Employee", "ServiceDate", "CustomerJob", "Hours", "Description", "Billable"];
  const lines = [header.join(",")];
  for (const entry of pairPunches(punches).filter((e) => !e.open)) {
    const person = people.find((p) => p.id === entry.punchIn.user_id)?.name ?? String(entry.punchIn.user_id);
    const project = projects.find((p) => p.id === entry.punchIn.project_id);
    lines.push(
      [
        csvEscape(person),
        entry.punchIn.punched_at.slice(0, 10),
        csvEscape(project ? `${project.project_number} ${project.name}` : ""),
        (entry.minutes / 60).toFixed(2),
        csvEscape(entry.punchIn.note || formatDuration(entry.minutes)),
        "Y",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function exportQuickBooksBundle(input: {
  scope: QuickBooksExportScope;
  invoices: BillingDocument[];
  quotes: BillingDocument[];
  punches: TimePunch[];
  clients: Client[];
  projects: Project[];
  people: User[];
}) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (input.scope === "invoices") {
    downloadBlob(new Blob([buildInvoiceCsv(input.invoices, input.clients, input.projects)], { type: "text/csv;charset=utf-8" }), `quickbooks-invoices-${stamp}.csv`);
    return { invoices: input.invoices.length, quotes: 0, hours: 0 };
  }
  if (input.scope === "quotes") {
    downloadBlob(new Blob([buildInvoiceCsv(input.quotes, input.clients, input.projects)], { type: "text/csv;charset=utf-8" }), `quickbooks-quotes-${stamp}.csv`);
    return { invoices: 0, quotes: input.quotes.length, hours: 0 };
  }
  if (input.scope === "hours") {
    downloadBlob(new Blob([buildHoursCsv(input.punches, input.people, input.projects)], { type: "text/csv;charset=utf-8" }), `quickbooks-hours-${stamp}.csv`);
    return { invoices: 0, quotes: 0, hours: pairPunches(input.punches).filter((e) => !e.open).length };
  }

  const invoices = buildInvoiceCsv(input.invoices, input.clients, input.projects);
  const quotes = buildInvoiceCsv(input.quotes, input.clients, input.projects);
  const hours = buildHoursCsv(input.punches, input.people, input.projects);
  const bundle = [
    "QUICKBOOKS EXPORT",
    `Generated ${stamp}`,
    "",
    "=== INVOICES ===",
    invoices,
    "",
    "=== QUOTES / ESTIMATES ===",
    quotes,
    "",
    "=== TIME / HOURS ===",
    hours,
    "",
  ].join("\n");
  downloadBlob(new Blob([bundle], { type: "text/plain;charset=utf-8" }), `quickbooks-all-${stamp}.txt`);
  return {
    invoices: input.invoices.length,
    quotes: input.quotes.length,
    hours: pairPunches(input.punches).filter((e) => !e.open).length,
  };
}
