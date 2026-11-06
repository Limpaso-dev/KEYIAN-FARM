import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { Alert, Button, Card, Input, PageHeader, Select, Spinner, StatCard } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { download, errorMessage } from "../../lib/api";
import { date, money, number, today } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";

const cell = (value, type) => {
  if (type === "money") return value === "" || value == null ? "" : money(value);
  if (type === "number") return number(value);
  if (type === "date") return date(value);
  return value ?? "";
};
const numeric = (type) => ["money", "number"].includes(type);

export const ReportView = ({ report }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {report.summary.map((s) => <StatCard key={s.label} label={s.label} value={s.type === "money" ? money(s.value) : number(s.value)} />)}
    </div>
    {report.sections.map((section) => (
      <Card key={section.title} className="overflow-hidden">
        <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">{section.title}</h3>
        {section.rows.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">No records for this day.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>{section.columns.map((c) => <th key={c.key} className={`px-3 py-2 ${numeric(c.type) ? "text-right" : ""}`}>{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row, i) => <tr key={i}>{section.columns.map((c) => <td key={c.key} className={`px-3 py-2 ${numeric(c.type) ? "text-right tabular-nums" : ""}`}>{cell(row[c.key], c.type)}</td>)}</tr>)}
              </tbody>
              {section.totals && (
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <tr>{section.columns.map((c, i) => <td key={c.key} className={`px-3 py-2 ${numeric(c.type) ? "text-right tabular-nums" : ""}`}>{i === 0 ? "Total" : section.totals[c.key] != null ? cell(section.totals[c.key], c.type) : ""}</td>)}</tr>
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
  const [error, setError] = useState("");
  const { data, loading, error: loadError } = useFetch(department ? "/reports/daily" : null, { department, date: day });

  const options = [
    ...(meta?.departments || []).filter((d) => allowed.includes(d.value)),
    ...(allowed.length > 1 ? [{ value: "all", label: "All departments" }] : []),
  ];

  const get = async (format) => {
    setBusy(format);
    setError("");
    try {
      await download("/reports/daily", { department, date: day, format }, `keiyian-${department}-eod-${day}.${format}`);
    } catch (err) {
      setError(errorMessage(err, "The report could not be downloaded"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageHeader title="End of day reports" description="Each department's day: what came in, what went out and the closing position. Download as PDF to print or CSV for Excel." />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] text-xs font-medium text-slate-600">Department
            <Select className="mt-1" options={options} placeholder="Choose..." value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-600">Date
            <Input type="date" className="mt-1" max={today()} value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileDown} loading={busy === "pdf"} disabled={!department} onClick={() => get("pdf")}>Download PDF</Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === "csv"} disabled={!department} onClick={() => get("csv")}>Download CSV</Button>
            <Button variant="ghost" icon={Printer} onClick={() => window.print()}>Print view</Button>
          </div>
        </div>
      </Card>
      <Alert tone="error" className="mb-4">{error || loadError}</Alert>
      {!allowed.length && <Alert tone="info">Your account does not have access to any department reports.</Alert>}
      {loading && <Spinner label="Building report..." />}
      {!loading && data?.reports?.map((report) => (
        <section key={report.department} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{label("departments", report.department)} <span className="text-sm font-normal text-slate-500">- {date(`${data.date}T00:00:00Z`)}</span></h2>
          <ReportView report={report} />
        </section>
      ))}
    </div>
  );
};

export default ReportsPage;
