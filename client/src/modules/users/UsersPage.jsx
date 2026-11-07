import { KeyRound, Users } from "lucide-react";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Alert, PageHeader } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { dateTime, fullName } from "../../lib/format";

const DEPARTMENT_ROLES = ["head", "officer"];

const PasswordNotice = ({ name, password, emailed }) => (
  <div>
    <p>Temporary password for <strong>{name}</strong>: <code className="rounded bg-white px-2 py-0.5 font-mono text-base tracking-wide text-slate-900 ring-1 ring-emerald-200">{password}</code></p>
    <p className="mt-1 text-xs">{emailed ? "It has also been emailed to them. " : ""}Give it to the user privately. They must choose their own password when they first sign in. It is not shown again.</p>
  </div>
);

const accountFields = (ctx, row) => [
  { name: "name", label: "Full name", required: true },
  { name: "email", label: "Email (used to sign in)", type: "email", required: true },
  { name: "phone", label: "Phone", type: "tel" },
  {
    name: "role", label: "Role", type: "select", options: "roles", required: true,
    // Only a super admin can create admins.
    optionFilter: (o) => ctx.user.role === "super_admin" || !["super_admin", "admin"].includes(o.value),
    help: "Head of Department and Officer belong to one department. General Manager sees every department.",
    onSelect: (_, values) => (DEPARTMENT_ROLES.includes(values.role) ? {} : { department: "" }),
  },
  { name: "department", label: "Department", type: "select", options: "departments", required: true, showIf: (v) => DEPARTMENT_ROLES.includes(v.role) },
  {
    name: "employeeId", label: "Link to HR staff record", type: "select", placeholder: "Not linked",
    ref: { path: "/hr/staff-options", label: (e) => `${e.staffNumber} - ${fullName(e)} (${e.department})` },
    help: "Linking means the login is switched off automatically when HR records a termination.",
  },
  ...(row ? [{ name: "isActive", label: "Status", type: "checkbox", checkboxLabel: "Account is active (can sign in)" }] : []),
];

const config = {
  endpoint: "/auth/users",
  title: "User accounts",
  singular: "User",
  createLabel: "Create account",
  canCreate: (c) => c.permissions?.manageUsers,
  canEdit: (c) => c.permissions?.manageUsers,
  canDelete: () => false,
  editableWhen: (row, c) => c.user.role === "super_admin" || !["super_admin", "admin"].includes(row.role),
  createFields: accountFields,
  editFields: accountFields,
  toForm: (row) => ({ ...row, department: row.department || "", employeeId: row.employeeId || "" }),
  toPayload: (v) => ({
    name: v.name,
    email: v.email,
    phone: v.phone,
    role: v.role,
    department: DEPARTMENT_ROLES.includes(v.role) ? v.department : null,
    employeeId: v.employeeId || null,
    ...(v.isActive === undefined ? {} : { isActive: Boolean(v.isActive) }),
  }),
  created: (r) => <PasswordNotice name={r.user.name} password={r.temporaryPassword} emailed={r.emailed} />,
  filters: [],
  columns: [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role", type: "option:roles" },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "employee", label: "Staff record", render: (r) => (r.employee ? `${r.employee.staffNumber} - ${fullName(r.employee)}` : "") },
    { key: "lastLoginAt", label: "Last sign-in", render: (r) => (r.lastLoginAt ? dateTime(r.lastLoginAt) : r.mustChangePassword ? "Not yet signed in" : "") },
    { key: "isActive", label: "Status", render: (r) => (r.isActive ? "Active" : <span className="text-rose-700">Inactive</span>) },
  ],
  actions: [{
    key: "reset", label: "Reset password", icon: KeyRound,
    when: (row, c) => row.id !== c.user.id && (c.user.role === "super_admin" || !["super_admin", "admin"].includes(row.role)),
    path: (r) => `/auth/users/${r.id}/reset-password`,
    confirm: (r) => `Give ${r.name} a new temporary password? Their current password will stop working.`,
    submitLabel: "Reset password",
    success: (data, row) => <PasswordNotice name={row.name} password={data.temporaryPassword} />,
  }],
};

const UsersPage = () => {
  const { permissions } = useAuth();
  if (!permissions?.manageUsers) return <Alert tone="error">Only system administrators can manage user accounts.</Alert>;
  return (
    <div>
      <PageHeader icon={Users} eyebrow="Administration" title="User accounts" description="Create a login for each person, choose their department and whether they are the Head or an Officer. New users get a temporary password." />
      <ResourcePage config={config} />
    </div>
  );
};

export default UsersPage;
