import { useState } from "react";
import { Ban } from "lucide-react";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Card, Input, StatCard } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { daysAgo, fullName, money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { put } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { payroll } from "../hr/payroll";
import { purchaseOrdersConfig } from "./purchaseOrders";

// ---------------------------------------------------------------------
// Income and expenses with a category summary for the period.
// ---------------------------------------------------------------------
const CategorySummary = () => {
  const { label } = useAuth();
  const [range, setRange] = useState({ from: today().slice(0, 8) + "01", to: today() });
  const { data } = useFetch("/accounts/transactions/summary", range);
  const rows = data?.rows || [];
  const list = (type) => rows.filter((r) => r.type === type).sort((a, b) => b.amount - a.amount);
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Summary for the period</h2>
        <div className="flex gap-2">
          <label className="text-xs text-slate-500">From<Input type="date" className="mt-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label className="text-xs text-slate-500">To<Input type="date" className="mt-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Income" value={money(data?.income)} />
        <StatCard label="Expenses" value={money(data?.expenses)} />
        <StatCard label="Net" value={money(data?.net)} tone={data?.net < 0 ? "warn" : "default"} />
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {[["income", "Income by category", "incomeCategories"], ["expense", "Expenses by category", "expenseCategories"]].map(([type, title, options]) => (
          <div key={type}>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">{title}</h3>
            {list(type).length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {list(type).map((r) => <li key={r.category} className="flex justify-between py-1.5"><span>{label(options, r.category)}</span><span className="tabular-nums">{money(r.amount)}</span></li>)}
              </ul>
            ) : <p className="py-2 text-sm text-slate-500">Nothing recorded</p>}
          </div>
        ))}
      </div>
    </Card>
  );
};

const transactions = {
  resource: "transactions",
  endpoint: "/accounts/transactions",
  title: "Income and expenses",
  description: "Entries are never deleted. The head of Accounts can void a manual entry with a reason.",
  singular: "Entry",
  createLabel: "Record income / expense",
  editFields: false,
  deletable: false,
  defaultQuery: { from: daysAgo(30), to: today() },
  filters: [
    { type: "search", placeholder: "Reference, description, payee" },
    { name: "type", label: "Type", options: "transactionTypes" },
    { name: "status", label: "Status", options: [{ value: "posted", label: "Posted" }, { value: "voided", label: "Voided" }] },
    { type: "dateRange" },
  ],
  columns: [
    { key: "reference", label: "Ref" },
    { key: "date", label: "Date", type: "date" },
    { key: "type", label: "Type", render: (r) => <span className={r.type === "income" ? "text-emerald-700" : "text-rose-700"}>{r.type === "income" ? "Income" : "Expense"}</span> },
    { key: "category", label: "Category", render: (r, c) => c.label(r.type === "income" ? "incomeCategories" : "expenseCategories", r.category) },
    { key: "description", label: "Description" },
    { key: "party", label: "Paid to / from" },
    { key: "account", label: "Account", render: (r) => r.account?.name },
    { key: "amount", label: "Amount", type: "money" },
    { key: "status", label: "Status", render: (r) => (r.status === "voided" ? <span title={r.voidReason} className="text-slate-400 line-through">Voided</span> : "Posted") },
  ],
  createFields: [
    { name: "type", label: "Type", type: "select", options: "transactionTypes", required: true, onSelect: () => ({ category: "" }) },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "category", label: "Category", type: "select", options: "incomeCategories", required: true, showIf: (v) => v.type === "income" },
    { name: "category", label: "Category", type: "select", options: "expenseCategories", required: true, showIf: (v) => v.type === "expense" },
    { name: "amount", label: "Amount (KES)", type: "number", required: true },
    { name: "accountId", label: "Account", type: "select", ref: refs.moneyAccounts, required: true },
    { name: "party", label: "Paid to / received from" },
    { name: "department", label: "Department", type: "select", options: "departments", placeholder: "Not specific" },
    { name: "description", label: "Description", type: "textarea", required: true },
  ],
  createInitial: () => ({ type: "expense", date: today() }),
  actions: [{
    key: "void", label: "Void", icon: Ban, variant: "ghost",
    allowed: (c) => c.can("transactions", "void"), when: (r) => r.status === "posted" && r.sourceType === "manual",
    path: (r) => `/accounts/transactions/${r.id}/void`, title: (r) => `Void ${r.reference} (${money(r.amount)})`,
    fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }], tone: "danger", submitLabel: "Void entry",
  }],
};

const moneyAccounts = {
  resource: "accounts",
  endpoint: "/accounts/accounts/balances",
  title: "Cash, bank and M-Pesa accounts",
  singular: "Account",
  createLabel: "Add account",
  createPath: "/accounts/accounts",
  itemEndpoint: "/accounts/accounts",
  deletable: false,
  columns: [
    { key: "name", label: "Account" },
    { key: "accountType", label: "Type", type: "option:accountTypes" },
    { key: "accountNumber", label: "Number" },
    { key: "openingBalance", label: "Opening balance", type: "money" },
    { key: "balance", label: "Current balance", type: "money" },
    { key: "isActive", label: "Active", type: "bool" },
  ],
  createFields: [
    { name: "name", label: "Name", required: true, placeholder: "e.g. Equity Bank - Main" },
    { name: "accountType", label: "Type", type: "select", options: "accountTypes", required: true },
    { name: "accountNumber", label: "Account / till number" },
    { name: "openingBalance", label: "Opening balance (KES)", type: "number" },
  ],
  editFields: [
    { name: "name", label: "Name", required: true },
    { name: "accountNumber", label: "Account / till number" },
    { name: "isActive", label: "Active", type: "checkbox", checkboxLabel: "Account is in use" },
  ],
};

const milkPayments = {
  resource: "milkPayments",
  endpoint: "/accounts/milk-payments",
  title: "Farmer milk payments",
  description: "Collects every unpaid farmer delivery in the period, totals it per farmer, and pays it under Members payment.",
  singular: "Payment run",
  createLabel: "Prepare payment run",
  editFields: false,
  deletableWhen: (r) => r.status === "draft",
  filters: [{ name: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "paid", label: "Paid" }] }],
  columns: [
    { key: "runNumber", label: "Run" },
    { key: "period", label: "Period", render: (r) => `${String(r.periodStart).slice(0, 10)} to ${String(r.periodEnd).slice(0, 10)}` },
    { key: "farmers", label: "Farmers", render: (r) => r.lines.length, align: "right" },
    { key: "totalLitres", label: "Litres", type: "number" },
    { key: "totalAmount", label: "Net to pay", type: "money" },
    { key: "status", label: "Status", type: "status:payrollStatus" },
  ],
  createFields: [
    { name: "periodStart", label: "From", type: "date", required: true },
    { name: "periodEnd", label: "To", type: "date", required: true },
  ],
  createInitial: () => ({ periodStart: today().slice(0, 8) + "01", periodEnd: today() }),
  expand: (row) => <MilkRunLines row={row} />,
  actions: [{
    key: "pay", label: "Pay farmers", variant: "primary",
    allowed: (c) => c.can("milkPayments", "pay"), when: (r) => r.status === "draft",
    path: (r) => `/accounts/milk-payments/${r.id}/pay`, title: (r) => `Pay ${r.runNumber} - ${money(r.totalAmount)}`,
    fields: [{ name: "accountId", label: "Pay from", type: "select", ref: refs.moneyAccounts, required: true }, { name: "date", label: "Payment date", type: "date", required: true }],
    initial: () => ({ date: today() }),
    success: () => "Farmers paid and recorded under Members payment",
  }],
};

const MilkRunLines = ({ row }) => {
  const { can } = useAuth();
  const [lines, setLines] = useState(row.lines);
  const editable = row.status === "draft" && can("milkPayments", "write");
  const save = async (line, deductions) => {
    const result = await put(`/accounts/milk-payments/${row.id}/lines/${line.id}`, { deductions: deductions || 0 });
    setLines(result.data.lines);
  };
  return (
    <table className="w-full max-w-4xl text-sm">
      <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Farmer</th><th>Paid by</th><th className="text-right">Litres</th><th className="text-right">Earned</th><th className="text-right">Deductions</th><th className="text-right">Net</th></tr></thead>
      <tbody className="divide-y divide-slate-200">
        {lines.map((l) => (
          <tr key={l.id}>
            <td className="py-1.5">{l.supplier.supplierNumber} - {fullName(l.supplier)}</td>
            <td>{l.supplier.paymentMethod} {l.supplier.paymentDetails}</td>
            <td className="text-right">{number(l.litres)}</td>
            <td className="text-right">{money(l.amount)}</td>
            <td className="text-right">{editable ? <Input type="number" min={0} className="ml-auto w-28 py-1 text-right" defaultValue={l.deductions || ""} onBlur={(e) => Number(e.target.value || 0) !== l.deductions && save(l, e.target.value)} aria-label={`Deductions for ${fullName(l.supplier)}`} /> : money(l.deductions)}</td>
            <td className="text-right font-medium">{money(l.netAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const memberPayments = {
  resource: "memberPayments",
  endpoint: "/accounts/member-payments",
  title: "Payments to members",
  description: "Dividends and other payments to pioneer members or their successors.",
  singular: "Payment",
  createLabel: "Pay member",
  editFields: false,
  deletable: false,
  filters: [{ name: "paymentType", label: "Type", options: "memberPaymentTypes" }, { type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "member", label: "Member", render: (r) => `${r.member.memberNumber} - ${fullName(r.member)}` },
    { key: "paymentType", label: "Type", type: "option:memberPaymentTypes" },
    { key: "amount", label: "Amount", type: "money" },
    { key: "description", label: "Description" },
  ],
  createFields: [
    { name: "memberId", label: "Member", type: "select", ref: refs.members, required: true, span: 2 },
    { name: "paymentType", label: "Type", type: "select", options: "memberPaymentTypes", required: true },
    { name: "amount", label: "Amount (KES)", type: "number", required: true },
    { name: "accountId", label: "Pay from", type: "select", ref: refs.moneyAccounts, required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "description", label: "Description", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), paymentType: "dividend" }),
};

const salaries = { ...payroll, title: "Salaries to pay", description: "Payroll approved by the head of HR, ready for payment.", defaultQuery: { status: "approved" }, toolbar: undefined, filters: [{ name: "status", label: "Status", options: "payrollStatus" }] };

const suppliers = {
  resource: "suppliers",
  endpoint: "/accounts/suppliers",
  title: "Suppliers",
  singular: "Supplier",
  createLabel: "Add supplier",
  filters: [{ type: "search", placeholder: "Name, contact, phone" }, { name: "status", label: "Status", options: "supplierStatus" }],
  columns: [
    { key: "name", label: "Supplier" },
    { key: "contactPerson", label: "Contact" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "kraPin", label: "KRA PIN" },
    { key: "status", label: "Status", type: "status:supplierStatus" },
  ],
  createFields: [
    { name: "name", label: "Name", required: true },
    { name: "contactPerson", label: "Contact person" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "kraPin", label: "KRA PIN" },
    { name: "status", label: "Status", type: "select", options: "supplierStatus" },
    { name: "address", label: "Address", span: 2 },
  ],
  createInitial: () => ({ status: "active" }),
};

const AccountsPage = () => (
  <ModulePage
    title="Accounts"
    description="Income and expenses, payments to farmers, members, staff and suppliers, and procurement."
    tabs={[
      { key: "entries", label: "Income & expenses", show: (c) => c.can("transactions"), render: () => <ResourcePage config={transactions} header={() => <CategorySummary />} /> },
      { key: "accounts", label: "Accounts", show: (c) => c.can("accounts"), render: () => <ResourcePage config={moneyAccounts} /> },
      { key: "milk", label: "Farmer payments", show: (c) => c.can("milkPayments"), render: () => <ResourcePage config={milkPayments} /> },
      { key: "salaries", label: "Salaries", show: (c) => c.can("payroll", "pay"), render: () => <ResourcePage config={salaries} /> },
      { key: "members", label: "Member payments", show: (c) => c.can("memberPayments"), render: () => <ResourcePage config={memberPayments} /> },
      { key: "orders", label: "Purchase orders", show: (c) => c.can("purchaseOrders"), render: () => <ResourcePage config={purchaseOrdersConfig} /> },
      { key: "suppliers", label: "Suppliers", show: (c) => c.can("suppliers"), render: () => <ResourcePage config={suppliers} /> },
    ]}
  />
);

export default AccountsPage;
