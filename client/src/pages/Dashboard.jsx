import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, FileBarChart2 } from "lucide-react";
import { ColumnChart } from "../components/charts/ColumnChart";
import { Alert, Badge, Skeleton } from "../components/ui/ui";
import { KeyFigures } from "../components/ui/KeyFigures";
import { useAuth } from "../context/useAuth";
import { cx } from "../lib/cx";
import { compactMoney, date, greeting, lastDays, money, number, shortDate, timeAgo, today, weekday } from "../lib/format";
import { useFetch } from "../lib/useFetch";
import { navForDepartment, navigation, opensDepartment } from "../navigation";

const DAYS = 14;

/** Re-renders every minute so the greeting and date follow Nairobi time on an open page. */
const useMinuteTick = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
};

const dayOf = (value) => String(value || "").slice(0, 10);

/** { "2026-11-07": total } for a list of rows. */
const sumByDay = (rows, field, keep = () => true) => {
  const out = {};
  for (const row of rows || []) {
    if (!keep(row)) continue;
    const day = dayOf(row.date);
    out[day] = (out[day] || 0) + (Number(row[field]) || 0);
  }
  return out;
};

const chartRows = (days, seriesMaps) =>
  days.map((day) => ({
    key: day,
    label: shortDate(day),
    sublabel: weekday(day),
    values: Object.fromEntries(Object.entries(seriesMaps).map(([key, map]) => [key, map?.[day] || 0])),
  }));

const litres = (v) => `${number(v, 1)} L`;
const summaryValue = (cards, department, label) => cards?.find((c) => c.department === department)?.summary.find((s) => s.label === label)?.value;
const plural = (n, word) => `${word}${n === 1 ? "" : "s"}`;

// ---------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------

/** Change against yesterday, e.g. "▲ 12% vs yesterday". */
const Change = ({ now, before }) => {
  if (!before) return <span className="text-slate-400">No figure yesterday</span>;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-slate-500">Same as yesterday</span>;
  const up = pct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cx("inline-flex items-center font-semibold", up ? "text-emerald-700" : "text-rose-700")}>
        <Icon size={14} aria-hidden />{Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
      </span>
      <span className="text-slate-500">vs yesterday</span>
    </span>
  );
};

/**
 * A block of the dashboard: a heading row over a hairline, then its content.
 * Figures and lists sit on the page in ruled sections like this - never in
 * rounded boxes.
 */
const Section = ({ title, description, aside, children, footer, className }) => (
  <section className={cx("min-w-0", className)}>
    <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-2.5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {aside}
    </div>
    {children}
    {footer}
  </section>
);

const ChartSection = ({ title, description, total, loading, children, className }) => (
  <Section
    title={title}
    description={description}
    className={className}
    aside={total && (
      <div className="shrink-0 text-right">
        <p className="text-lg font-semibold leading-6 tracking-tight tabular-nums text-slate-900">{total.value}</p>
        <p className="text-xs text-slate-500">{total.label}</p>
      </div>
    )}
  >
    <div className="pt-4">{loading ? <Skeleton className="h-[240px] w-full" /> : children}</div>
  </Section>
);

const ListSkeleton = ({ rows, height }) => (
  <div className="space-y-2 py-3">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={height} />)}</div>
);

const SEVERITY = {
  high: "bg-rose-50 text-rose-700 ring-rose-600/15",
  medium: "bg-amber-50 text-amber-800 ring-amber-600/20",
  low: "bg-slate-100 text-slate-700 ring-slate-500/15",
};

const NeedsAttention = ({ items, loading }) => (
  <Section title="Needs attention" description={items.length ? `${items.length} ${plural(items.length, "item")} waiting on you or your teams` : "Items waiting on you or your teams"}>
    {loading ? <ListSkeleton rows={3} height="h-10" /> : items.length ? (
      <ul>
        {items.map((item) => (
          <li key={item.key} className="border-b border-slate-200">
            <Link to={item.to} className="group -mx-2 flex items-center gap-3 px-2 py-3 transition-colors hover:bg-white">
              <span className={cx("min-w-[2.75rem] shrink-0 rounded px-1.5 py-1 text-center text-xs font-semibold tabular-nums ring-1 ring-inset", SEVERITY[item.severity])}>{item.count}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">{item.title}</span>
                {item.detail && <span className="block truncate text-xs text-slate-500">{item.detail}</span>}
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex items-center gap-3 border-b border-slate-200 py-3.5">
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden />
        <p className="text-sm text-slate-600">All clear. Nothing is waiting on you right now.</p>
      </div>
    )}
  </Section>
);

const RecentActivity = ({ items, loading }) => (
  <Section title="Recent activity" description="Latest entries across your departments">
    {loading ? <ListSkeleton rows={4} height="h-9" /> : items.length ? (
      <ul>
        {items.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                <span className="font-medium text-slate-600">{item.kind}</span>
                <span className="text-slate-300" aria-hidden>·</span>
                <span className="truncate">{item.detail}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              {item.amount != null ? <p className={cx("text-sm font-semibold tabular-nums", item.negative ? "text-slate-700" : "text-slate-900")}>{item.amount}</p> : item.badge}
              <time dateTime={item.at} className="mt-0.5 block text-xs text-slate-400">{timeAgo(item.at)}</time>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="border-b border-slate-200 py-3.5 text-sm text-slate-500">No recent entries yet.</p>
    )}
  </Section>
);

/**
 * Every department's end-of-day headline figures, one department at a time,
 * as a ruled two-column table.
 */
const DepartmentsToday = ({ cards, className, hide = [] }) => {
  const [picked, setPicked] = useState(null);
  const card = cards.find((c) => c.department === picked) || cards[0];
  // A single department's figures already in the headline strip are not repeated.
  const metrics = card ? card.summary.filter((s) => cards.length > 1 || !hide.includes(s.label)) : [];
  if (!card || !metrics.length) return null;
  const nav = navForDepartment(card.department);
  const name = nav?.label || card.title;
  return (
    <section className={cx("min-w-0", className)}>
      <h2 className="text-[15px] font-semibold text-slate-900">
        {cards.length > 1 ? "Departments today" : metrics.length < card.summary.length ? `More from ${name} today` : `${name} today`}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Headline figures from today&apos;s department reports</p>
      {cards.length > 1 ? (
        <div role="tablist" aria-label="Department" className="scrollbar-thin mt-1.5 flex gap-5 overflow-x-auto">
          {cards.map((c) => {
            const selected = c.department === card.department;
            return (
              <button
                key={c.department}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setPicked(c.department)}
                className={cx("whitespace-nowrap border-b-2 py-2 text-[13px] font-medium transition-colors", selected ? "border-primary-700 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
              >
                {navForDepartment(c.department)?.short || navForDepartment(c.department)?.label || c.title}
              </button>
            );
          })}
        </div>
      ) : <div className="mt-2.5" />}
      <dl role={cards.length > 1 ? "tabpanel" : undefined} className="grid grid-cols-1 gap-x-10 border-t border-slate-200 sm:grid-cols-2">
        {metrics.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-4 border-b border-slate-200 py-2.5">
            <dt className="text-[13px] text-slate-600">{s.label}</dt>
            <dd className={cx("text-sm font-semibold tabular-nums", Number(s.value) < 0 ? "text-rose-700" : "text-slate-900")}>{s.type === "money" ? money(s.value) : number(s.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-sm">
        {nav && <Link to={nav.path} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:text-primary-900 hover:underline">Open {nav.label} <ArrowRight size={14} aria-hidden /></Link>}
        <Link to={`/reports?department=${card.department}`} className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 hover:underline"><FileBarChart2 size={14} aria-hidden /> End-of-day report</Link>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
const Dashboard = () => {
  useMinuteTick();
  const auth = useAuth();
  const { user, label, permissions, can } = auth;
  const day = today();
  const days = useMemo(() => lastDays(DAYS), [day]); // eslint-disable-line react-hooks/exhaustive-deps
  const yesterday = days[days.length - 2];
  const range = { from: days[0], to: day, limit: 2000 };
  const canRequisitions = navigation.find((n) => n.path === "/requisitions")?.visible(auth);

  const summary = useFetch("/dashboard");
  const herd = useFetch(can("milkRecords") ? "/livestock/milk-records" : null, range);
  const farmers = useFetch(can("milkDeliveries") ? "/mva/milk-deliveries" : null, range);
  const sales = useFetch(can("sales") ? "/sales/sales" : null, range);
  const dispatches = useFetch(can("dispatches") ? "/sales/dispatches" : null, range);
  const ledger = useFetch(can("transactions") ? "/accounts/transactions" : null, range);
  const requisitions = useFetch(canRequisitions ? "/requisitions" : null);
  // Every department can read store items (for requisitions); the reorder alert is for those who run Stores.
  const lowStock = useFetch(opensDepartment(auth, "stores") ? "/stores/items/low-stock" : null);
  const vaccinations = useFetch(can("vaccinations") ? "/livestock/vaccinations-due" : null, { days: 7 });
  const contracts = useFetch(can("contracts") ? "/hr/contracts-expiring" : null, { days: 30 });
  const salaries = useFetch(can("payroll", "pay") ? "/hr/payroll" : null, { status: "with_finance" });

  const data = summary.data;
  const req = data?.requisitions;
  const cards = data?.cards || [];

  // ---- Series ---------------------------------------------------------
  const milkByDay = { herd: sumByDay(herd.data, "litres"), farmers: sumByDay(farmers.data, "litres") };
  const salesByDay = { local: sumByDay(sales.data, "totalAmount"), vehicles: sumByDay(dispatches.data, "expectedAmount", (d) => d.status !== "cancelled") };
  const posted = (type) => (row) => row.status === "posted" && row.type === type;
  const cashByDay = { income: sumByDay(ledger.data, "amount", posted("income")), expense: sumByDay(ledger.data, "amount", posted("expense")) };
  const total = (map) => Object.values(map || {}).reduce((a, b) => a + b, 0);
  const on = (map, d) => Object.values(map).reduce((sum, m) => sum + (m[d] || 0), 0);

  const showMilk = Boolean(herd.data || farmers.data);
  const showSales = Boolean(sales.data || dispatches.data);
  const showCash = Boolean(ledger.data);

  // ---- Headline figures -----------------------------------------------
  const kpis = [];
  if (showMilk) {
    const t = on(milkByDay, day);
    kpis.push({ label: "Milk collected today", value: litres(t), foot: <Change now={t} before={on(milkByDay, yesterday)} /> });
  }
  if (showSales) {
    const t = on(salesByDay, day);
    kpis.push({ label: "Sales today", value: compactMoney(t), title: money(t), foot: <Change now={t} before={on(salesByDay, yesterday)} /> });
  }
  if (showCash) {
    const income = cashByDay.income[day] || 0;
    const expense = cashByDay.expense[day] || 0;
    kpis.push({ label: "Net cash today", value: compactMoney(income - expense), title: money(income - expense), negative: income - expense < 0, foot: <span className="text-slate-500">In {compactMoney(income)} · Out {compactMoney(expense)}</span> });
  }
  if (req && permissions?.requisitions?.decide) {
    const pending = req.toDecide || 0;
    kpis.push({ label: "Requisitions to approve", value: number(pending), foot: pending ? <Link to="/requisitions" className="font-medium text-primary-700 hover:underline">Review now</Link> : <span className="text-slate-500">Nothing waiting</span> });
  }
  const activeStaff = summaryValue(cards, "hr", "Active staff");
  if (activeStaff != null) kpis.push({ label: "Active staff", value: number(activeStaff), foot: <span className="text-slate-500">On the payroll</span> });
  // Officers of other departments: fill from their own end-of-day figures.
  for (const card of cards) {
    for (const s of card.summary) {
      if (kpis.length >= 4) break;
      if (kpis.some((k) => k.label === s.label)) continue;
      kpis.push({ label: s.label, value: s.type === "money" ? compactMoney(s.value) : number(s.value), title: s.type === "money" ? money(s.value) : undefined, negative: Number(s.value) < 0, foot: <span className="text-slate-500">Today · {navForDepartment(card.department)?.label || card.title}</span> });
    }
  }

  // ---- Needs attention ------------------------------------------------
  const attention = [];
  if (req?.toDecide > 0) attention.push({ key: "decide", severity: "medium", count: req.toDecide, title: `${plural(req.toDecide, "Requisition")} awaiting your approval`, detail: "Approve, return or reject", to: "/requisitions" });
  if (req?.toFulfil > 0 && permissions?.requisitions?.fulfil) attention.push({ key: "fulfil", severity: "low", count: req.toFulfil, title: `Approved ${plural(req.toFulfil, "requisition")} to fulfil`, detail: "Issue from stores or raise a purchase order", to: "/requisitions" });
  if (req?.department?.returned > 0) attention.push({ key: "returned", severity: "medium", count: req.department.returned, title: `${plural(req.department.returned, "Requisition")} returned for changes`, detail: "Edit and resubmit", to: "/requisitions" });
  if (lowStock.data?.length) attention.push({ key: "stock", severity: "high", count: lowStock.data.length, title: `Store ${plural(lowStock.data.length, "item")} at or below reorder level`, detail: lowStock.data.slice(0, 3).map((i) => i.name).join(", "), to: "/stores?tab=items" });
  if (vaccinations.data?.length) attention.push({ key: "vacc", severity: "medium", count: vaccinations.data.length, title: `${plural(vaccinations.data.length, "Vaccination")} due within 7 days`, detail: vaccinations.data.slice(0, 3).map((v) => `${v.animal?.tagNumber || ""} ${v.vaccine || ""}`.trim()).join(", "), to: "/livestock?tab=vaccinations" });
  if (contracts.data?.length) attention.push({ key: "contracts", severity: "low", count: contracts.data.length, title: `${plural(contracts.data.length, "Contract")} ending within 30 days`, detail: contracts.data.slice(0, 3).map((c) => `${c.employee?.firstName || ""} ${c.employee?.lastName || ""}`.trim()).join(", "), to: "/hr?tab=contracts" });
  if (salaries.data?.length) attention.push({ key: "salaries", severity: "medium", count: salaries.data.length, title: `Staff ${salaries.data.length === 1 ? "salary" : "salaries"} to pay`, detail: `${money(salaries.data.reduce((sum, line) => sum + line.netPay, 0))} sent by HR`, to: "/accounts?tab=salaries" });
  const onRoad = (dispatches.data || []).filter((d) => d.status === "dispatched" && dayOf(d.date) < day).length;
  if (onRoad) attention.push({ key: "road", severity: "high", count: onRoad, title: `Vehicle ${plural(onRoad, "trip")} from earlier days not reconciled`, detail: "Reconcile the trip under Vehicle sales", to: "/sales?tab=vehicles-out" });
  const unsent = summaryValue(cards, "livestock", "Not yet sent (litres)");
  if (unsent > 0) attention.push({ key: "unsent", severity: "low", count: `${number(unsent, 0)} L`, title: "Today's milk not yet sent to MVA", to: "/livestock?tab=transfers" });
  const variance = summaryValue(cards, "sales", "Vehicle shortage / excess");
  if (variance < 0) attention.push({ key: "variance", severity: "high", count: compactMoney(Math.abs(variance)), title: "Vehicle cash short today", detail: `Short by ${money(Math.abs(variance))}`, to: "/sales?tab=vehicles-out" });

  // ---- Recent activity ------------------------------------------------
  const activity = [
    ...(sales.data || []).map((s) => ({ key: `s${s.id}`, at: s.createdAt, kind: "Sale", title: s.customerName || s.reference || "Local sale", detail: s.saleNumber, amount: money(s.totalAmount) })),
    ...(dispatches.data || []).map((d) => ({ key: `d${d.id}`, at: d.updatedAt || d.createdAt, kind: "Vehicle trip", title: `${d.driverName} · ${d.salesPersonName}`, detail: d.dispatchNumber, badge: <Badge value={d.status}>{label("dispatchStatus", d.status)}</Badge> })),
    ...(ledger.data || []).map((t) => ({ key: `t${t.id}`, at: t.createdAt, kind: t.type === "expense" ? "Expense" : "Income", title: t.description, detail: label(t.type === "income" ? "incomeCategories" : "expenseCategories", t.category), amount: `${t.type === "expense" ? "−" : "+"}${money(t.amount)}`, negative: t.type === "expense" })),
    ...(requisitions.data || []).map((r) => ({ key: `r${r.id}`, at: r.updatedAt || r.createdAt, kind: "Requisition", title: r.title, detail: `${r.requisitionNumber} · ${label("departments", r.department)}`, badge: <Badge value={r.status}>{label("requisitionStatus", r.status)}</Badge> })),
  ].filter((a) => a.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);

  const listsLoading = [herd, farmers, sales, dispatches, ledger, requisitions].some((f) => f.loading && !f.data);
  const role = `${label("roles", user?.role)}${user?.department ? ` · ${label("departments", user.department)}` : ""}`;
  const hasCharts = showMilk || showSales || showCash;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{weekday(day)}, {date(day)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{greeting()}, {user?.name?.split(" ")[0] || ""}</h1>
          <p className="mt-1 text-sm text-slate-500">{role}</p>
        </div>
        {permissions?.reports?.length > 0 && (
          <Link to="/reports" className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 sm:self-auto">
            <FileBarChart2 size={16} aria-hidden /> Reports
          </Link>
        )}
      </header>

      <Alert tone="error">{summary.error}</Alert>

      {/* Today's headline figures: one ruled strip, read left to right like a statement. */}
      {(kpis.length > 0 || (summary.loading && !data)) && (
        <KeyFigures
          size="lg"
          loading={summary.loading && !data && !kpis.length ? 4 : 0}
          items={kpis.slice(0, 4).map((k) => ({ label: k.label, value: k.value, hint: k.foot, title: k.title, tone: k.negative ? "bad" : undefined }))}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-x-12 gap-y-10 xl:grid-cols-3">
        {/* Main column: trends, then the departments' own figures. */}
        <div className="min-w-0 space-y-10 xl:col-span-2">
          {showMilk && (
            <ChartSection
              title="Milk intake"
              description={`Litres per day, last ${DAYS} days`}
              loading={(herd.loading && !herd.data) || (farmers.loading && !farmers.data)}
              total={{ value: litres(total(milkByDay.herd) + total(milkByDay.farmers)), label: `${DAYS}-day total` }}
            >
              <ColumnChart
                title="Milk intake per day"
                stacked
                data={chartRows(days, { ...(herd.data ? { herd: milkByDay.herd } : {}), ...(farmers.data ? { farmers: milkByDay.farmers } : {}) })}
                series={[...(herd.data ? [{ key: "herd", label: "Own herd" }] : []), ...(farmers.data ? [{ key: "farmers", label: "Local farmers" }] : [])]}
                format={(v, full) => (full ? litres(v) : number(v, 0))}
              />
            </ChartSection>
          )}
          {(showSales || showCash) && (
            <div className={cx("grid grid-cols-1 gap-x-10 gap-y-10", showSales && showCash && "lg:grid-cols-2")}>
              {showSales && (
                <ChartSection title="Sales" description={`Value per day, last ${DAYS} days`} loading={(sales.loading && !sales.data) || (dispatches.loading && !dispatches.data)} total={{ value: compactMoney(total(salesByDay.local) + total(salesByDay.vehicles)), label: `${DAYS}-day total` }}>
                  <ColumnChart
                    title="Sales value per day"
                    stacked
                    height={220}
                    data={chartRows(days, salesByDay)}
                    series={[...(sales.data ? [{ key: "local", label: "Local sales" }] : []), ...(dispatches.data ? [{ key: "vehicles", label: "Vehicle sales" }] : [])]}
                    format={(v, full) => (full ? money(v) : compactMoney(v))}
                  />
                </ChartSection>
              )}
              {showCash && (
                <ChartSection title="Income and expenses" description={`Posted entries per day, last ${DAYS} days`} loading={ledger.loading && !ledger.data} total={{ value: compactMoney(total(cashByDay.income) - total(cashByDay.expense)), label: `Net, ${DAYS} days` }}>
                  <ColumnChart
                    title="Income and expenses per day"
                    height={220}
                    data={chartRows(days, cashByDay)}
                    series={[{ key: "income", label: "Income" }, { key: "expense", label: "Expenses" }]}
                    format={(v, full) => (full ? money(v) : compactMoney(v))}
                  />
                </ChartSection>
              )}
            </div>
          )}
          {cards.length > 0 ? <DepartmentsToday cards={cards} hide={kpis.slice(0, 4).map((k) => k.label)} /> : !hasCharts && summary.loading && <Skeleton className="h-72" />}
        </div>

        {/* Side column: what needs doing, and what just happened. */}
        <div className="min-w-0 space-y-10">
          <NeedsAttention items={attention} loading={summary.loading && !data} />
          {(hasCharts || activity.length > 0) && <RecentActivity items={activity} loading={listsLoading && !activity.length} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
