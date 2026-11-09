import { Link } from "react-router-dom";
import { fullName, today } from "../../lib/format";

export const staffPath = (id) => `/hr/staff/${id}`;

// The contract type that usually goes with an employment type.
const CONTRACT_FOR = { permanent: "permanent", contract: "fixed_term", casual: "casual", intern: "fixed_term" };

/** The contract questions: at registration, on renewal and when correcting one. */
export const contractInputs = (start, end, terms) => [
  { name: "contractType", label: "Contract type", type: "select", options: "contractTypes", required: true, onSelect: (_, v) => (v.contractType === "permanent" ? { [end]: "" } : {}) },
  { name: start, label: "Start date", type: "date", required: true },
  { name: end, label: "End date", type: "date", showIf: (v) => v.contractType !== "permanent", help: "Needed for a fixed-term contract" },
  { name: terms, label: "Terms", type: "textarea" },
];

/** Registering a staff member (no row) or editing one (row). */
export const employeeFields = (ctx, row) => {
  const registering = !row;
  return [
    { type: "section", label: "Personal details" },
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    { name: "nationalId", label: "National ID" },
    { name: "gender", label: "Gender", type: "select", options: "gender" },
    { name: "dateOfBirth", label: "Date of birth", type: "date" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Address" },

    { type: "section", label: "Employment" },
    { name: "staffNumber", label: "Staff number", help: registering ? "Leave blank to number automatically (EMP-0001)" : undefined },
    { name: "department", label: "Department", type: "select", options: "departments", required: true },
    ...(registering ? [{ name: "jobTitle", label: "Job title", required: true }] : []),
    { name: "jobGroup", label: "Job group", required: registering, placeholder: "e.g. Group 4" },
    { name: "employmentType", label: "Employment type", type: "select", options: "employmentTypes", required: true, onSelect: (_, v) => (registering ? { contractType: CONTRACT_FOR[v.employmentType] || "" } : {}) },
    { name: "dateHired", label: "Date hired", type: "date", required: true, onSelect: (_, v) => (registering ? { contractStart: v.dateHired } : {}) },
    ...(registering
      ? [{ name: "basicSalary", label: "Basic salary (KES)", type: "number", required: true }]
      : [{ name: "status", label: "Status", type: "select", options: "employeeStatus", help: "Use Terminations to record a staff member leaving" }]),

    ...(registering ? [{ type: "section", label: "Contract", help: "Added to the Contracts list when you save. The salary is the basic salary above." }, ...contractInputs("contractStart", "contractEnd", "contractTerms")] : []),

    { type: "section", label: "Next of kin and dependants" },
    { name: "nextOfKinName", label: "Next of kin's name", required: registering },
    { name: "nextOfKinNationalId", label: "Next of kin's National ID number", required: registering },
    { name: "nextOfKinPhone", label: "Next of kin's phone number", type: "tel", required: registering },
    { name: "dependants", label: "Number of dependants", type: "number", step: 1, required: registering },

    { type: "section", label: "Pay and other details" },
    { name: "bankName", label: "Bank" },
    { name: "bankAccount", label: "Bank account" },
    { name: "kraPin", label: "KRA PIN" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
};

export const registrationDefaults = () => ({ employmentType: "permanent", dateHired: today(), contractType: "permanent", contractStart: today(), dependants: 0 });

export const staff = {
  resource: "employees",
  endpoint: "/hr/employees",
  title: "Staff register",
  description: "Click a staff member to open their profile.",
  singular: "Staff member",
  createLabel: "Add staff",
  formSize: "lg",
  filters: [{ type: "search", placeholder: "Name, staff no., ID, phone" }, { name: "department", label: "Department", options: "departments" }, { name: "status", label: "Status", options: "employeeStatus" }],
  rowTo: (row) => staffPath(row.id),
  columns: [
    { key: "staffNumber", label: "Staff no." },
    { key: "name", label: "Name", render: (row) => <Link to={staffPath(row.id)} className="font-medium text-primary-700 hover:underline">{fullName(row)}</Link> },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "jobTitle", label: "Job title" },
    { key: "jobGroup", label: "Job group" },
    { key: "employmentType", label: "Type", type: "option:employmentTypes" },
    { key: "dateHired", label: "Hired", type: "date" },
    { key: "basicSalary", label: "Salary", type: "money" },
    { key: "status", label: "Status", type: "status:employeeStatus" },
  ],
  createFields: (ctx) => employeeFields(ctx),
  createInitial: registrationDefaults,
  created: (row) => `${fullName(row)} registered as ${row.staffNumber}, with their contract`,
  // Editing and removing happen on the profile; the list ends with the status.
  editFields: false,
  deletable: false,
};
