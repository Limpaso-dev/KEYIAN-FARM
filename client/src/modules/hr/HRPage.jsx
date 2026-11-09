import { GitBranch } from "lucide-react";
import { payroll } from "./payroll";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Spinner } from "../../components/ui/ui";
import { ReportTable } from "../../components/reports/ReportDocument";
import { SystemNote } from "../../components/ui/KeyFigures";
import { date, fullName, inputDate, money, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { adverts } from "./establishment";
import { staff, staffPath } from "./staff";

const staffName = (row) => (row.employee ? `${row.employee.staffNumber} - ${fullName(row.employee)}` : "");

// ---------------------------------------------------------------------
const contracts = {
  resource: "contracts",
  endpoint: "/hr/contracts",
  title: "Contracts",
  description: "Every contract on record. A contract is added when a staff member is registered, and renewed from their profile. Click one to open the staff member.",
  singular: "Contract",
  canCreate: () => false,
  createFields: null,
  editFields: false,
  deletable: false,
  rowTo: (row) => staffPath(row.employeeId),
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
};

const salaryReviews = {
  resource: "salaryReviews",
  endpoint: "/hr/salary-reviews",
  title: "Salary reviews and promotions",
  description: "Saving a review updates the salary everywhere: the staff record, their current contract and any payroll not yet paid.",
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
    { key: "group", label: "Job group", render: (r) => (r.previousJobGroup !== r.newJobGroup ? `${r.previousJobGroup || "Not set"} → ${r.newJobGroup}` : r.newJobGroup) },
    { key: "reason", label: "Reason" },
  ],
  createFields: [
    { name: "employeeId", label: "Staff member", type: "select", ref: refs.employees, required: true, span: 2, onSelect: (e) => (e ? { currentSalary: money(e.basicSalary), currentTitle: e.jobTitle, currentGroup: e.jobGroup || "Not set" } : {}) },
    { name: "currentSalary", label: "Current salary", type: "display" },
    { name: "currentTitle", label: "Current job title", type: "display" },
    { name: "currentGroup", label: "Current job group", type: "display" },
    { name: "reviewType", label: "Review type", type: "select", options: "salaryReviewTypes", required: true },
    { name: "effectiveDate", label: "Effective date", type: "date", required: true, help: "Today or earlier. The change applies as soon as you save." },
    { name: "newSalary", label: "New salary (KES)", type: "number", required: true },
    { name: "newJobTitle", label: "New job title", help: "Leave blank to keep the current title" },
    { name: "newJobGroup", label: "New job group", help: "Leave blank to keep the current group" },
    { name: "reason", label: "Reason", type: "textarea", required: true },
  ],
  createInitial: () => ({ effectiveDate: today(), reviewType: "promotion" }),
  created: () => "Salary updated on the staff record, current contract and unpaid payroll",
};

const DisciplinarySummary = () => {
  const { data, loading } = useFetch("/hr/disciplinary/summary");
  if (loading) return <Spinner />;
  if (!data) return null;
  return (
    <section>
      <h2 className="border-b border-slate-200 pb-2.5 text-[15px] font-semibold text-slate-900">Disciplinary summary</h2>
      <div className="space-y-6 py-5">
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
      <SystemNote className="border-t border-slate-200 pt-3" />
    </section>
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
const successionReason = (m, ctx) => (m.successionReason === "other" ? m.successionReasonOther : m.successionReason ? ctx.label("successionReasons", m.successionReason) : "Not recorded");
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
      when: (r) => r.status !== "succeeded" && !r.successors?.length,
      path: (r) => `/hr/members/${r.id}/succession`,
      title: (r) => `Successor to ${memberLine(r)}`,
      intro: (r) => <p className="text-sm text-slate-600">The successor inherits {r.shares} share(s) and takes the place of {fullName(r)}.</p>,
      fields: [
        { name: "firstName", label: "First name", required: true },
        { name: "lastName", label: "Last name", required: true },
        { name: "relationship", label: "Relationship to member", required: true, placeholder: "e.g. Son, Daughter, Widow" },
        { name: "successionDate", label: "Succession date", type: "date", required: true },
        { name: "nationalId", label: "National ID" },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "memberNumber", label: "New member number", help: "Leave blank to use the original number with a suffix (e.g. P001-1)" },
        { name: "successionReason", label: "Reason for the succession", type: "select", options: "successionReasons", required: true },
        { name: "successionReasonOther", label: "State the reason", required: true, showIf: (v) => v.successionReason === "other" },
        { name: "address", label: "Address", span: 2 },
      ],
      initial: () => ({ successionDate: today() }),
      success: (m) => `${memberLine(m)} registered as successor`,
    },
  ],
  expand: (row, ctx) => (
    <div className="text-sm">
      <p className="font-medium text-slate-700">Line of succession</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        {row.predecessor && <li>Took the place of {memberLine(row.predecessor)} on {date(row.successionDate)}. Reason: {successionReason(row, ctx)}</li>}
        {row.successors?.length ? row.successors.map((s) => <li key={s.id}>Replaced by {memberLine(s)} ({s.relationship}) on {date(s.successionDate)}. Reason: {successionReason(s, ctx)}</li>) : <li>No successor registered</li>}
      </ul>
    </div>
  ),
};

const successions = {
  resource: "members",
  endpoint: "/hr/members/successions",
  title: "Succession register",
  description: "Who took the place of whom, when and why. Successors are registered from the Members list.",
  singular: "Succession",
  canCreate: () => false,
  createFields: null,
  editFields: false,
  deletable: false,
  filters: [{ type: "search", placeholder: "Member name or number" }, { name: "successionReason", label: "Reason", options: "successionReasons" }, { type: "dateRange" }],
  columns: [
    { key: "successionDate", label: "Date", type: "date" },
    { key: "predecessor", label: "Previous member", render: (r) => (r.predecessor ? memberLine(r.predecessor) : "") },
    { key: "successor", label: "Took their place", render: memberLine },
    { key: "relationship", label: "Relationship" },
    { key: "reason", label: "Reason", render: successionReason },
    { key: "shares", label: "Shares", type: "number" },
  ],
};

const HRPage = () => (
  <ModulePage
    sections={{
      staff: () => <ResourcePage config={staff} />,
      establishment: () => <ResourcePage config={adverts} />,
      contracts: () => <ResourcePage config={contracts} />,
      reviews: () => <ResourcePage config={salaryReviews} />,
      payroll: () => <ResourcePage config={payroll} />,
      discipline: () => <ResourcePage config={disciplinary} header={() => <DisciplinarySummary />} />,
      terminations: () => <ResourcePage config={terminations} />,
      members: () => <ResourcePage config={members} />,
      succession: () => <ResourcePage config={successions} />,
    }}
  />
);

export default HRPage;
