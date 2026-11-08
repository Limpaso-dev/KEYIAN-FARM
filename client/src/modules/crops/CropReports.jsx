import { useState } from "react";
import { FileDown, FileSpreadsheet, Printer, Sprout } from "lucide-react";
import { PeriodPicker } from "../../components/reports/PeriodPicker";
import { PrintArea, ReportDocument } from "../../components/reports/ReportDocument";
import { Alert, Button, Card, EmptyState, Spinner } from "../../components/ui/ui";
import { Segmented } from "../../components/ui/Segmented";
import { download, errorMessage } from "../../lib/api";
import { cx } from "../../lib/cx";
import { today } from "../../lib/format";
import { periodParams } from "../../lib/periods";
import { showError } from "../../lib/toast";
import { useFetch } from "../../lib/useFetch";

const CROPS = [
  { value: "all", label: "All crops" },
  { value: "tea", label: "Tea" },
  { value: "sugarcane", label: "Sugarcane" },
  { value: "coffee", label: "Coffee" },
  { value: "fodder", label: "Fodder" },
];

const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Crop reports, laid out like the cooperative's tea and cane sheets, for any
 * period: a day, a week, two weeks, a month, a quarter, a half year, a year
 * or a custom range. Print gives just the reports; PDF and CSV (Excel)
 * downloads carry the same layout.
 */
const CropReports = () => {
  const [crop, setCrop] = useState("all");
  const [period, setPeriod] = useState(() => ({ period: "month", date: today() }));
  const [busy, setBusy] = useState("");

  const query = { crop, ...periodParams(period) };
  const { data, loading, error } = useFetch("/crops/reports", query);
  const reports = data?.reports || [];
  const printable = reports.filter((r) => r.counts.farms || r.counts.records);

  const get = async (format) => {
    setBusy(format);
    try {
      await download("/crops/reports", { ...query, format }, `keiyian-${crop === "all" ? "crops" : crop}-report-${data?.period?.slug || "report"}.${format}`);
    } catch (err) {
      showError(errorMessage(err, "The report could not be downloaded. Please try again."), "Download failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4 sm:p-5">
        <Segmented label="Crop" options={CROPS} value={crop} onChange={setCrop} />
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">
            {data?.period ? (
              <>
                <span className="font-semibold text-slate-900">{data.period.label}</span>
                <span className="text-slate-400"> · </span>
                Status and crop age as at {longDate(data.period.asAt)}
                <span className="text-slate-400"> · </span>
                compared with {data.period.previous}
              </>
            ) : " "}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Printer} disabled={!printable.length || loading} onClick={() => window.print()}>Print</Button>
            <Button icon={FileDown} loading={busy === "pdf"} disabled={Boolean(busy)} onClick={() => get("pdf")}>Download PDF</Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === "csv"} disabled={Boolean(busy)} onClick={() => get("csv")}>Excel (CSV)</Button>
          </div>
        </div>
      </Card>

      <Alert tone="error">{error}</Alert>
      {loading && !data && <Spinner label="Building report..." />}
      <div className={cx("space-y-8 transition-opacity", loading && data && "opacity-60")}>
        {reports.map((report) => (report.counts.farms === 0 && report.counts.records === 0 ? (
          <Card key={report.crop}>
            <EmptyState icon={Sprout} title={`No ${report.title.toLowerCase()} farms registered`}>
              Register them on the Farms tab once. Their harvests and status then fill this report automatically.
            </EmptyState>
          </Card>
        ) : (
          <ReportDocument key={report.crop} report={report} meta={data} />
        )))}
      </div>
      {printable.length > 0 && (
        <PrintArea>
          {printable.map((report) => <ReportDocument key={report.crop} report={report} meta={data} />)}
        </PrintArea>
      )}
    </div>
  );
};

export default CropReports;
