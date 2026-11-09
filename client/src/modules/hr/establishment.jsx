import { CalendarClock, ClipboardCheck, ListChecks, UserCheck, UserX } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/ui";
import { fullName, date, inputDate, today } from "../../lib/format";
import { employeeFields, registrationDefaults, staffPath } from "./staff";

// Staff establishment: how a post gets filled - job advert, applications,
// shortlist, interview, hire. Each advert opens its own page of applicants.

// ?tab keeps the sidebar and breadcrumb on Staff establishment.
export const advertPath = (id) => `/hr/establishment/${id}?tab=establishment`;

const count = (row, stage) => row.applicants.filter((a) => a.stage === stage).length;

const advertFields = (ctx, row) => [
  { name: "jobTitle", label: "Job title", required: true },
  { name: "department", label: "Department", type: "select", options: "departments", required: true },
  { name: "jobGroup", label: "Job group", placeholder: "e.g. Group 4" },
  { name: "employmentType", label: "Employment type", type: "select", options: "employmentTypes", required: true },
  { name: "posts", label: "Number of posts", type: "number", step: 1, min: 1, required: true },
  { name: "advertDate", label: "Advert date", type: "date", required: true },
  { name: "closingDate", label: "Closing date", type: "date" },
  ...(row ? [{ name: "status", label: "Status", type: "select", options: "advertStatus", required: true, optionFilter: (o) => o.value !== "filled" || row.status === "filled" }] : []),
  { name: "requirements", label: "Requirements", type: "textarea" },
];

export const adverts = {
  resource: "jobAdverts",
  endpoint: "/hr/job-adverts",
  title: "Job adverts",
  description: "How a post is filled: job advert, applications, shortlist, interview, then hire. Click an advert to work through its applicants.",
  singular: "Job advert",
  createLabel: "New job advert",
  filters: [{ type: "search", placeholder: "Advert no., job title" }, { name: "status", label: "Status", options: "advertStatus" }, { name: "department", label: "Department", options: "departments" }],
  rowTo: (row) => advertPath(row.id),
  columns: [
    { key: "advertNumber", label: "Advert" },
    { key: "jobTitle", label: "Job title", render: (row) => <Link to={advertPath(row.id)} className="font-medium text-primary-700 hover:underline">{row.jobTitle}</Link> },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "jobGroup", label: "Job group" },
    { key: "posts", label: "Posts", type: "number" },
    { key: "advertDate", label: "Advertised", type: "date" },
    { key: "closingDate", label: "Closes", type: "date" },
    { key: "applied", label: "Applicants", align: "right", render: (row) => row.applicants.length },
    { key: "hired", label: "Hired", align: "right", render: (row) => count(row, "hired") },
    { key: "status", label: "Status", type: "status:advertStatus" },
  ],
  createFields: advertFields,
  editFields: advertFields,
  createInitial: () => ({ advertDate: today(), employmentType: "permanent", posts: 1 }),
  toForm: (row) => ({ ...row, advertDate: inputDate(row.advertDate), closingDate: inputDate(row.closingDate) }),
  deletableWhen: (row) => row.applicants.length === 0,
};

const applicantFields = [
  { name: "firstName", label: "First name", required: true },
  { name: "lastName", label: "Last name", required: true },
  { name: "nationalId", label: "National ID" },
  { name: "phone", label: "Phone", type: "tel", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "appliedOn", label: "Date applied", type: "date", required: true },
  { name: "qualifications", label: "Qualifications and experience", type: "textarea" },
];

const scheduleFields = [
  { name: "interviewDate", label: "Interview date", type: "date", required: true },
  { name: "interviewPanel", label: "Interview panel", placeholder: "e.g. Head of HR, Head of MVA" },
];

const canAct = (ctx) => ctx.can("jobApplicants", "write");
const NOWRAP = "whitespace-nowrap";
const CONTRACT_FOR = { permanent: "permanent", contract: "fixed_term", casual: "casual", intern: "fixed_term" };

/** The applicants of one advert, with the next step on each row. */
export const applicantsFor = (advert) => ({
  resource: "jobApplicants",
  endpoint: "/hr/job-applicants",
  params: { advertId: advert.id },
  title: "Applicants",
  description: "Work through each applicant in order: shortlist, interview, record the result, then hire.",
  singular: "Applicant",
  createLabel: "Add applicant",
  canCreate: (ctx) => canAct(ctx) && advert.status === "open",
  filters: [{ type: "search", placeholder: "Name, ID, phone" }, { name: "stage", label: "Stage", options: "applicantStages" }],
  columns: [
    { key: "name", label: "Applicant", render: fullName, className: NOWRAP },
    { key: "phone", label: "Phone" },
    { key: "interviewDate", label: "Interview", type: "date", className: NOWRAP },
    { key: "interviewScore", label: "Score", align: "right", render: (row) => (row.interviewScore == null ? "" : `${row.interviewScore}/100`) },
    {
      key: "stage", label: "Stage", className: NOWRAP,
      render: (row, ctx) => (
        <span className="inline-flex items-center gap-2">
          <Badge value={row.stage}>{ctx.label("applicantStages", row.stage)}</Badge>
          {row.employee && <Link to={staffPath(row.employee.id)} className="font-medium text-primary-700 hover:underline">{row.employee.staffNumber}</Link>}
        </span>
      ),
    },
  ],
  createFields: applicantFields,
  editFields: applicantFields,
  createInitial: () => ({ appliedOn: today() }),
  toForm: (row) => ({ ...row, appliedOn: inputDate(row.appliedOn) }),
  toPayload: (values, mode) => (mode === "create" ? { ...values, advertId: advert.id } : values),
  editableWhen: (row) => row.stage !== "hired",
  deletableWhen: (row) => row.stage !== "hired",
  actions: [
    {
      key: "shortlist", label: "Shortlist", icon: ListChecks, allowed: canAct, when: (row) => row.stage === "applied",
      path: (row) => `/hr/job-applicants/${row.id}/shortlist`,
      confirm: (row) => `Shortlist ${fullName(row)} for interview?`, submitLabel: "Shortlist",
      success: (row) => `${fullName(row)} shortlisted`,
    },
    {
      key: "schedule", label: "Schedule interview", icon: CalendarClock, allowed: canAct, when: (row) => row.stage === "shortlisted",
      path: (row) => `/hr/job-applicants/${row.id}/schedule-interview`,
      title: (row) => `Interview for ${fullName(row)}`,
      fields: scheduleFields, initial: () => ({ interviewDate: today() }), submitLabel: "Schedule",
      success: (row) => `Interview scheduled for ${date(row.interviewDate)}`,
    },
    {
      key: "result", label: "Record result", icon: ClipboardCheck, allowed: canAct, when: (row) => row.stage === "interview",
      path: (row) => `/hr/job-applicants/${row.id}/interview-result`,
      title: (row) => `Interview result for ${fullName(row)}`,
      fields: [
        { name: "result", label: "Result", type: "select", options: "interviewResults", required: true },
        { name: "interviewScore", label: "Score out of 100", type: "number", max: 100 },
        { name: "interviewNotes", label: "Panel's remarks", type: "textarea" },
      ],
      submitLabel: "Save result",
      success: () => "Interview result saved",
    },
    {
      key: "reschedule", label: "Reschedule", icon: CalendarClock, allowed: canAct, when: (row) => row.stage === "interview",
      path: (row) => `/hr/job-applicants/${row.id}/schedule-interview`,
      title: (row) => `Reschedule interview for ${fullName(row)}`,
      fields: scheduleFields, initial: (row) => ({ interviewDate: inputDate(row.interviewDate), interviewPanel: row.interviewPanel }), submitLabel: "Reschedule",
      success: (row) => `Interview moved to ${date(row.interviewDate)}`,
    },
    {
      key: "hire", label: "Hire", icon: UserCheck, variant: "primary", allowed: (ctx) => canAct(ctx) && ctx.can("employees", "write"), when: (row) => row.stage === "passed",
      path: (row) => `/hr/job-applicants/${row.id}/hire`,
      title: (row) => `Hire ${fullName(row)}`,
      intro: () => <p className="text-sm text-slate-600">Hiring registers this person as a staff member. Add their pay, contract and next of kin below.</p>,
      size: "lg",
      fields: (row, ctx) => employeeFields(ctx),
      initial: (row) => ({
        ...registrationDefaults(),
        firstName: row.firstName,
        lastName: row.lastName,
        nationalId: row.nationalId,
        phone: row.phone,
        email: row.email,
        department: row.advert.department,
        jobTitle: row.advert.jobTitle,
        jobGroup: row.advert.jobGroup,
        employmentType: row.advert.employmentType,
        contractType: CONTRACT_FOR[row.advert.employmentType] || "permanent",
      }),
      submitLabel: "Hire and register",
      success: (employee) => `${fullName(employee)} hired as ${employee.staffNumber}`,
    },
    {
      key: "reject", label: "", ariaLabel: () => "Mark as not successful", icon: UserX, allowed: canAct, when: (row) => ["applied", "shortlisted", "interview", "passed"].includes(row.stage),
      path: (row) => `/hr/job-applicants/${row.id}/reject`,
      title: (row) => `Mark ${fullName(row)} as not successful`,
      fields: [{ name: "rejectionReason", label: "Reason", type: "textarea", required: true }],
      submitLabel: "Save", tone: "danger",
      success: () => "Applicant marked as not successful",
    },
  ],
  expand: (row) => (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {[["Date applied", date(row.appliedOn)], ["National ID", row.nationalId], ["Email", row.email], ["Qualifications and experience", row.qualifications], ["Interview panel", row.interviewPanel], ["Panel's remarks", row.interviewNotes], ["Reason not successful", row.rejectionReason]].map(([name, value]) => (
        <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="whitespace-pre-line text-slate-800">{value || "-"}</dd></div>
      ))}
    </dl>
  ),
});
