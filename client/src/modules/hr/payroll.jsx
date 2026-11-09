import { CalendarPlus } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { fullName, money, today } from "../../lib/format";
import { refs } from "../../lib/refs";

const thisMonth = () => today().slice(0, 7);
const staffName = (row) => (row.employee ? `${row.employee.staffNumber} - ${fullName(row.employee)}` : "");

// Shared by HR (generate and adjust) and Accounts (pay).
export const payroll = {
  resource: "payroll",
  endpoint: "/hr/payroll",
  title: "Payroll",
  description: "Generating a month sends it straight to Finance for payment. HR can adjust allowances and deductions until a line is paid.",
  singular: "Payroll line",
  createFields: null,
  defaultQuery: { period: thisMonth() },
  filters: [{ name: "status", label: "Status", options: "payrollStatus" }],
  editableWhen: (row) => row.status !== "paid",
  deletableWhen: (row) => row.status !== "paid",
  editFields: [
    { name: "allowances", label: "Allowances (KES)", type: "number" },
    { name: "deductions", label: "Deductions (KES)", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  columns: [
    { key: "period", label: "Month" },
    { key: "employee", label: "Staff", render: staffName },
    { key: "department", label: "Department", render: (r, ctx) => ctx.label("departments", r.employee?.department) },
    { key: "basicSalary", label: "Basic", type: "money" },
    { key: "allowances", label: "Allowances", type: "money" },
    { key: "deductions", label: "Deductions", type: "money" },
    { key: "netPay", label: "Net pay", type: "money" },
    { key: "status", label: "Status", type: "status:payrollStatus" },
  ],
  actions: [
    {
      key: "pay", label: "Pay", allowed: (ctx) => ctx.can("payroll", "pay"), when: (r) => r.status !== "paid", path: (r) => `/hr/payroll/${r.id}/pay`,
      title: (r) => `Pay ${staffName(r)} - ${money(r.netPay)}`,
      fields: [{ name: "accountId", label: "Pay from", type: "select", ref: refs.moneyAccounts, required: true, span: 2 }, { name: "date", label: "Payment date", type: "date", required: true }],
      initial: () => ({ date: today() }),
      success: () => "Salary paid and recorded as an expense under Salaries",
    },
  ],
  footer: (rows) => rows.length > 0 && (
    <div className="flex flex-wrap justify-end gap-6 border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">{rows.length} staff</span>
      <span>Total net pay: <strong>{money(rows.reduce((s, r) => s + r.netPay, 0))}</strong></span>
    </div>
  ),
  toolbar: (ctx) => ctx.can("payroll", "write") && (
    <ActionButton label="Generate month" icon={CalendarPlus} path="/hr/payroll/generate" onDone={(r) => ctx.notify(r?.message)} submitLabel="Generate and send to Finance"
      fields={[{ name: "period", label: "Month", type: "month", required: true, help: "Adds a line for every active staff member not already on this month's payroll, and sends them to Finance" }]}
      initial={{ period: thisMonth() }} />
  ),
};
