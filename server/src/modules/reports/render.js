import PDFDocument from "pdfkit";

const money = (value) => Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value) => (value === "" || value == null ? "" : Number(value).toLocaleString("en-KE", { maximumFractionDigits: 2 }));
const dateText = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export const formatCell = (value, type) => {
  if (type === "money") return value === "" || value == null ? "" : money(value);
  if (type === "number") return number(value);
  if (type === "date") return dateText(value);
  if (value instanceof Date) return dateText(value);
  return value == null ? "" : String(value);
};

// ---------------------------------------------------------------------
// CSV: one block per section, separated by blank lines.
// ---------------------------------------------------------------------
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvRaw = (value, type) => {
  if (value instanceof Date || type === "date") return dateText(value);
  if (type === "money" || type === "number") return value === "" || value == null ? "" : Number(value);
  return value;
};

export const toCsv = (reports, { date, organisation }) => {
  const lines = [];
  const row = (cells) => lines.push(cells.map(csvCell).join(","));
  row([organisation]);
  row([`End of day report`, date]);
  for (const report of reports) {
    lines.push("");
    row([`${report.title} department`]);
    for (const item of report.summary) row([item.label, item.type === "money" ? Number(item.value) : item.value]);
    for (const section of report.sections) {
      lines.push("");
      row([section.title]);
      row(section.columns.map((c) => c.label));
      if (!section.rows.length) row(["No records"]);
      for (const data of section.rows) row(section.columns.map((c) => csvRaw(data[c.key], c.type)));
      if (section.totals) row(section.columns.map((c, i) => (i === 0 ? "Total" : section.totals[c.key] ?? "")));
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
};

// ---------------------------------------------------------------------
// PDF: A4 landscape with a header, summary boxes and simple tables.
// ---------------------------------------------------------------------
const GREEN = "#40532a";
const MUTED = "#5e6b5e";
const LINE = "#d9e5d5";

export const toPdf = (reports, { date, organisation, preparedBy }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, info: { Title: `End of day report ${date}` } });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 20;
  const ensure = (height) => {
    if (doc.y + height > bottom()) doc.addPage();
  };

  const header = (title) => {
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(15).text(organisation, left, doc.page.margins.top);
    doc.fillColor("#19271f").fontSize(12).text(`${title} - End of day report`, { continued: false });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Date: ${date}    Prepared by: ${preparedBy}    Printed: ${new Date().toLocaleString("en-KE")}`);
    doc.moveTo(left, doc.y + 4).lineTo(left + width, doc.y + 4).strokeColor(GREEN).lineWidth(1.5).stroke();
    doc.moveDown(1);
  };

  const summary = (items) => {
    const perRow = 4;
    const boxWidth = (width - (perRow - 1) * 8) / perRow;
    for (let i = 0; i < items.length; i += perRow) {
      ensure(44);
      const y = doc.y;
      items.slice(i, i + perRow).forEach((item, index) => {
        const x = left + index * (boxWidth + 8);
        doc.roundedRect(x, y, boxWidth, 38, 4).fillAndStroke("#f5f8f3", LINE);
        doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(item.label, x + 8, y + 6, { width: boxWidth - 16, lineBreak: false, ellipsis: true });
        doc.fillColor("#19271f").font("Helvetica-Bold").fontSize(12)
          .text(item.type === "money" ? `KES ${money(item.value)}` : number(item.value), x + 8, y + 19, { width: boxWidth - 16, lineBreak: false });
      });
      doc.y = y + 46;
    }
    doc.x = left;
    doc.moveDown(0.5);
  };

  const table = (section) => {
    ensure(50);
    doc.x = left;
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(10.5).text(section.title, left);
    doc.moveDown(0.3);
    const columns = section.columns;
    const numeric = (c) => ["money", "number"].includes(c.type);
    // Text columns get twice the width of number columns.
    const weights = columns.map((c) => (numeric(c) ? 1 : 2));
    const unit = width / weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => w * unit);
    const drawRow = (cells, { bold = false, fill } = {}) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const heights = cells.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - 8 }));
      const height = Math.max(...heights, 10) + 6;
      if (doc.y + height > bottom()) {
        doc.addPage();
      }
      const y = doc.y;
      if (fill) doc.rect(left, y, width, height).fill(fill);
      let x = left;
      cells.forEach((cell, i) => {
        doc.fillColor("#19271f").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
          .text(cell, x + 4, y + 3, { width: widths[i] - 8, align: numeric(columns[i]) ? "right" : "left" });
        x += widths[i];
      });
      doc.moveTo(left, y + height).lineTo(left + width, y + height).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = y + height;
    };
    drawRow(columns.map((c) => c.label), { bold: true, fill: "#ebf1e8" });
    if (!section.rows.length) {
      doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.5).text("No records for this day.", left + 4, doc.y + 4);
      doc.moveDown(0.6);
    }
    for (const data of section.rows) drawRow(columns.map((c) => formatCell(data[c.key], c.type)));
    if (section.totals) {
      drawRow(columns.map((c, i) => (i === 0 ? "Total" : section.totals[c.key] == null ? "" : formatCell(section.totals[c.key], c.type))), { bold: true, fill: "#f5f8f3" });
    }
    doc.x = left;
    doc.moveDown(1);
  };

  reports.forEach((report, index) => {
    if (index > 0) doc.addPage();
    header(report.title);
    summary(report.summary);
    report.sections.forEach(table);
  });

  // Page numbers and a signature line on the last page.
  ensure(50);
  doc.moveDown(1.5);
  doc.fillColor("#19271f").font("Helvetica").fontSize(9)
    .text("Checked by: ______________________________      Signature: ____________________      Date: ______________", left);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.fillColor(MUTED).fontSize(8).text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - doc.page.margins.bottom - 8, { width, align: "right", lineBreak: false });
  }
  doc.end();
});
