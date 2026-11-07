import { CalendarPlus, CheckCheck } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { fullName, money, today } from "../../lib/format";
import { refs } from "../../lib/refs";

const thisMonth = () => today().slice(0, 7);
const staffName = (row) => (row.employee ? `${row.employee.staffNumber} - ${fullName(row.employee)}` : "");

// Shared by HR (prepare/approve) and Accounts (pay).
export const payroll = {
  resource: "payroll",
  endpoint: "/hr/payroll",
  title: "Payroll",
  description: "HR generates and adjusts the month, the head of HR approves, Accounts pays.",
  singular: "Payroll line",
  createFields: null,
  defaultQuery: { period: thisMonth() },
  filters: [{ name: "status", label: "Status", options: "payrollStatus" }],
  editableWhen: (row) => row.status === "draft",
  deletableWhen: (row) => row.status === "draft",
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
    { key: "approve", label: "Approve", allowed: (ctx) => ctx.can("payroll", "approve"), when: (r) => r.status === "draft", path: (r) => `/hr/payroll/${r.id}/approve`, confirm: (r) => `Approve net pay of ${money(r.netPay)} for ${staffName(r)}?` },
    {
      key: "pay", label: "Pay", allowed: (ctx) => ctx.can("payroll", "pay"), when: (r) => r.status === "approved", path: (r) => `/hr/payroll/${r.id}/pay`,
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
  toolbar: (ctx) => (
    <>
      {ctx.can("payroll", "write") && (
        <ActionButton label="Generate month" icon={CalendarPlus} path="/hr/payroll/generate" onDone={(r) => ctx.notify(r?.message)}
          fields={[{ name: "period", label: "Month", type: "month", required: true, help: "Adds a line for every active staff member not already on this month's payroll" }]}
          initial={{ period: thisMonth() }} />
      )}
      {ctx.can("payroll", "approve") && (
        <ActionButton label="Approve month" icon={CheckCheck} path="/hr/payroll/approve-period" onDone={(r) => ctx.notify(r?.message)}
          fields={[{ name: "period", label: "Month", type: "month", required: true, help: "Approves every draft line for the month" }]}
          initial={{ period: thisMonth() }} />
      )}
    </>
  ),
};
