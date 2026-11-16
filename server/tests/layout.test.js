import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { fitColumns, paginate } from "../src/modules/reports/layout.js";

const sum = (list) => list.reduce((a, b) => a + b, 0);
const close = (a, b) => Math.abs(a - b) < 0.01;

test("columns that fit get their full width and share what is left equally", () => {
  const widths = fitColumns([{ min: 40, max: 100 }, { min: 50, max: 60 }, { min: 30, max: 40 }], 500);
  assert.ok(close(sum(widths), 500));
  assert.deepEqual(widths.map(Math.round), [100 + 100, 60 + 100, 40 + 100]);
});

test("too wide: short columns keep their width, only the long ones wrap, to the same width", () => {
  // A date, a reference, two long descriptions and an amount.
  const columns = [{ min: 70, max: 70 }, { min: 90, max: 90 }, { min: 60, max: 400 }, { min: 50, max: 300 }, { min: 80, max: 80 }];
  const widths = fitColumns(columns, 600);
  assert.ok(close(sum(widths), 600));
  assert.deepEqual(widths.slice(0, 2).map(Math.round), [70, 90]);
  assert.equal(Math.round(widths[4]), 80);
  assert.ok(close(widths[2], widths[3]), "the long columns are narrowed alike");
});

test("never narrower than a column's longest word or figure; null when even that cannot fit", () => {
  const widths = fitColumns([{ min: 200, max: 500 }, { min: 20, max: 500 }], 400);
  assert.ok(widths[0] >= 200 && close(sum(widths), 400));
  assert.equal(fitColumns([{ min: 300, max: 300 }, { min: 200, max: 300 }], 400), null);
});

const report = (tables, extra = {}) => ({ header: 100, runningHeader: 20, signOff: 90, tables, ...extra });
const table = (rows, { foot = 0, height = 20 } = {}) => ({ title: 20, continuedTitle: 20, head: 20, rows: Array(rows).fill(height), foot });
const rowsOn = (page) => page.blocks.filter((b) => b.type === "table").reduce((n, b) => n + b.to - b.from, 0);

test("a short report is one page with the sign-off at its foot", () => {
  const pages = paginate([report([table(3), table(2)])], { page: 500, gap: 10 });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].first, true);
  assert.deepEqual(pages[0].blocks.at(-1), { type: "signoff" });
});

test("a long table continues on the next pages under its headings, every row once", () => {
  const pages = paginate([report([table(60, { foot: 20 })])], { page: 500, gap: 10 });
  assert.ok(pages.length >= 3);
  assert.equal(sum(pages.map(rowsOn)), 60);
  const parts = pages.flatMap((p) => p.blocks).filter((b) => b.type === "table");
  assert.equal(parts[0].continued, false);
  assert.ok(parts.slice(1).every((b) => b.continued));
  assert.equal(parts.filter((b) => b.foot).length, 1, "the totals print once");
  assert.ok(parts.at(-1).foot, "with the last rows");
  assert.equal(pages.filter((p) => p.blocks.some((b) => b.type === "signoff")).length, 1);
});

test("a table does not start at the foot of a page with fewer than two rows", () => {
  // 100 header + 20+20+3x20 first table + gap 10 = 230; the second needs 20+20+40 = 80 more.
  const pages = paginate([report([table(3), table(10)])], { page: 300, gap: 10 });
  const second = pages.flatMap((p, i) => p.blocks.map((b) => ({ ...b, page: i }))).filter((b) => b.type === "table" && b.table === 1);
  assert.ok(second[0].to - second[0].from >= 2 || second[0].page === 1);
});

test("a lone last row is never left for the next page", () => {
  // Room for exactly 15 rows of 20 after the header, title and headings; the table has 16.
  const pages = paginate([report([table(16)], { header: 0, signOff: 0 })], { page: 340, gap: 0 });
  const parts = pages.flatMap((p) => p.blocks).filter((b) => b.type === "table");
  assert.ok(parts.every((b) => b.to - b.from >= 2), JSON.stringify(parts));
});

test("the sign-off never stands alone: it takes the last rows, or a short last table, with it", () => {
  const full = paginate([report([table(18)])], { page: 520, gap: 10 });
  const last = full.at(-1).blocks;
  assert.equal(last.at(-1).type, "signoff");
  assert.ok(last.length > 1, "carried rows come with the sign-off");
  assert.equal(sum(full.map(rowsOn)), 18);

  const short = paginate([report([table(18), table(1, { foot: 20 })])], { page: 600, gap: 10 });
  const end = short.at(-1).blocks;
  assert.deepEqual(end.map((b) => b.type), ["table", "signoff"]);
});

test("each report starts on its own page", () => {
  const pages = paginate([report([table(2)]), report([table(2)])], { page: 500, gap: 10 });
  assert.deepEqual(pages.map((p) => [p.report, p.first]), [[0, true], [1, true]]);
});

test("the client lays reports out with the same file", (t) => {
  const client = fileURLToPath(new URL("../../client/src/components/reports/layout.js", import.meta.url));
  if (!fs.existsSync(client)) return t.skip("no client folder here");
  const server = fileURLToPath(new URL("../src/modules/reports/layout.js", import.meta.url));
  assert.equal(fs.readFileSync(client, "utf8").replace(/\r\n/g, "\n"), fs.readFileSync(server, "utf8").replace(/\r\n/g, "\n"));
});
