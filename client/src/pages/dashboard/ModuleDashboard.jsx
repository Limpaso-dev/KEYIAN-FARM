import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, FileBarChart2, HeartPulse, Milk, Package, RefreshCw, ShoppingCart, Tractor, UserCog, Users, Wallet, Wheat } from "lucide-react";
import { Link } from "react-router-dom";

import { getAnimalFeeds } from "../../services/animalFeed.service";
import { getAccounts } from "../../services/account.service";
import { getEmployees } from "../../services/employee.service";
import { getFarmers } from "../../services/farmer.service";
import { getInventory } from "../../services/inventory.service";
import { getLeases } from "../../services/lease.service";
import { getLivestock } from "../../services/livestock.service";
import { getMedicalSummary } from "../../services/medicalSummary.service";
import { getMedicalBills } from "../../services/medicalBilling.service";
import { getMilkCollections } from "../../services/milkCollection.service";
import { getPayroll } from "../../services/payroll.service";
import { getPurchaseOrders } from "../../services/purchaseOrder.service";
import { getProperties } from "../../services/rentalProperty.service";
import { getTenants } from "../../services/rentalTenant.service";
import { getSales, getSalesSummary } from "../../services/sales.service";
import { getFarmersReport, getSalesReport } from "../../services/reports.service";
import { getSugarcaneFarms } from "../../services/sugarcane.service";
import { getTeaFarms } from "../../services/tea.service";
import { getTransactions } from "../../services/transaction.service";
import { getUsers } from "../../services/user.service";
import { getLifecycleTasks, getPurchaseRequests } from "../../services/workflow.service";
import { useAuth } from "../../context/useAuth";
import { canAccessModule } from "../../utils/permissions";

const recordsFrom = (result) => {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== "object") return [];

  for (const value of Object.values(result)) {
    if (Array.isArray(value)) return value;
  }

  return [];
};

const countStatus = (records, statuses) => records.filter((record) =>
  statuses.includes(String(record.status || "").toLowerCase())
).length;

const numberMetric = (label, value, note) => ({ label, value, note });
const fmt = (value) => new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(value);
const sumField = (records, field) => records.reduce((total, record) => total + Number(record[field] || 0), 0);
const todayKey = new Date().toISOString().slice(0, 10);

const modules = [
  {
    id: "agriculture", label: "Agriculture", description: "Crop activity and cooperative herd overview.", icon: Wheat, access: "agriculture", links: [{ label: "Crop farms", to: "/agriculture" }, { label: "Livestock records", to: "/livestock" }],
    load: async () => {
      const [herdResult, teaResult, caneResult] = await Promise.allSettled([getLivestock(), getTeaFarms(), getSugarcaneFarms()]);
      const herd = herdResult.status === "fulfilled" ? recordsFrom(herdResult.value) : [];
      const tea = teaResult.status === "fulfilled" ? recordsFrom(teaResult.value) : [];
      const cane = caneResult.status === "fulfilled" ? recordsFrom(caneResult.value) : [];
      return [
        numberMetric("Active cattle", herd.filter((animal) => animal.species === "cattle" && animal.status === "active").length, "registered cooperative herd"),
        numberMetric("Crop farms", tea.length + cane.length, `${tea.length} tea · ${cane.length} sugarcane`),
      ];
    },
  },
  {
    id: "farmers", label: "Farmers", description: "Membership records and active farmer accounts.", icon: Users, access: "farmers", links: [{ label: "Manage farmers", to: "/farmers" }],
    load: async () => { const farmers = recordsFrom(await getFarmers()); return [numberMetric("Registered farmers", farmers.length, "all member records"), numberMetric("Active farmers", countStatus(farmers, ["active"]), "currently active")]; },
  },
  {
    id: "livestock", label: "Livestock", description: "Herd size, cattle, and animal health at a glance.", icon: Tractor, access: "livestock", links: [{ label: "Manage livestock", to: "/livestock" }, { label: "Animal feeds", to: "/animal-feeds" }],
    load: async () => { const herd = recordsFrom(await getLivestock()); return [numberMetric("Active livestock", countStatus(herd, ["active"]), "all species"), numberMetric("Active cattle", herd.filter((animal) => animal.species === "cattle" && animal.status === "active").length, "cattle in the herd"), numberMetric("Healthy animals", herd.filter((animal) => animal.healthStatus?.toLowerCase() === "healthy" && animal.status === "active").length, "active and healthy")]; },
  },
  {
    id: "animal-feeds", label: "Animal Feeds", description: "Feed catalogue and inventory records.", icon: Wheat, access: "animalFeeds", links: [{ label: "Manage animal feeds", to: "/animal-feeds" }],
    load: async () => { const feeds = recordsFrom(await getAnimalFeeds()); return [numberMetric("Feed records", feeds.length, "items in the feed catalogue"), numberMetric("Active feeds", countStatus(feeds, ["active"]), "available records")]; },
  },
  {
    id: "dairy", label: "Dairy", description: "Milk collection volumes and delivery activity.", icon: Milk, access: "dairy", links: [{ label: "Dairy operations", to: "/dairy" }],
    load: async () => {
      const collections = recordsFrom(await getMilkCollections());
      const today = collections.filter((item) => item.collectionDate && new Date(item.collectionDate).toISOString().slice(0, 10) === todayKey);
      const month = collections.filter((item) => item.collectionDate && new Date(item.collectionDate).toISOString().slice(0, 7) === todayKey.slice(0, 7));
      return [numberMetric("Milk today", `${fmt(sumField(today, "quantityLitres"))} L`, `${today.length} collection records`), numberMetric("Milk this month", `${fmt(sumField(month, "quantityLitres"))} L`, "current calendar month"), numberMetric("Collection records", collections.length, "all recorded deliveries")];
    },
  },
  {
    id: "hmis", label: "HMIS", description: "Patient care activity across visits and diagnostics.", icon: HeartPulse, access: "hmis", links: [{ label: "HMIS workspace", to: "/hmis" }, { label: "Patient billing", to: "/hmis/billing" }],
    load: async () => {
      const result = await getMedicalSummary();
      const summary = result.data || {};
      return [
        numberMetric("Patients", summary.patients ?? "—", "registered patient records"),
        numberMetric("Visits today", summary.todaysVisits ?? "—", "active encounters"),
        numberMetric("Pending lab", summary.pendingLab ?? "—", "awaiting results"),
        numberMetric("Prescriptions", summary.prescriptions ?? "—", "recorded prescriptions"),
        numberMetric("Exceptions", summary.exceptions ?? "—", "operational follow-up items"),
      ].filter((metric) => metric.value !== "—");
    },
  },
  {
    id: "hmis-billing", label: "HMIS Billing", description: "Patient charges awaiting settlement and payment.", icon: Wallet, access: "hmisBilling", links: [{ label: "Open patient billing", to: "/hmis/billing" }],
    load: async () => {
      const bills = recordsFrom(await getMedicalBills());
      const outstandingBills = bills.filter((bill) => ["approved", "partially_paid"].includes(bill.status));
      const outstanding = outstandingBills.reduce((total, bill) => total + Math.max(Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0), 0), 0);
      return [numberMetric("Patient bills", bills.length, "all visible bills"), numberMetric("Awaiting payment", outstandingBills.length, "approved or partially paid"), numberMetric("Outstanding balance", `KES ${fmt(outstanding)}`, "remaining patient balance")];
    },
  },
  {
    id: "procurement", label: "Procurement", description: "Purchase order activity and approval queue.", icon: ShoppingCart, access: "procurement", links: [{ label: "Procurement workspace", to: "/procurement" }],
    load: async () => { const orders = recordsFrom(await getPurchaseOrders()); return [numberMetric("Purchase orders", orders.length, "all recorded orders"), numberMetric("Awaiting approval", countStatus(orders, ["pending_approval"]), "orders requiring a decision"), numberMetric("Open orders", countStatus(orders, ["approved", "ordered", "partially_received"]), "approved and in progress")]; },
  },
  {
    id: "inventory", label: "Inventory", description: "Stock catalogue and low-stock attention points.", icon: Package, access: "inventory", links: [{ label: "Inventory workspace", to: "/inventory" }, { label: "Goods receiving", to: "/inventory/receiving" }],
    load: async () => { const items = recordsFrom(await getInventory()); return [numberMetric("Stock records", items.length, "inventory items"), numberMetric("Low stock", items.filter((item) => Number(item.quantity ?? item.currentStock ?? 0) <= Number(item.reorderLevel ?? item.reorderPoint ?? 0)).length, "at or below reorder level")]; },
  },
  {
    id: "finance", label: "Finance", description: "Accounts and posted transaction activity.", icon: Wallet, access: "finance", links: [{ label: "Finance workspace", to: "/finance" }],
    load: async () => { const [accountResult, transactionResult] = await Promise.allSettled([getAccounts(), getTransactions()]); const accounts = accountResult.status === "fulfilled" ? recordsFrom(accountResult.value) : []; const transactions = transactionResult.status === "fulfilled" ? recordsFrom(transactionResult.value) : []; return [numberMetric("Accounts", accounts.length, "cash and bank accounts"), numberMetric("Transactions", transactions.length, "recorded finance activity"), numberMetric("Posted receipts", fmt(sumField(transactions.filter((item) => item.type === "receipt" && item.status === "posted"), "amount")), "total received")]; },
  },
  {
    id: "hr", label: "HR", description: "Employee records and payroll cycle activity.", icon: UserCog, access: "hr", links: [{ label: "HR workspace", to: "/hr" }],
    load: async () => { const [employeeResult, payrollResult] = await Promise.allSettled([getEmployees(), getPayroll()]); const employees = employeeResult.status === "fulfilled" ? recordsFrom(employeeResult.value) : []; const payroll = payrollResult.status === "fulfilled" ? recordsFrom(payrollResult.value) : []; return [numberMetric("Active employees", countStatus(employees, ["active"]), "currently active"), numberMetric("Payroll records", payroll.length, "payroll cycles")]; },
  },
  {
    id: "rentals", label: "Rentals", description: "Property, tenancy, and occupancy overview.", icon: Building2, access: "rentals", links: [{ label: "Rental workspace", to: "/rentals" }],
    load: async () => { const [propertyResult, tenantResult, leaseResult] = await Promise.allSettled([getProperties(), getTenants(), getLeases()]); const properties = propertyResult.status === "fulfilled" ? recordsFrom(propertyResult.value) : []; const tenants = tenantResult.status === "fulfilled" ? recordsFrom(tenantResult.value) : []; const leases = leaseResult.status === "fulfilled" ? recordsFrom(leaseResult.value) : []; return [numberMetric("Properties", properties.length, "registered rental properties"), numberMetric("Tenants", tenants.length, "tenant records"), numberMetric("Active leases", countStatus(leases, ["active"]), "currently active")]; },
  },
  {
    id: "sales", label: "Sales", description: "Sales volume, customers, and product catalogue.", icon: BarChart3, access: "sales", links: [{ label: "Sales workspace", to: "/sales" }],
    load: async () => { const [summaryResult, salesResult] = await Promise.allSettled([getSalesSummary(), getSales()]); const summaryResponse = summaryResult.status === "fulfilled" ? summaryResult.value : {}; const summary = summaryResponse.data || summaryResponse; const sales = salesResult.status === "fulfilled" ? recordsFrom(salesResult.value) : []; return [numberMetric("Sales value", `KES ${fmt(Number(summary.totalSales ?? summary.totalAmount ?? 0))}`, "reported total"), numberMetric("Sales records", sales.length, "recorded transactions")]; },
  },
  {
    id: "reports", label: "Reports", description: "Role-appropriate farmer or sales performance summaries.", icon: FileBarChart2, access: "reports", links: [{ label: "Open reports", to: "/reports" }],
    load: async (role) => {
      if (role === "farm_officer") {
        const response = await getFarmersReport();
        const report = response.data || {};
        return [numberMetric("Farmers", report.count ?? 0, "in the membership report"), numberMetric("Total shares", fmt(Number(report.totalShares || 0)), "reported member shares")];
      }
      const response = await getSalesReport();
      const summary = response.data?.summary || {};
      return [numberMetric("Sales value", `KES ${fmt(Number(summary.totalSales || 0))}`, "reported total"), numberMetric("Outstanding", `KES ${fmt(Number(summary.outstanding || 0))}`, "unpaid balance")];
    },
  },
  {
    id: "workflows", label: "Workflows", description: "Items waiting for review across assigned approval queues.", icon: ShoppingCart, access: "workflows", links: [{ label: "Workflow inbox", to: "/workflows" }],
    load: async () => { const [requestResult, taskResult] = await Promise.allSettled([getPurchaseRequests(), getLifecycleTasks()]); const requests = requestResult.status === "fulfilled" ? recordsFrom(requestResult.value) : []; const tasks = taskResult.status === "fulfilled" ? recordsFrom(taskResult.value) : []; return [numberMetric("Purchase requests", requests.filter((item) => item.canDecide).length, "awaiting your decision"), numberMetric("Lifecycle tasks", tasks.filter((item) => item.canDecide).length, "awaiting your decision")]; },
  },
  {
    id: "users", label: "User Management", description: "Account access and activation status.", icon: UserCog, access: "settings", links: [{ label: "Manage user accounts", to: "/settings/users" }],
    load: async () => { const users = recordsFrom(await getUsers()); return [numberMetric("Accounts", users.length, "registered system users"), numberMetric("Active accounts", users.filter((account) => account.isActive).length, "currently enabled")]; },
  },
];

const ModuleDashboard = () => {
  const { user } = useAuth();
  const availableModules = useMemo(() => modules.filter((item) => canAccessModule(user?.role, item.access)), [user?.role]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const today = new Date();

  useEffect(() => {
    let current = true;
    Promise.all(availableModules.map(async (module) => {
      try {
        return { ...module, metrics: await module.load(user?.role), error: "" };
      } catch (loadError) {
        return {
          ...module,
          metrics: [],
          error: loadError.response?.data?.message || `Unable to load ${module.label.toLowerCase()} data.`,
        };
      }
    })).then((results) => {
      if (current) setSections(results);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [availableModules, user?.role, refreshKey]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-5 border-b border-[#dfe8dc] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-800">Welcome back, {user?.name || "there"}</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Your workspace</h1>
          <p className="mt-2 text-sm text-slate-600">An overview of the modules and records available to your account.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} />{today.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</span>
          <button type="button" onClick={() => { setLoading(true); setRefreshKey((current) => current + 1); }} aria-label="Refresh dashboard" title="Refresh dashboard" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /></button>
        </div>
      </header>

      {loading ? (
        <section aria-label="Loading dashboard metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-md border border-slate-200 bg-white" />)}
        </section>
      ) : sections.length === 0 ? (
        <p className="border border-slate-200 bg-white p-5 text-sm text-slate-600">No dashboard modules are assigned to this account.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sections.map(({ id, label, icon: Icon, links, metrics, error }) => (
            <section key={id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-slate-900"><Icon size={17} className="shrink-0 text-emerald-800" /><h2 className="truncate text-sm font-semibold">{label}</h2></div>
                <div className="flex shrink-0 gap-3">
                  {links.map((link) => <Link key={link.to} to={link.to} title={link.label} aria-label={link.label} className="text-sm font-medium text-emerald-800 hover:text-emerald-950">{link.label}</Link>)}
                </div>
              </div>
              {error ? (
                <div role="alert" className="mt-3 border-t border-rose-200 pt-3 text-xs text-rose-800">{error}</div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                  {metrics.slice(0, 2).map((metric) => (
                    <div key={metric.label} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0"><p className="text-xs font-medium text-slate-600">{metric.label}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{metric.note}</p></div>
                      <p className="shrink-0 text-right text-lg font-semibold text-slate-950">{metric.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModuleDashboard;
