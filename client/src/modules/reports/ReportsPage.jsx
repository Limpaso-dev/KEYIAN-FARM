import { useEffect, useState } from "react";
import {
  Download,
  FileBarChart2,
  FileText,
  Search,
} from "lucide-react";

import { useAuth } from "../../context/useAuth";
import {
  canAccessModule,
} from "../../utils/permissions";
import {
  downloadFarmersReportPdf,
  downloadSalesReportPdf,
  getFarmersReport,
  getSalesReport,
} from "../../services/reports.service";

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthStart = () => {
  const today = new Date();
  return localDate(new Date(today.getFullYear(), today.getMonth(), 1));
};

const today = () => localDate(new Date());

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

const csvCell = (value) => {
  const text = String(value ?? "");
  const protectedText = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
};

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const UsersReport = ({ report }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <Metric label="Farmers" value={report.count} />
      <Metric label="Total shares" value={Number(report.totalShares || 0).toLocaleString("en-KE")} />
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Membership No.</th>
            <th className="px-4 py-3 font-semibold">Farmer</th>
            <th className="px-4 py-3 font-semibold">Phone</th>
            <th className="px-4 py-3 font-semibold">Farm Location</th>
            <th className="px-4 py-3 font-semibold">Shares</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {report.farmers.map((farmer) => (
            <tr key={farmer._id}>
              <td className="px-4 py-3 font-medium text-slate-900">{farmer.membershipNumber}</td>
              <td className="px-4 py-3 text-slate-700">{farmer.firstName} {farmer.lastName}</td>
              <td className="px-4 py-3 text-slate-600">{farmer.phone || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{farmer.farmLocation || "-"}</td>
              <td className="px-4 py-3 text-slate-700">{Number(farmer.shares || 0).toLocaleString("en-KE")}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{farmer.membershipStatus}</td>
            </tr>
          ))}
          {report.farmers.length === 0 && (
            <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">No farmers match this filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </>
);

const SalesReport = ({ report }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Transactions" value={Number(report.summary.count || 0).toLocaleString("en-KE")} />
      <Metric label="Total sales" value={formatCurrency(report.summary.totalSales)} />
      <Metric label="Amount paid" value={formatCurrency(report.summary.totalPaid)} />
      <Metric label="Outstanding" value={formatCurrency(report.summary.outstanding)} />
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Invoice</th>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Customer</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Total</th>
            <th className="px-4 py-3 font-semibold">Paid</th>
            <th className="px-4 py-3 font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {report.sales.map((sale) => (
            <tr key={sale._id}>
              <td className="px-4 py-3 font-medium text-slate-900">{sale.invoiceNumber}</td>
              <td className="px-4 py-3 text-slate-600">{new Date(sale.saleDate).toLocaleDateString("en-KE")}</td>
              <td className="px-4 py-3 text-slate-700">{sale.customer?.name || "-"}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{sale.status}</td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(sale.totalAmount)}</td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(sale.amountPaid)}</td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(sale.balanceDue)}</td>
            </tr>
          ))}
          {report.sales.length === 0 && (
            <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">No sales match this date range.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </>
);

const Metric = ({ label, value }) => (
  <div className="border-l-2 border-primary-500 bg-white px-4 py-3">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
  </div>
);

const ReportsPage = () => {
  const { user } = useAuth();
  const canViewFarmers = canAccessModule(user?.role, "farmers");
  const canViewSales = canAccessModule(user?.role, "salesReports");
  const [reportType, setReportType] = useState(() => canViewFarmers ? "farmers" : "sales");
  const [farmersStatus, setFarmersStatus] = useState("all");
  const [salesDates, setSalesDates] = useState(() => ({ from: monthStart(), to: today() }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    status: "all",
    from: monthStart(),
    to: today(),
  }));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    const request = reportType === "farmers"
      ? getFarmersReport({ status: appliedFilters.status })
      : getSalesReport({ from: appliedFilters.from, to: appliedFilters.to });

    request
      .then((response) => {
        if (current) {
          setReport(response.data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (current) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load this report."
          );
          setReport(null);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [reportType, appliedFilters]);

  const applyFilters = (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    setAppliedFilters((current) => ({
      ...current,
      ...(reportType === "farmers"
        ? { status: farmersStatus }
        : salesDates),
    }));
  };

  const downloadPdf = async () => {
    if (!report) return;
    setDownloading(true);
    setError("");
    try {
      const params = reportType === "farmers"
        ? { status: appliedFilters.status }
        : { from: appliedFilters.from, to: appliedFilters.to };
      const blob = reportType === "farmers"
        ? await downloadFarmersReportPdf(params)
        : await downloadSalesReportPdf(params);
      saveBlob(blob, reportType === "farmers" ? "keiyian-farmers-report.pdf" : "keiyian-sales-report.pdf");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download the PDF report.");
    } finally {
      setDownloading(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const isFarmers = reportType === "farmers";
    const headers = isFarmers
      ? ["Membership No.", "First Name", "Last Name", "Phone", "Farm Location", "Shares", "Status"]
      : ["Invoice", "Date", "Customer", "Status", "Total KES", "Paid KES", "Balance KES"];
    const rows = isFarmers
      ? report.farmers.map((farmer) => [farmer.membershipNumber, farmer.firstName, farmer.lastName, farmer.phone, farmer.farmLocation, farmer.shares, farmer.membershipStatus])
      : report.sales.map((sale) => [sale.invoiceNumber, new Date(sale.saleDate).toISOString().slice(0, 10), sale.customer?.name, sale.status, sale.totalAmount, sale.amountPaid, sale.balanceDue]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    saveBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), `keiyian-${reportType}-report.csv`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700"><FileBarChart2 size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500">Review cooperative records and export printable reports.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={downloadCsv} disabled={!report || loading || downloading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download size={16} /> CSV
          </button>
          <button type="button" onClick={downloadPdf} disabled={!report || loading || downloading} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            <FileText size={16} /> {downloading ? "Preparing..." : "Download PDF"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {canViewFarmers && (
          <button type="button" role="tab" aria-selected={reportType === "farmers"} onClick={() => { setLoading(true); setReportType("farmers"); }} className={`border-b-2 px-3 py-2 text-sm font-medium ${reportType === "farmers" ? "border-primary-600 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            Farmers List
          </button>
        )}
        {canViewSales && (
          <button type="button" role="tab" aria-selected={reportType === "sales"} onClick={() => { setLoading(true); setReportType("sales"); }} className={`border-b-2 px-3 py-2 text-sm font-medium ${reportType === "sales" ? "border-primary-600 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            Sales Summary
          </button>
        )}
      </div>

      <form onSubmit={applyFilters} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        {reportType === "farmers" ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Membership status
            <select value={farmersStatus} onChange={(event) => setFarmersStatus(event.target.value)} className="min-w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        ) : (
          <>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              From
              <input type="date" value={salesDates.from} max={salesDates.to} onChange={(event) => setSalesDates((current) => ({ ...current, from: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              To
              <input type="date" value={salesDates.to} min={salesDates.from} max={today()} onChange={(event) => setSalesDates((current) => ({ ...current, to: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </label>
          </>
        )}
        <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
          <Search size={16} /> Apply Filters
        </button>
      </form>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading report...</p>
      ) : report && reportType === "farmers" ? (
        <UsersReport report={report} />
      ) : report ? (
        <SalesReport report={report} />
      ) : null}
    </div>
  );
};

export default ReportsPage;
