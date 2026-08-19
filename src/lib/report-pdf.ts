import { jsPDF } from "jspdf";
import { downloadBlob } from "./download";
import { formatDate } from "./format";
import type { Locale } from "./types";
import type { BuiltReport } from "./project-report";

const YELLOW: [number, number, number] = [251, 170, 25];
const BLACK: [number, number, number] = [18, 18, 16];
const CONCRETE: [number, number, number] = [81, 81, 78];
const PALE: [number, number, number] = [209, 211, 212];
const PAPER: [number, number, number] = [252, 251, 247];
const INK: [number, number, number] = [36, 36, 33];

function paintCover(pdf: jsPDF, report: BuiltReport, locale: Locale) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(...PAPER);
  pdf.rect(0, 0, w, h, "F");
  pdf.setFillColor(...BLACK);
  pdf.rect(0, 0, 18, h, "F");
  pdf.setFillColor(...YELLOW);
  pdf.rect(18, 0, 6, h, "F");

  pdf.setTextColor(...YELLOW);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text("FRX", 36, 36);
  pdf.setFontSize(9);
  pdf.setTextColor(...CONCRETE);
  pdf.setFont("helvetica", "normal");
  pdf.text("CONSTRUCTION", 36, 42);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...CONCRETE);
  pdf.text(report.company.legal_name.toUpperCase(), 36, 58);

  pdf.setDrawColor(...PALE);
  pdf.setLineWidth(0.4);
  pdf.line(36, 64, w - 20, 64);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...CONCRETE);
  pdf.text(locale === "fr" ? "LIVRET DE RAPPORT" : "PROJECT REPORT BOOKLET", 36, 78);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(...INK);
  const title = pdf.splitTextToSize(report.title, w - 60);
  pdf.text(title, 36, 94);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.text(report.project.name, 36, 94 + title.length * 10 + 6);
  pdf.setFontSize(11);
  pdf.setTextColor(...CONCRETE);
  pdf.text(report.project.project_number, 36, 94 + title.length * 10 + 14);

  const metaY = h - 58;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(36, metaY, w - 56, 38, 2, 2, "F");
  pdf.setDrawColor(...PALE);
  pdf.roundedRect(36, metaY, w - 56, 38, 2, 2, "S");
  pdf.setFontSize(8);
  pdf.setTextColor(...CONCRETE);
  const client = report.client?.company_name ?? "—";
  const lines = [
    [locale === "fr" ? "CLIENT" : "CLIENT", client],
    [locale === "fr" ? "PRÉPARÉ PAR" : "PREPARED BY", report.preparedBy],
    [locale === "fr" ? "DATE" : "DATE", formatDate(report.preparedOn, locale)],
    [locale === "fr" ? "LIEU" : "LOCATION", [report.project.address, report.project.city].filter(Boolean).join(", ") || "—"],
  ];
  lines.forEach((row, i) => {
    const x = 44 + (i % 2) * 80;
    const y = metaY + 12 + Math.floor(i / 2) * 14;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...CONCRETE);
    pdf.text(row[0], x, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(row[1], x, y + 5);
  });
}

function footer(pdf: jsPDF, page: number, total: number, report: BuiltReport) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(...YELLOW);
  pdf.rect(0, h - 8, w, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...BLACK);
  pdf.text("FRX", 14, h - 3);
  pdf.setFont("helvetica", "normal");
  pdf.text(report.company.legal_name, 26, h - 3);
  pdf.text(`${page} / ${total}`, w - 14, h - 3, { align: "right" });
}

export function buildReportPdf(report: BuiltReport, locale: Locale) {
  const pdf = new jsPDF({ unit: "mm", format: "letter" });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  paintCover(pdf, report, locale);

  report.sections.forEach((section) => {
    pdf.addPage();
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, w, h, "F");
    pdf.setFillColor(...YELLOW);
    pdf.rect(0, 0, w, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...BLACK);
    pdf.text(report.project.project_number, 16, 5.5);
    pdf.text(report.company.legal_name, w - 16, 5.5, { align: "right" });

    pdf.setFontSize(18);
    pdf.setTextColor(...INK);
    pdf.text(section.title, 16, 24);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...CONCRETE);
    const summary = pdf.splitTextToSize(section.summary || "—", w - 32);
    pdf.text(summary, 16, 32);

    let y = 32 + summary.length * 5 + 8;
    if (section.rows.length === 0) {
      pdf.setTextColor(...CONCRETE);
      pdf.text(locale === "fr" ? "Aucune donnée pour cette section." : "No records in this section.", 16, y);
    } else {
      section.rows.forEach((row, index) => {
        if (y > h - 22) {
          pdf.addPage();
          pdf.setFillColor(...PAPER);
          pdf.rect(0, 0, w, h, "F");
          pdf.setFillColor(...YELLOW);
          pdf.rect(0, 0, w, 8, "F");
          y = 20;
        }
        if (index % 2 === 0) {
          pdf.setFillColor(245, 244, 239);
          pdf.rect(14, y - 4.5, w - 28, 10, "F");
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...INK);
        const label = pdf.splitTextToSize(row.label, 78);
        pdf.text(label, 16, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...CONCRETE);
        const value = pdf.splitTextToSize(row.value, w - 110);
        pdf.text(value, 98, y);
        y += Math.max(label.length, value.length) * 4.4 + 6;
      });
    }
  });

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    pdf.setPage(i);
    footer(pdf, i, total, report);
  }
  return pdf;
}

export function downloadReportPdf(report: BuiltReport, locale: Locale) {
  const pdf = buildReportPdf(report, locale);
  const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadBlob(pdf.output("blob"), `${report.project.project_number}-${slug || "report"}.pdf`);
}

export function reportPdfBase64(report: BuiltReport, locale: Locale) {
  return buildReportPdf(report, locale).output("datauristring").split(",")[1] ?? "";
}
