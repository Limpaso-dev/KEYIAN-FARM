import { GitBranch } from "lucide-react";
import { payroll } from "./payroll";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Card, Spinner } from "../../components/ui/ui";
import { ReportTable } from "../../components/reports/ReportDocument";
import { SystemNote } from "../../components/ui/KeyFigures";
import { date, fullName, inputDate, money, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";

const staffName = (row) => (row.employee ? `${row.employee.staffNumber} - ${fullName(row.employee)}` : "");

// ---------------------------------------------------------------------
const employeeFields = (ctx, row) => [
  { name: "staffNumber", label: "Staff number", help: row ? undefined : "Leave blank to number automatically (EMP-0001)" },
  { name: "firstName", label: "First name", required: true },
  { name: "lastName", label: "Last name", required: true },
  { name: "nationalId", label: "National ID" },
  { name: "gender", label: "Gender", type: "select", options: "gender" },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "department", label: "Department", type: "select", options: "departments", required: true },
  ...(row ? [] : [{ name: "jobTitle", label: "Job title", required: true }]),
  { name: "employmentType", label: "Employment type", type: "select", options: "employmentTypes", required: true },
  { name: "dateHired", label: "Date hired", type: "date", required: true },
  ...(row ? [{ name: "status", label: "Status", type: "select", options: "employeeStatus", help: "Use Terminations to record a staff member leaving" }] : [{ name: "basicSalary", label: "Basic salary (KES)", type: "number", required: true }]),
  { name: "bankName", label: "Bank" },
  { name: "bankAccount", label: "Bank account" },
  { name: "kraPin", label: "KRA PIN" },
  { name: "address", label: "Address" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const staff = {
  resource: "employees",
  endpoint: "/hr/employees",
  title: "Staff register",
  singular: "Staff member",
  createLabel: "Add staff",
  filters: [{ type: "search", placeholder: "Name, staff no., ID, phone" }, { name: "department", label: "Department", options: "departments" }, { name: "status", label: "Status", options: "employeeStatus" }],
  defaultQuery: { status: "active" },
  columns: [
    { key: "staffNumber", label: "Staff no." },
    { key: "name", label: "Name", render: fullName },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "jobTitle", label: "Job title" },
    { key: "employmentType", label: "Type", type: "option:employmentTypes" },
    { key: "dateHired", label: "Hired", type: "date" },
    { key: "basicSalary", label: "Salary", type: "money" },
    { key: "status", label: "Status", type: "status:employeeStatus" },
  ],
  createFields: (ctx) => employeeFields(ctx),
  editFields: (ctx, row) => employeeFields(ctx, row),
  toForm: (row) => ({ ...row, dateOfBirth: inputDate(row.dateOfBirth), dateHired: inputDate(row.dateHired) }),
  createInitial: () => ({ employmentType: "permanent", dateHired: today() }),
  expand: (row) => (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      {[["National ID", row.nationalId], ["Phone", row.phone], ["Email", row.email], ["Bank", [row.bankName, row.bankAccount].filter(Boolean).join(" ")], ["KRA PIN", row.kraPin], ["System account", row.user ? `${row.user.email}${row.user.isActive ? "" : " (inactive)"}` : "None"], ["Notes", row.notes]].map(([k, v]) => (
        <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-800">{v || "-"}</dd></div>
      ))}
    </dl>
  ),
};

const contracts = {
  resource: "contracts",
  endpoint: "/hr/contracts",
  title: "Contracts",
  singular: "Contract",
  filters: [{ name: "status", label: "Status", options: "contractStatus" }, { name: "contractType", label: "Type", options: "contractTypes" }],
  columns: [
    { key: "contractNumber", label: "Contract" },
    { key: "employee", label: "Staff", render: staffName },
    { key: "contractType", label: "Type", type: "option:contractTypes" },
    { key: "startDate", label: "Start", type: "date" },
    { key: "endDate", label: "End", type: "date" },
    { key: "salary", label: "Salary", type: "money" },
    { key: "status", label: "Status", type: "status:contractStatus" },
  ],
  createFields: [
    { name: "employeeId", label: "Staff member", type: "select", ref: refs.employees, required: true, span: 2 },
    { name: "contractType", label: "Contract type", type: "select", options: "contractTypes", required: true },
    { name: "salary", label: "Salary (KES)", type: "number", required: true },
    { name: "startDate", label: "Start date", type: "date", required: true },
    { name: "endDate", label: "End date", type: "date", help: "Leave blank for permanent" },
    { name: "contractNumber", label: "Contract number", help: "Leave blank to number automatically" },
    { name: "status", label: "Status", type: "select", options: "contractStatus" },
    { name: "terms", label: "Terms", type: "textarea" },
  ],
  createInitial: () => ({ startDate: today(), status: "active" }),
  toForm: (row) => ({ ...row, startDate: inputDate(row.startDate), endDate: inputDate(row.endDate) }),
};

const salaryReviews = {
  resource: "salaryReviews",
  endpoint: "/hr/salary-reviews",
  title: "Salary reviews and promotions",
  description: "Saving a review updates the staff member's salary and job title.",
  singular: "Salary review",
  createLabel: "Record review",
  editFields: false,
  deletable: false,
  filters: [{ name: "reviewType", label: "Type", options: "salaryReviewTypes" }, { type: "dateRange" }],
  columns: [
    { key: "effectiveDate", label: "Effective", type: "date" },
    { key: "employee", label: "Staff", render: staffName },
    { key: "reviewType", label: "Type", type: "option:salaryReviewTypes" },
    { key: "previousSalary", label: "Previous", type: "money" },
    { key: "newSalary", label: "New", type: "money" },
    { key: "title", label: "Job title", render: (r) => (r.previousJobTitle !== r.newJobTitle ? `${r.previousJobTitle} → ${r.newJobTitle}` : r.newJobTitle) },
    { key: "reason", label: "Reason" },
  ],
  createFields: [
    { name: "employeeId", label: "Staff member", type: "select", ref: refs.employees, required: true, span: 2, onSelect: (e) => (e ? { currentSalary: money(e.basicSalary), currentTitle: e.jobTitle } : {}) },
    { name: "currentSalary", label: "Current salary", type: "display" },
    { name: "currentTitle", label: "Current job title", type: "display" },
    { name: "reviewType", label: "Review type", type: "select", options: "salaryReviewTypes", required: true },
    { name: "effectiveDate", label: "Effective date", type: "date", required: true },
    { name: "newSalary", label: "New salary (KES)", type: "number", required: true },
    { name: "newJobTitle", label: "New job title", help: "Leave blank to keep the current title" },
    { name: "reason", label: "Reason", type: "textarea", required: true },
  ],
  createInitial: () => ({ effectiveDate: today(), reviewType: "promotion" }),
};

const DisciplinarySummary = () => {
  const { data, loading } = useFetch("/hr/disciplinary/summary");
  if (loading) return <Spinner />;
  if (!data) return null;
  return (
    <Card className="overflow-hidden">
      <h2 className="border-b border-slate-200 px-5 py-4 text-[15px] font-semibold text-slate-900">Disciplinary summary</h2>
      <div className="space-y-6 px-5 py-5">
        <ReportTable
          narrow
          section={{
            title: "Summary",
            columns: [{ key: "item", label: "Item" }, { key: "count", label: "Count", type: "number" }],
            rows: [
              { item: "Total cases", count: data.totals.totalCases },
              { item: "Letters served", count: data.totals.lettersServed },
              { item: "Dismissals", count: data.totals.dismissals },
              { item: "Open cases", count: data.totals.openCases },
            ],
          }}
        />
        {data.rows.length > 0 && (
          <ReportTable
            section={{
              title: "Cases by staff member",
              columns: [
                { key: "staff", label: "Staff" },
                { key: "totalCases", label: "Cases", type: "number" },
                { key: "lettersServed", label: "Letters", type: "number" },
                { key: "warnings", label: "Warnings", type: "number" },
                { key: "suspensions", label: "Suspensions", type: "number" },
                { key: "dismissals", label: "Dismissals", type: "number" },
                { key: "lastIncident", label: "Last incident", type: "date" },
              ],
              rows: data.rows.map((r) => ({ ...r, staff: `${r.employee.staffNumber} - ${fullName(r.employee)}` })),
              totals: Object.fromEntries(["totalCases", "lettersServed", "warnings", "suspensions", "dismissals"].map((key) => [key, data.rows.reduce((t, r) => t + (r[key] || 0), 0)])),
            }}
          />
        )}
      </div>
      <footer className="border-t border-slate-200 bg-slate-50/70 px-5 py-3">
        <SystemNote />
      </footer>
    </Card>
  );
};

const disciplinary = {
  resource: "disciplinary",
  endpoint: "/hr/disciplinary",
  title: "Disciplinary cases",
  singular: "Case",
  createLabel: "Record case",
  filters: [{ name: "actionTaken", label: "Action", options: "disciplinaryActions" }, { name: "status", label: "Status", options: "caseStatus" }, { type: "dateRange" }],
  columns: [
    { key: "caseNumber", label: "Case" },
    { key: "incidentDate", label: "Date", type: "date" },
    { key: "employee", label: "Staff", render: staffName },
    { key: "offence", label: "Offence" },
    { key: "actionTaken", label: "Action", type: "option:disciplinaryActions" },
    { key: "letterServed", label: "Letter served", render: (r) => (r.letterServed ? `Yes${r.letterDate ? `, ${date(r.letterDate)}` : ""}` : "No") },
    { key: "status", label: "Status", type: "status:caseStatus" },
  ],
  createFields: [
    { name: "employeeId", label: "Staff member", type: "select", ref: refs.employees, required: true, span: 2 },
    { name: "incidentDate", label: "Incident date", type: "date", required: true },
    { name: "offence", label: "Offence", required: true },
    { name: "actionTaken", label: "Action taken", type: "select", options: "disciplinaryActions", required: true },
    { name: "status", label: "Status", type: "select", options: "caseStatus" },
    { name: "letterServed", label: "Letter served", type: "checkbox", checkboxLabel: "A letter was served" },
    { name: "letterDate", label: "Letter date", type: "date", showIf: (v) => v.letterServed },
    { name: "description", label: "What happened", type: "textarea" },
    { name: "outcome", label: "Outcome", type: "textarea" },
  ],
  createInitial: () => ({ incidentDate: today(), status: "open" }),
  toForm: (row) => ({ ...row, incidentDate: inputDate(row.incidentDate), letterDate: inputDate(row.letterDate) }),
  toPayload: (v) => ({ ...v, letterServed: Boolean(v.letterServed) }),
};

const terminations = {
  resource: "terminations",
  endpoint: "/hr/terminations",
  title: "Terminations",
  description: "Recording a termination closes the staff member's contracts and deactivates their system account.",
  singular: "Termination",
  createLabel: "Record termination",
  filters: [{ name: "terminationType", label: "Type", options: "terminationTypes" }, { type: "dateRange" }],
  columns: [
    { key: "terminationDate", label: "Date", type: "date" },
    { key: "employee", label: "Staff", render: staffName },
    { key: "terminationType", label: "Type", type: "option:terminationTypes" },
    { key: "reason", label: "Reason" },
    { key: "finalDues", label: "Final dues", type: "money" },
    { key: "clearanceStatus", label: "Clearance", type: "status:clearanceStatus" },
  ],
  createFields: [
    { name: "employeeId", label: "Staff member", type: "select", ref: refs.employees, required: true, span: 2 },
    { name: "terminationType", label: "Type", type: "select", options: "terminationTypes", required: true },
    { name: "terminationDate", label: "Date", type: "date", required: true },
    { name: "finalDues", label: "Final dues (KES)", type: "number" },
    { name: "clearanceStatus", label: "Clearance", type: "select", options: "clearanceStatus" },
    { name: "reason", label: "Reason", type: "textarea", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  editFields: [
    { name: "finalDues", label: "Final dues (KES)", type: "number" },
    { name: "clearanceStatus", label: "Clearance", type: "select", options: "clearanceStatus" },
    { name: "reason", label: "Reason", type: "textarea" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ terminationDate: today(), clearanceStatus: "pending" }),
  deletable: false,
};

const memberLine = (m) => `${m.memberNumber} - ${fullName(m)}`;
const members = {
  resource: "members",
  endpoint: "/hr/members",
  title: "Members register",
  description: "Pioneer founder members and the successors who inherit their membership.",
  singular: "Member",
  createLabel: "Add pioneer member",
  filters: [{ type: "search", placeholder: "Member no., name, ID" }, { name: "status", label: "Status", options: "memberStatus" }],
  columns: [
    { key: "memberNumber", label: "Member no." },
    { key: "name", label: "Name", render: fullName },
    { key: "isPioneer", label: "Type", render: (r) => (r.isPioneer ? "Pioneer" : "Successor") },
    { key: "joinDate", label: "Joined", type: "date" },
    { key: "shares", label: "Shares", type: "number" },
    { key: "predecessor", label: "Successor of", render: (r) => (r.predecessor ? `${memberLine(r.predecessor)} (${r.relationship || ""})` : "") },
    { key: "status", label: "Status", type: "status:memberStatus" },
  ],
  createFields: [
    { name: "memberNumber", label: "Member number", required: true },
    { name: "joinDate", label: "Date joined", type: "date", required: true },
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    { name: "nationalId", label: "National ID" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "shares", label: "Shares", type: "number", step: 1 },
    { name: "status", label: "Status", type: "select", options: "memberStatus" },
    { name: "address", label: "Address", span: 2 },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ isPioneer: true, status: "active", shares: 0 }),
  toForm: (row) => ({ ...row, joinDate: inputDate(row.joinDate) }),
  actions: [
    {
      key: "succession", label: "Register successor", icon: GitBranch,
      allowed: (ctx) => ctx.can("members", "succession"),
      when: (r) => r.status !== "succeeded",
      path: (r) => `/hr/members/${r.id}/succession`,
      title: (r) => `Successor to ${memberLine(r)}`,
      intro: (r) => <p className="text-sm text-slate-600">The successor inherits {r.shares} share(s). {fullName(r)} will be marked as succeeded.</p>,
      fields: [
        { name: "firstName", label: "First name", required: true },
        { name: "lastName", label: "Last name", required: true },
        { name: "relationship", label: "Relationship to member", required: true, placeholder: "e.g. Son, Daughter, Widow" },
        { name: "successionDate", label: "Succession date", type: "date", required: true },
        { name: "nationalId", label: "National ID" },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "memberNumber", label: "New member number", help: "Leave blank to use the original number with a suffix (e.g. P001-1)" },
        { name: "predecessorStatus", label: "Original member is now", type: "select", options: "memberStatus", optionFilter: (o) => o.value !== "active" },
        { name: "address", label: "Address", span: 2 },
      ],
      initial: () => ({ successionDate: today(), predecessorStatus: "deceased" }),
      success: (m) => `${memberLine(m)} registered as successor`,
    },
  ],
  expand: (row) => (
    <div className="text-sm">
      <p className="font-medium text-slate-700">Line of succession</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        {row.predecessor && <li>Succeeded {memberLine(row.predecessor)}</li>}
        {row.successors?.length ? row.successors.map((s) => <li key={s.id}>Succeeded by {memberLine(s)} ({s.relationship}) on {date(s.successionDate)}</li>) : <li>No successors registered</li>}
      </ul>
    </div>
  ),
};

const HRPage = () => (
  <ModulePage
    title="HR"
    description="Staffing, contracts, payroll and salary reviews, discipline, terminations and the members register."
    tabs={[
      { key: "staff", label: "Staff", show: (c) => c.can("employees"), render: () => <ResourcePage config={staff} /> },
      { key: "contracts", label: "Contracts", show: (c) => c.can("contracts"), render: () => <ResourcePage config={contracts} /> },
      { key: "reviews", label: "Salary reviews", show: (c) => c.can("salaryReviews"), render: () => <ResourcePage config={salaryReviews} /> },
      { key: "payroll", label: "Payroll", show: (c) => c.can("payroll"), render: () => <ResourcePage config={payroll} /> },
      { key: "discipline", label: "Disciplinary", show: (c) => c.can("disciplinary"), render: () => <ResourcePage config={disciplinary} header={() => <DisciplinarySummary />} /> },
      { key: "terminations", label: "Terminations", show: (c) => c.can("terminations"), render: () => <ResourcePage config={terminations} /> },
      { key: "members", label: "Members", show: (c) => c.can("members"), render: () => <ResourcePage config={members} /> },
    ]}
  />
);

export default HRPage;
