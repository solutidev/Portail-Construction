import { FormEvent, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { moneyExact } from "@/lib/format";
import { emptyLine, lineAmount, totalsFromLines } from "@/lib/invoice";
import type { BillingKind, Client, InvoiceLine, Project } from "@/lib/types";

export type BillingForm = {
  kind: BillingKind;
  number: string;
  title: string;
  description: string;
  status: string;
  client_id: string;
  project_id: string;
  issued_on: string;
  due_on: string;
  notes: string;
  po_number: string;
  lines: InvoiceLine[];
};

export function BillingEditor({
  form,
  setForm,
  clients,
  projects,
  saving,
  canSend,
  smtpReady,
  onCancel,
  onSaveDraft,
  onSend,
}: {
  form: BillingForm;
  setForm: (next: BillingForm) => void;
  clients: Client[];
  projects: Project[];
  saving: boolean;
  canSend: boolean;
  smtpReady: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onSend: () => void;
}) {
  const { t, locale } = useI18n();
  const clientProjects = projects.filter((p) => String(p.client_id) === form.client_id);
  const totals = useMemo(() => totalsFromLines(form.lines), [form.lines]);
  const selectedClient = clients.find((c) => String(c.id) === form.client_id);

  function patchLine(index: number, patch: Partial<InvoiceLine>) {
    setForm({
      ...form,
      lines: form.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onSaveDraft();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("billing.client")}>
          <Select
            value={form.client_id}
            onValueChange={(v) => setForm({ ...form, client_id: v, project_id: "none" })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("nav.selectClient")} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("billing.project")}>
          <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder={t("billing.noProject")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("billing.noProject")}</SelectItem>
              {clientProjects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("billing.number")}>
          <Input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        </Field>
        <Field label={t("invoice.po")}>
          <Input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
        </Field>
        <Field label={t("billing.docTitle")}>
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("billing.issued")}>
          <Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
        </Field>
        <Field label={t("billing.due")}>
          <Input type="date" value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} />
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("invoice.lines")}</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>
            <Plus className="size-3.5" />
            {t("invoice.addLine")}
          </Button>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("invoice.col.description")}</th>
                <th className="w-20 px-2 py-2 font-medium">{t("invoice.col.qty")}</th>
                <th className="w-20 px-2 py-2 font-medium">{t("invoice.unit")}</th>
                <th className="w-28 px-2 py-2 font-medium">{t("invoice.col.unit")}</th>
                <th className="w-28 px-2 py-2 text-right font-medium">{t("invoice.col.amount")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {form.lines.map((line, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <Input
                      value={line.description}
                      onChange={(e) => patchLine(i, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => patchLine(i, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={line.unit} onChange={(e) => patchLine(i, { unit: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => patchLine(i, { unit_price: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneyExact(lineAmount(line), locale)}</td>
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={form.lines.length === 1}
                      onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("invoice.subtotal")}</span>
            <span className="tabular-nums text-foreground">{moneyExact(totals.subtotal, locale)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("invoice.gst")}</span>
            <span className="tabular-nums text-foreground">{moneyExact(totals.tax_gst, locale)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("invoice.qst")}</span>
            <span className="tabular-nums text-foreground">{moneyExact(totals.tax_qst, locale)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-medium">
            <span>{t("invoice.total")}</span>
            <span className="tabular-nums">{moneyExact(totals.amount, locale)}</span>
          </div>
        </div>
      </div>

      <Field label={t("billing.description")}>
        <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label={t("project.notes")}>
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>

      {canSend && !smtpReady ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t("billing.smtpMissing")}</p>
      ) : null}
      {canSend && selectedClient && !selectedClient.email ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t("billing.noClientEmail")}</p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("clients.cancel")}
        </Button>
        <Button type="submit" variant="outline" disabled={saving || !form.client_id}>
          {saving ? t("clients.saving") : t("billing.saveDraft")}
        </Button>
        {canSend ? (
          <Button
            type="button"
            disabled={saving || !form.client_id || !smtpReady || !selectedClient?.email}
            onClick={onSend}
          >
            {saving ? t("clients.saving") : t("billing.sendClient")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
