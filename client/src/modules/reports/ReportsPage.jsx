import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileBarChart2, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { Alert, Button, Card, Input, PageHeader, Select, Spinner, StatCard } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { download, errorMessage } from "../../lib/api";
import { showError } from "../../lib/toast";
import { date, money, number, today } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";

const cell = (value, type) => {
  if (type === "percent") return value === "" || value == null ? "" : `${number(value)}%`;
  if (type === "money") return value === "" || value == null ? "" : money(value);
  if (type === "number") return number(value);
  if (type === "date") return date(value);
  return value ?? "";
};
const numeric = (type) => ["money", "number", "percent"].includes(type);
// Shortfalls and falls read in red, as on a paper report.
const tone = (value, type) => (numeric(type) && Number(value) < 0 ? "text-rose-700" : "");
// Wide tables (the cane status sheet has 12 columns) get tighter cells.
const pad = (section) => (section.columns.length > 8 ? "px-3" : "px-5");
const summaryValue = (s) => (s.type === "money" ? money(s.value) : s.type === "text" ? s.value : cell(s.value, s.type || "number"));

/** A report: summary figures, then one table per section. `children` go between the two (e.g. a chart). */
export const ReportView = ({ report, emptyText = "No records for this day.", children }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {report.summary.map((s) => <StatCard key={s.label} label={s.label} value={<span className={tone(s.value, s.type || "number")}>{summaryValue(s)}</span>} />)}
    </div>
    {children}
    {report.sections.map((section) => (
      <Card key={section.title} className="overflow-hidden">
        <h3 className="border-b border-slate-100 px-5 py-3.5 text-[15px] font-semibold text-slate-900">{section.title}</h3>
        {section.rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-400">{emptyText}</p> : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold text-slate-500">
                <tr>{section.columns.map((c) => <th key={c.key} className={`whitespace-nowrap ${pad(section)} py-2.5 ${numeric(c.type) ? "text-right" : ""}`}>{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row, i) => <tr key={i} className="hover:bg-slate-50">{section.columns.map((c) => <td key={c.key} className={`${pad(section)} py-3 text-slate-700 ${numeric(c.type) ? "whitespace-nowrap text-right tabular-nums" : c.weight >= 2 ? "min-w-[22rem]" : ""} ${tone(row[c.key], c.type)}`}>{cell(row[c.key], c.type)}</td>)}</tr>)}
              </tbody>
              {section.totals && (
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <tr>{section.columns.map((c, i) => <td key={c.key} className={`${pad(section)} py-3 ${numeric(c.type) ? "whitespace-nowrap text-right tabular-nums" : ""} ${tone(section.totals[c.key], c.type)}`}>{i === 0 ? "Total" : section.totals[c.key] != null ? cell(section.totals[c.key], c.type) : ""}</td>)}</tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    ))}
  </div>
);

const ReportsPage = () => {
  const { permissions, user, label, meta } = useAuth();
  const allowed = permissions?.reports || [];
  const [params] = useSearchParams();
  const requested = params.get("department");
  const [department, setDepartment] = useState(
    requested && allowed.includes(requested) ? requested : user?.department && allowed.includes(user.department) ? user.department : allowed[0] || "",
  );
  const [day, setDay] = useState(today());
  const [busy, setBusy] = useState("");
  const { data, loading, error: loadError } = useFetch(department ? "/reports/daily" : null, { department, date: day });

  const options = [
    ...(meta?.departments || []).filter((d) => allowed.includes(d.value)),
    ...(allowed.length > 1 ? [{ value: "all", label: "All departments" }] : []),
  ];

  const get = async (format) => {
    setBusy(format);
    try {
      await download("/reports/daily", { department, date: day, format }, `keiyian-${department}-eod-${day}.${format}`);
    } catch (err) {
      showError(errorMessage(err, "The report could not be downloaded. Please try again."), "Download failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageHeader icon={FileBarChart2} eyebrow="Workflow" title="End-of-day reports" description="Each department's day: what came in, what went out and the closing position. Download as PDF to print or CSV for Excel." />
      <Card className="mb-6 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] text-xs font-medium text-slate-500">Department
            <Select className="mt-1 block" options={options} placeholder="Choose..." value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-slate-500">Date
            <Input type="date" className="mt-1 block" max={today()} value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileDown} loading={busy === "pdf"} disabled={!department} onClick={() => get("pdf")}>Download PDF</Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === "csv"} disabled={!department} onClick={() => get("csv")}>Download CSV</Button>
            <Button variant="ghost" icon={Printer} onClick={() => window.print()}>Print view</Button>
          </div>
        </div>
      </Card>
      <Alert tone="error" className="mb-4">{loadError}</Alert>
      {!allowed.length && <Alert tone="info">Your account does not have access to any department reports.</Alert>}
      {loading && <Spinner label="Building report..." />}
      {!loading && data?.reports?.map((report) => (
        <section key={report.department} className="mb-8">
          <h2 className="mb-4 flex items-baseline gap-2 text-lg font-semibold tracking-tight text-slate-900">{label("departments", report.department)} <span className="text-sm font-normal text-slate-500">{date(`${data.date}T00:00:00Z`)}</span></h2>
          <ReportView report={report} />
        </section>
      ))}
    </div>
  );
};

export default ReportsPage;
