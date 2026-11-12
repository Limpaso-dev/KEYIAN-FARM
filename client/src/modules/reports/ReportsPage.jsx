import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { FileBarChart2, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { PeriodPicker } from "../../components/reports/PeriodPicker";
import { PrintArea, ReportDocument } from "../../components/reports/ReportDocument";
import { Alert, Button, Card, PageHeader, Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { currentSection, defaultReportDepartment, findNavItem, linksOf, sectionsFor } from "../../navigation";
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
  const auth = useAuth();
  const { permissions, meta } = auth;
  const allowed = permissions?.reports || [];
  // The report shown is the one in the address (?department=stores&part=out): it is chosen from the Reports dropdown in the sidebar.
  const [params] = useSearchParams();
  const { search } = useLocation();
  const navItem = findNavItem("/reports");
  const shown = currentSection(navItem, auth, search);
  const several = linksOf(sectionsFor(navItem, auth)).length > 1;
  const asked = params.get("department");
  const department = asked && (allowed.includes(asked) || (asked === "all" && allowed.length > 1)) ? asked : defaultReportDepartment(auth);
  // Some departments' reports come in parts (Stores: stock out, goods received, stock remaining), printed alone or together.
  const parts = department && department !== "all" ? meta?.reportParts?.[department] || [] : [];
  const part = parts.find((p) => p.key === params.get("part"));
  const [period, setPeriod] = useState(() => ({ period: "day", date: today() }));
  const [busy, setBusy] = useState("");
  const query = { department, ...(part ? { part: part.key } : {}), ...periodParams(period) };
  const { data, loading, error: loadError } = useFetch(department ? "/reports/department" : null, query);
  const reports = data?.reports || [];

  const get = async (format) => {
    setBusy(format);
    try {
      const name = part ? `${part.title.toLowerCase().replace(/\s+/g, "-")}-` : "";
      await download("/reports/department", { ...query, format }, `keiyian-${department}-${name}report-${data?.period?.slug || "report"}.${format}`);
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
        eyebrow="Reports"
        title={shown?.crumb || "Reports"}
        description={`For a day, a week, two weeks, a month, a quarter, a half year or a year. Print it, or download it as PDF or for Excel.${several ? " Other reports are under Reports in the sidebar." : ""}`}
      />
      <Card className="mb-6 space-y-4 p-4 sm:p-5">
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
