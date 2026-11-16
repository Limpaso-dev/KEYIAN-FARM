import { useState } from "react";
import { Ban } from "lucide-react";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Input } from "../../components/ui/ui";
import { Search } from "lucide-react";
import { departmentLabel } from "./departments";
import { ReportTable } from "../../components/reports/ReportDocument";
import { SystemNote } from "../../components/ui/KeyFigures";
import { useAuth } from "../../context/useAuth";
import { digitsOnly, farmerNumberFilter, numberStartsWith } from "../../lib/farmers";
import { daysAgo, fullName, money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { put } from "../../lib/api";
import { clearFetchCache, useFetch } from "../../lib/useFetch";
import { payroll } from "../hr/payroll";
import { PurchaseOrders } from "./PurchaseOrdersPage";

// ---------------------------------------------------------------------
// Income and expenses with a summary for the period, by department.
// ---------------------------------------------------------------------
const DepartmentSummary = () => {
  const { label, meta } = useAuth();
  const [range, setRange] = useState({ from: today().slice(0, 8) + "01", to: today() });
  const { data } = useFetch("/accounts/transactions/summary", range);
  // Accounts' departments in their order, then any older entry outside them.
  const order = (meta?.accountDepartments || []).map((d) => d.value);
  const rows = [...(data?.departments || [])]
    .sort((a, b) => (order.includes(a.department) ? order.indexOf(a.department) : 99) - (order.includes(b.department) ? order.indexOf(b.department) : 99))
    .map((d) => ({ department: departmentLabel(label, d.department), income: d.income, expenses: d.expenses, net: d.net }));
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">Summary for the period</h2>
        <div className="flex gap-2">
          <label className="text-xs text-slate-500">From<Input type="date" className="mt-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label className="text-xs text-slate-500">To<Input type="date" className="mt-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
      </div>
      {/* An income and expenditure statement by department: rows and columns, then the totals. */}
      <div className="py-5">
        <ReportTable
          emptyText="Nothing recorded"
          section={{
            title: "Income and expenses by department",
            columns: [{ key: "department", label: "Department" }, { key: "income", label: "Income (KES)", type: "money" }, { key: "expenses", label: "Expenses (KES)", type: "money" }, { key: "net", label: "Net (KES)", type: "money" }],
            rows,
            totals: { income: data?.income ?? 0, expenses: data?.expenses ?? 0, net: data?.net ?? 0 },
          }}
        />
      </div>
      <SystemNote className="border-t border-slate-200 pt-3" />
    </section>
  );
};

const transactions = {
  resource: "transactions",
  endpoint: "/accounts/transactions",
  title: "Income and expenses",
  description: "Each entry is recorded against a department: Crops as Tea, Sugarcane or Coffee; Dispensary and Rentals as departments of their own. Salaries, member payments and supplier payments are recorded here when they are paid. Entries are never deleted; the head of Accounts can void a manual entry with a reason.",
  singular: "Entry",
  createLabel: "Record income / expense",
  editFields: false,
  deletable: false,
  defaultQuery: { from: daysAgo(30), to: today() },
  filters: [
    { type: "search", placeholder: "Reference, description, payee" },
    { name: "type", label: "Type", options: "transactionTypes" },
    { name: "department", label: "Department", options: "accountDepartments" },
    { name: "status", label: "Status", options: [{ value: "posted", label: "Posted" }, { value: "voided", label: "Voided" }] },
    { type: "dateRange" },
  ],
  columns: [
    { key: "reference", label: "Ref" },
    { key: "date", label: "Date", type: "date" },
    { key: "type", label: "Type", render: (r) => <span className={r.type === "income" ? "text-emerald-700" : "text-rose-700"}>{r.type === "income" ? "Income" : "Expense"}</span> },
    { key: "department", label: "Department", render: (r, c) => departmentLabel(c.label, r.department) },
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
    { name: "department", label: "Department", type: "select", options: "accountDepartments", required: true, help: "Crops: choose Tea, Sugarcane or Coffee" },
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
  const { can, label } = useAuth();
  const [lines, setLines] = useState(row.lines);
  const [find, setFind] = useState("");
  const editable = row.status === "draft" && can("milkPayments", "write");
  // A farmer is found by number: 131 shows farmer 131, 13 the farmers 130 to 139.
  const shown = find ? lines.filter((l) => numberStartsWith(l.supplier.supplierNumber, find)) : lines;
  const save = async (line, deductions) => {
    const result = await put(`/accounts/milk-payments/${row.id}/lines/${line.id}`, { deductions: deductions || 0 });
    setLines(result.data.lines);
    // The run's total to pay, in the list above, follows.
    clearFetchCache();
  };
  return (
    <div className="max-w-4xl space-y-3">
      {lines.length > 5 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-full sm:w-52">
            <span className="sr-only">Find a farmer by number</span>
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input type="search" inputMode="numeric" placeholder="Farmer number" className="pl-8 tabular-nums" value={find} onChange={(e) => setFind(digitsOnly(e.target.value))} />
          </label>
          <p className="text-xs text-slate-500" aria-live="polite">{find ? `${shown.length} of ${lines.length} farmers shown` : `${lines.length} farmers`}</p>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Farmer</th><th>Paid by</th><th className="text-right">Litres</th><th className="text-right">Earned</th><th className="text-right">Deductions</th><th className="text-right">Net</th></tr></thead>
        <tbody className="divide-y divide-slate-200">
          {shown.map((l) => (
            <tr key={l.id}>
              <td className="py-1.5">{l.supplier.supplierNumber} - {fullName(l.supplier)}</td>
              <td>{label("paymentMethods", l.supplier.paymentMethod)} {[l.supplier.bankName, l.supplier.accountNumber].filter(Boolean).join(" ")}</td>
              <td className="text-right">{number(l.litres)}</td>
              <td className="text-right">{money(l.amount)}</td>
              <td className="text-right">{editable ? <div className="ml-auto w-28"><Input type="number" min={0} className="py-1 text-right tabular-nums" defaultValue={l.deductions || ""} onBlur={(e) => Number(e.target.value || 0) !== l.deductions && save(l, e.target.value)} aria-label={`Deductions for ${fullName(l.supplier)}`} /></div> : money(l.deductions)}</td>
              <td className="text-right font-medium">{money(l.netAmount)}</td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={6} className="py-3 text-center text-slate-500">No farmer number {find} in this run</td></tr>}
        </tbody>
      </table>
    </div>
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
  created: () => "Member paid and recorded as an expense under Members payment",
};

// Paying a salary records it as an expense under Salaries, charged to the
// staff member's department (Crops staff: their crop, chosen here).
const salaries = {
  ...payroll,
  title: "Salaries to pay",
  description: "Payroll generated by HR, ready for payment. Each salary paid is recorded as an expense under Salaries, charged to the staff member's department.",
  defaultQuery: { status: "with_finance" },
  toolbar: undefined,
  filters: [{ name: "status", label: "Status", options: "payrollStatus" }],
  actions: payroll.actions.map((action) => (action.key !== "pay" ? action : {
    ...action,
    fields: [
      ...action.fields,
      { name: "department", label: "Charged to", type: "select", options: "accountDepartments", required: true, help: "The staff member's department. Crops staff: Tea, Sugarcane or Coffee." },
    ],
    initial: (r) => ({ date: today(), department: r.employee?.department === "crops" ? "" : r.employee?.department || "" }),
  })),
};

// MVA registers each farmer's name and number. Accounts keeps the rest.
const farmerDetails = {
  resource: "farmerDetails",
  endpoint: "/accounts/farmers",
  title: "Farmer details",
  description: "MVA registers each farmer's name and number. Accounts keeps their ID and payment details here; MVA cannot see them. Find a farmer by their farmer number.",
  singular: "Farmer",
  canCreate: () => false,
  createFields: null,
  deletable: false,
  filters: [farmerNumberFilter, { name: "status", label: "Status", options: "supplierStatus" }],
  columns: [
    { key: "supplierNumber", label: "No." },
    { key: "name", label: "Farmer", render: fullName },
    { key: "nationalId", label: "National ID" },
    { key: "paymentMethod", label: "Paid by", type: "option:paymentMethods" },
    { key: "bankName", label: "Bank" },
    { key: "accountNumber", label: "Account number" },
    { key: "phone", label: "Phone" },
  ],
  editFields: [
    { name: "nationalId", label: "National ID" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "paymentMethod", label: "Paid by", type: "select", options: "paymentMethods", optionFilter: (o) => o.value !== "credit", required: true },
    { name: "bankName", label: "Bank" },
    { name: "accountNumber", label: "Account number", help: "Bank account or M-Pesa number" },
    { name: "location", label: "Location" },
  ],
};

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
    sections={{
      entries: () => <ResourcePage config={transactions} header={() => <DepartmentSummary />} />,
      accounts: () => <ResourcePage config={moneyAccounts} />,
      milk: () => <ResourcePage config={milkPayments} />,
      farmers: () => <ResourcePage config={farmerDetails} />,
      salaries: () => <ResourcePage config={salaries} />,
      members: () => <ResourcePage config={memberPayments} />,
      orders: () => <PurchaseOrders />,
      suppliers: () => <ResourcePage config={suppliers} />,
    }}
  />
);

export default AccountsPage;
