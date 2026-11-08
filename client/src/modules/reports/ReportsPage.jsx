import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileBarChart2, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { PeriodPicker } from "../../components/reports/PeriodPicker";
import { PrintArea, ReportDocument } from "../../components/reports/ReportDocument";
import { Alert, Button, Card, PageHeader, Select, Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { download, errorMessage } from "../../lib/api";
import { cx } from "../../lib/cx";
import { today } from "../../lib/format";
import { periodParams } from "../../lib/periods";
import { showError } from "../../lib/toast";
import { useFetch } from "../../lib/useFetch";

/**
 * Department reports for any period - a day (urgent), a week, two weeks, a
 * month, a quarter, a half year, a year or a custom range. Print gives just
 * the report; PDF and CSV (Excel) downloads carry the same layout.
 */
const ReportsPage = () => {
  const { permissions, user, meta } = useAuth();
  const allowed = permissions?.reports || [];
  const [params] = useSearchParams();
  const requested = params.get("department");
  const [department, setDepartment] = useState(
    requested && allowed.includes(requested) ? requested : user?.department && allowed.includes(user.department) ? user.department : allowed[0] || "",
  );
  const [period, setPeriod] = useState(() => ({ period: "day", date: today() }));
  const [busy, setBusy] = useState("");
  const query = { department, ...periodParams(period) };
  const { data, loading, error: loadError } = useFetch(department ? "/reports/department" : null, query);
  const reports = data?.reports || [];

  const options = [
    ...(meta?.departments || []).filter((d) => allowed.includes(d.value)),
    ...(allowed.length > 1 ? [{ value: "all", label: "All departments" }] : []),
  ];

  const get = async (format) => {
    setBusy(format);
    try {
      await download("/reports/department", { ...query, format }, `keiyian-${department}-report-${data?.period?.slug || "report"}.${format}`);
    } catch (err) {
      showError(errorMessage(err, "The report could not be downloaded. Please try again."), "Download failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageHeader
        icon={FileBarChart2}
        eyebrow="Workflow"
        title="Reports"
        description="Department reports for a day, a week, two weeks, a month, a quarter, a half year or a year. Print them, or download them as PDF or for Excel."
      />
      <Card className="mb-6 space-y-4 p-4 sm:p-5">
        <label className="block max-w-xs text-xs font-medium text-slate-500">
          Department
          <Select className="mt-1 block" options={options} placeholder="Choose..." value={department} onChange={(e) => setDepartment(e.target.value)} />
        </label>
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">
            {data?.period ? <><span className="font-semibold text-slate-900">{data.period.label}</span><span className="text-slate-400"> · </span>{data.period.rangeText}</> : " "}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Printer} disabled={!reports.length || loading} onClick={() => window.print()}>Print</Button>
            <Button icon={FileDown} loading={busy === "pdf"} disabled={!department || Boolean(busy)} onClick={() => get("pdf")}>Download PDF</Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === "csv"} disabled={!department || Boolean(busy)} onClick={() => get("csv")}>Excel (CSV)</Button>
          </div>
        </div>
      </Card>

      <Alert tone="error" className="mb-4">{loadError}</Alert>
      {!allowed.length && <Alert tone="info">Your account does not have access to any department reports.</Alert>}
      {loading && !data && <Spinner label="Building report..." />}
      <div className={cx("space-y-8 transition-opacity", loading && data && "opacity-60")}>
        {reports.map((report) => <ReportDocument key={report.department} report={report} meta={data} />)}
      </div>
      {reports.length > 0 && (
        <PrintArea>
          {reports.map((report) => <ReportDocument key={report.department} report={report} meta={data} />)}
        </PrintArea>
      )}
    </div>
  );
};

export default ReportsPage;
