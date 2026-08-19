import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { isoDate } from "./format";
import type { BillingDocument, BillingKind } from "./types";

export function nextBillingNumber(kind: BillingKind, docs: BillingDocument[]) {
  const prefix = kind === "invoice" ? "FAC" : "SOU";
  const year = new Date().getFullYear().toString().slice(-2);
  const count = docs.filter((d) => d.kind === kind).length + 1;
  return `${prefix}-${year}${String(count).padStart(2, "0")}`;
}

export async function setQuoteStatus(quoteId: number, status: "accepted" | "rejected" | "converted") {
  await db
    .update(schema.billing_documents)
    .set({ status })
    .where(eq(schema.billing_documents.id, quoteId));
}

export async function acceptQuote(
  quote: BillingDocument,
  input: { signerName: string; signature: string; signedAt: string },
) {
  if (quote.kind !== "quote") throw new Error("Not a quote");
  if (quote.status === "converted") return quote;
  const [updated] = await db
    .update(schema.billing_documents)
    .set({
      status: "accepted",
      signed_by: input.signerName,
      signed_at: input.signedAt,
      signature: input.signature,
    })
    .where(eq(schema.billing_documents.id, quote.id))
    .returning();
  return updated as BillingDocument;
}

export async function convertQuoteToInvoice(quote: BillingDocument, allDocs: BillingDocument[]) {
  if (quote.kind !== "quote") throw new Error("Not a quote");
  const already = allDocs.find((d) => d.kind === "invoice" && d.source_quote_id === quote.id);
  if (already) return already;

  const [invoice] = await db
    .insert(schema.billing_documents)
    .values({
      client_id: quote.client_id,
      project_id: quote.project_id,
      kind: "invoice",
      number: nextBillingNumber("invoice", allDocs),
      title: quote.title,
      description: quote.description,
      amount: quote.amount,
      status: "sent",
      issued_on: isoDate(0),
      due_on: isoDate(30),
      notes: quote.notes,
      source_quote_id: quote.id,
      line_items: quote.line_items,
      subtotal: quote.subtotal,
      tax_gst: quote.tax_gst,
      tax_qst: quote.tax_qst,
      po_number: quote.po_number,
    })
    .returning();
  await setQuoteStatus(quote.id, "converted");
  return invoice as BillingDocument;
}
