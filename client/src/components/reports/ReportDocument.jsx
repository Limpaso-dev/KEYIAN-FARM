import { cx } from "../../lib/cx";
import { alignRight, cell, isNegative } from "./reportText";

// A ruled table (rows and columns) in the reports' style, for tables shown
// within a page - the HR overview, a staff profile, Accounts' department
// summary. Reports themselves are A4 pages: see ReportSheets.

/** One table: a title, column headings, rows, an optional totals row, and what to say when it is empty. */
export const ReportTable = ({ section, emptyText = "No records for this period.", narrow = false }) => {
  // Wide tables get tighter cells.
  const pad = section.columns.length > 8 ? "px-2 py-1.5" : "px-3 py-1.5";
  return (
    <section className="report-table">
      <h3 className="mb-1.5 text-sm font-semibold text-primary-800">{section.title}</h3>
      <div className={cx("scrollbar-thin overflow-x-auto", narrow && "max-w-xl")}>
        <table className="w-full border-collapse text-[13px] leading-snug">
          <thead>
            <tr className="bg-slate-100">
              {section.columns.map((c) => (
                <th key={c.key} scope="col" className={cx("border border-slate-300 align-bottom text-xs font-semibold text-slate-700", pad, alignRight(c) ? "text-right" : "text-left")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.length === 0 ? (
              <tr><td colSpan={section.columns.length} className={cx("border border-slate-300 italic text-slate-400", pad)}>{section.emptyText || emptyText}</td></tr>
            ) : section.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {section.columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      "border border-slate-300 align-top",
                      pad,
                      alignRight(c) && "whitespace-nowrap text-right tabular-nums",
                      (c.weight ?? 0) >= 2 && "report-wide-cell",
                      isNegative(row[c.key], c) ? "text-rose-700" : "text-slate-800",
                    )}
                  >
                    {cell(row[c.key], c.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {section.totals && (
            <tfoot>
              <tr className="bg-slate-100 font-semibold text-slate-900">
                {section.columns.map((c, i) => {
                  const value = section.totals[c.key];
                  return (
                    <td key={c.key} className={cx("border border-slate-300", pad, alignRight(c) && "whitespace-nowrap text-right tabular-nums", isNegative(value, c) && "text-rose-700")}>
                      {i === 0 ? section.totalLabel || "Total" : value != null ? cell(value, c.type) : ""}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
};
