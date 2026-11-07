import { useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Printer, Sprout } from "lucide-react";
import { ColumnChart } from "../../components/charts/ColumnChart";
import { Alert, Button, Card, EmptyState, Select, Spinner } from "../../components/ui/ui";
import api, { download, errorMessage } from "../../lib/api";
import { cx } from "../../lib/cx";
import { compact, number } from "../../lib/format";
import { showError } from "../../lib/toast";
import { useFetch } from "../../lib/useFetch";
import { ReportView } from "../reports/ReportsPage";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const CROPS = [
  { value: "all", label: "All crops" },
  { value: "tea", label: "Tea" },
  { value: "sugarcane", label: "Sugarcane" },
  { value: "coffee", label: "Coffee" },
  { value: "fodder", label: "Fodder" },
];
const PERIODS = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half", label: "Half-yearly" },
  { value: "year", label: "Annual" },
];
// period -> [periods in a year, months in each]
const SPANS = { month: [12, 1], quarter: [4, 3], half: [2, 6], year: [1, 12] };

const INDEX_OPTIONS = {
  month: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
  quarter: [1, 2, 3, 4].map((q) => ({ value: String(q), label: `Q${q} (${SHORT[(q - 1) * 3]} - ${SHORT[(q - 1) * 3 + 2]})` })),
  half: [{ value: "1", label: "First half (Jan - Jun)" }, { value: "2", label: "Second half (Jul - Dec)" }],
};

const INDEX_LABEL = { month: "Month", quarter: "Quarter", half: "Half" };

const now = new Date();
const THIS_YEAR = now.getFullYear();
const indexFor = (period, month = now.getMonth()) => Math.floor(month / SPANS[period][1]) + 1;
const ordinal = (year, index) => year * 12 + index;

const Segmented = ({ label, options, value, onChange }) => (
  <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        aria-pressed={value === o.value}
        onClick={() => onChange(o.value)}
        className={cx(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50",
          value === o.value ? "bg-white text-primary-800 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900",
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Chart = ({ chart }) => {
  if (!chart?.points?.length || chart.points.every((p) => !p.values[chart.series[0].key])) return null;
  const data = chart.points.map((p) => {
    if (!p.date) return p;
    const d = new Date(`${p.date}T00:00:00Z`);
    return { ...p, label: `${d.getUTCDate()} ${SHORT[d.getUTCMonth()]}` };
  });
  return (
    <Card className="p-4 sm:p-5">
      <ColumnChart
        title={chart.series.map((s) => s.label).join(" and ")}
        data={data}
        series={chart.series}
        height={220}
        format={(v, full) => (full ? `${number(v)} ${chart.unit}` : compact(v))}
      />
    </Card>
  );
};

/**
 * Crop performance for a month, quarter, half year or year, on screen and as
 * a PDF (to print or file) or CSV (for Excel).
 */
const CropReports = () => {
  const [crop, setCrop] = useState("all");
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(THIS_YEAR);
  const [index, setIndex] = useState(indexFor("month"));
  const [busy, setBusy] = useState("");

  const params = { crop, period, year, index };
  const { data, loading, error } = useFetch("/crops/reports", params);

  const count = SPANS[period][0];
  const latest = ordinal(THIS_YEAR, indexFor(period));
  const atLatest = ordinal(year, index) >= latest;

  const changePeriod = (next) => {
    // Keep the same point in the year: May -> Q2 -> first half.
    const startMonth = (index - 1) * SPANS[period][1];
    setPeriod(next);
    setIndex(next === "year" ? 1 : indexFor(next, startMonth));
  };
  const step = (direction) => {
    let nextIndex = index + direction;
    let nextYear = year;
    if (nextIndex < 1) { nextIndex = count; nextYear -= 1; }
    if (nextIndex > count) { nextIndex = 1; nextYear += 1; }
    setYear(nextYear);
    setIndex(nextIndex);
  };

  // Same names the server gives: -2024-05, -2024-Q2, -2024-H1, -2024.
  const slug = { month: `-${String(index).padStart(2, "0")}`, quarter: `-Q${index}`, half: `-H${index}`, year: "" }[period];
  const fileName = (format) => `keiyian-${crop === "all" ? "crops" : crop}-report-${year}${slug}.${format}`;
  const get = async (format) => {
    setBusy(format);
    try {
      await download("/crops/reports", { ...params, format }, fileName(format));
    } catch (err) {
      showError(errorMessage(err, "The report could not be downloaded. Please try again."), "Download failed");
    } finally {
      setBusy("");
    }
  };
  // Opens the PDF in a new tab, where the browser's print button prints it
  // exactly as filed, sign-off lines included.
  const print = async () => {
    const tab = window.open("", "_blank");
    setBusy("print");
    try {
      const response = await api.get("/crops/reports", { params: { ...params, format: "pdf", inline: true }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      tab?.close();
      showError(errorMessage(err, "The report could not be opened for printing. Please try again."), "Print failed");
    } finally {
      setBusy("");
    }
  };

  const years = Array.from(new Set([...(data?.years || []), THIS_YEAR, year])).sort((a, b) => b - a);
  const reports = data?.reports || [];

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4 sm:p-5 print:hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented label="Crop" options={CROPS} value={crop} onChange={setCrop} />
          <Segmented label="Report period" options={PERIODS} value={period} onChange={changePeriod} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="secondary" icon={ChevronLeft} aria-label="Previous period" onClick={() => step(-1)} />
            {period !== "year" && (
              <label className="block text-xs font-medium text-slate-500">
                {INDEX_LABEL[period]}
                <Select className="mt-1 block min-w-[190px]" options={INDEX_OPTIONS[period]} value={String(index)} onChange={(e) => setIndex(Number(e.target.value))} />
              </label>
            )}
            <label className="block text-xs font-medium text-slate-500">
              Year
              <Select className="mt-1 block" options={years.map((y) => ({ value: String(y), label: String(y) }))} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} />
            </label>
            <Button variant="secondary" icon={ChevronRight} aria-label="Next period" disabled={atLatest} onClick={() => step(1)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Printer} loading={busy === "print"} disabled={Boolean(busy)} onClick={print}>Print</Button>
            <Button icon={FileDown} loading={busy === "pdf"} disabled={Boolean(busy)} onClick={() => get("pdf")}>Download PDF</Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === "csv"} disabled={Boolean(busy)} onClick={() => get("csv")}>Excel (CSV)</Button>
          </div>
        </div>
        {data?.period && (
          <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{data.period.label}</span>
            <span className="text-slate-400"> · </span>
            Status and crop age as at {new Date(`${data.period.asAt}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
            <span className="text-slate-400"> · </span>
            compared with {data.period.previous}
          </p>
        )}
      </Card>

      <Alert tone="error">{error}</Alert>
      {loading && !data && <Spinner label="Building report..." />}
      <div className={cx("space-y-10 transition-opacity", loading && data && "opacity-60")}>
        {reports.map((report) => (
          <section key={report.crop} aria-labelledby={`report-${report.crop}`}>
            <h2 id={`report-${report.crop}`} className="mb-4 text-lg font-semibold tracking-tight text-slate-900">{report.heading}</h2>
            {report.counts.farms === 0 && report.counts.records === 0 ? (
              <Card>
                <EmptyState icon={Sprout} title={`No ${report.title.toLowerCase()} farms registered`}>
                  Register them on the Farms tab once. Their harvests and status then fill this report automatically.
                </EmptyState>
              </Card>
            ) : (
              <ReportView report={report} emptyText="No records for this period.">
                <Chart chart={report.chart} />
              </ReportView>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default CropReports;
