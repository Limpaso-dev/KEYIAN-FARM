import test from "node:test";
import assert from "node:assert/strict";
import { formatCell, toCsv, toPdf } from "../src/modules/reports/render.js";

const report = {
  title: "Sales",
  summary: [{ label: "Local sales", value: 1250, type: "money" }, { label: "Open vehicles", value: 1 }],
  sections: [
    {
      title: "Local sales",
      columns: [{ key: "customer", label: "Customer" }, { key: "total", label: "Total", type: "money" }],
      rows: [{ customer: 'Mama "Njeri", Shop', total: 1000 }, { customer: "Walk-in", total: 250 }],
      totals: { total: 1250 },
    },
    { title: "Damages", columns: [{ key: "x", label: "X" }], rows: [] },
  ],
};
const meta = { date: "2026-11-06", organisation: "Keiyian Farmers Cooperative Society", preparedBy: "Tester" };

test("CSV quotes commas and quotes, includes totals and empty sections", () => {
  const csv = toCsv([report], meta);
  assert.match(csv, /"Mama ""Njeri"", Shop",1000/);
  assert.match(csv, /Total,1250/);
  assert.match(csv, /No records/);
});

test("PDF renders a valid document", async () => {
  const pdf = await toPdf([report, report], meta);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1500);
});

test("cell formatting", () => {
  assert.equal(formatCell(1234.5, "money"), "1,234.50");
  assert.equal(formatCell(new Date("2026-11-06T00:00:00Z"), "date"), "2026-11-06");
  assert.equal(formatCell(null), "");
});

test("PDF page numbers do not add blank pages", async () => {
  const pages = (pdf) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
  assert.equal(pages(await toPdf([report], meta)), 1);
  assert.equal(pages(await toPdf([report, report], meta)), 2);
  // Crop reports carry the period, motto and a sign-off per report.
  const crop = await toPdf([report, report], { ...meta, reportName: "Crop report", periodText: "May 2024", motto: "Nuru ya Jamii", signatures: ["Prepared by", "Checked by", "Confirmed by"], signEachReport: true });
  assert.equal(pages(crop), 2);
});

test("CSV for a period report names the report and period", () => {
  const csv = toCsv([{ ...report, heading: "Tea farm report - May 2024", summary: [{ label: "Achieved", value: 110.25, type: "percent" }] }], { ...meta, reportName: "Crop report", periodText: "May 2024" });
  assert.match(csv, /Crop report,May 2024/);
  assert.match(csv, /Tea farm report - May 2024/);
  assert.match(csv, /Achieved,110.25/);
});
