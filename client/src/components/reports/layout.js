// How a report is laid out on A4 pages. The server's PDF and the client's
// sheets (on screen and printed) both use this file, each measuring in its
// own units (points or pixels), so a report breaks into the same pages
// wherever it is read. The copy in client/src/components/reports/layout.js
// must stay identical (a server test checks).

/** A4 landscape, in millimetres: the page, its margins and the footer band. */
export const SHEET = { width: 297, height: 210, margin: 12, footer: 7 };

const sum = (list) => list.reduce((a, b) => a + b, 0);

/**
 * Shares a table's width among its columns, so the page is used evenly.
 * Each column is { min, max }: the narrowest it can be without breaking a
 * word, date or figure, and the width of its longest entry on one line.
 *
 * - Everything fits on one line: each column gets its longest entry and the
 *   space left over is shared equally.
 * - It does not: short columns (dates, numbers, references) keep their full
 *   width and only the longest ones wrap, all narrowed to the same width.
 * - Even the narrowest widths do not fit: null (use a smaller type).
 */
export const fitColumns = (columns, width) => {
  const longest = sum(columns.map((c) => c.max));
  if (longest <= width) {
    const extra = (width - longest) / columns.length;
    return columns.map((c) => c.max + extra);
  }
  if (sum(columns.map((c) => c.min)) > width) return null;
  // The widest any column may be for the table to fill the width exactly.
  const at = (cap) => sum(columns.map((c) => Math.min(c.max, Math.max(c.min, cap))));
  let low = 0;
  let high = Math.max(...columns.map((c) => c.max));
  for (let step = 0; step < 50; step += 1) {
    const mid = (low + high) / 2;
    if (at(mid) > width) high = mid;
    else low = mid;
  }
  const widths = columns.map((c) => Math.min(c.max, Math.max(c.min, low)));
  const narrowed = widths.map((w, i) => w < columns[i].max);
  const share = narrowed.filter(Boolean).length;
  const left = width - sum(widths);
  return widths.map((w, i) => (share ? (narrowed[i] ? w + left / share : w) : w + left / widths.length));
};

/**
 * Lays reports out on pages. Heights are measured by the caller:
 *
 *   reports: [{ header, runningHeader, signOff,
 *               tables: [{ title, continuedTitle, head, rows: [h, ...], foot }] }]
 *   page:    the usable height of a page, between the top margin and the footer
 *   gap:     the space after each table
 *
 * Each report starts on a new page under its full header; later pages carry
 * a one-line running header. A table starts on a page only if its title,
 * headings and first two rows fit; it continues on the next page under its
 * headings again; its totals row stays with the last row; a lone last row is
 * never left for the next page. The sign-off sits at the foot of the
 * report's last page, and takes the last rows of the table with it when it
 * has to start a page, so it is never on a page by itself.
 *
 * Returns pages: [{ report, first, blocks: [
 *   { type: "table", table, from, to, foot, continued } | { type: "signoff" } ] }]
 * (rows from <= i < to).
 */
export const paginate = (reports, { page, gap }) => {
  const pages = [];
  reports.forEach((report, index) => {
    let current;
    let y = 0;
    const open = (first) => {
      current = { report: index, first, blocks: [] };
      pages.push(current);
      y = first ? report.header : report.runningHeader;
    };
    open(true);

    report.tables.forEach((table, t) => {
      const count = table.rows.length;
      const unit = (i) => table.rows[i] + (i === count - 1 ? table.foot || 0 : 0);
      let from = 0;
      let continued = false;
      while (from < count) {
        const lead = (continued ? table.continuedTitle : table.title) + table.head;
        const opening = unit(from) + (from + 1 < count ? unit(from + 1) : 0);
        if (current.blocks.length && y + lead + opening > page) open(false);
        y += lead;
        let to = from;
        while (to < count && (y + unit(to) <= page || to === from)) {
          y += unit(to);
          to += 1;
        }
        // Never leave just the last row (and the totals) for the next page.
        if (to === count - 1 && to - from >= 3) {
          to -= 1;
          y -= unit(to);
        }
        current.blocks.push({ type: "table", table: t, from, to, foot: to === count && Boolean(table.foot), continued });
        from = to;
        if (from < count) {
          open(false);
          continued = true;
        } else {
          y += gap;
        }
      }
    });

    if (y + report.signOff <= page) {
      current.blocks.push({ type: "signoff" });
      return;
    }
    // No room for the sign-off: it takes the last two rows of the last table
    // over with it, or the whole of a short last table.
    const last = current.blocks[current.blocks.length - 1];
    const carried = [];
    if (last?.type === "table" && last.to - last.from >= 4) {
      carried.push({ ...last, from: last.to - 2, continued: true });
      last.to -= 2;
      last.foot = false;
    } else if (last?.type === "table" && current.blocks.length > 1) {
      carried.push(current.blocks.pop());
    }
    open(false);
    current.blocks.push(...carried, { type: "signoff" });
  });
  return pages;
};
