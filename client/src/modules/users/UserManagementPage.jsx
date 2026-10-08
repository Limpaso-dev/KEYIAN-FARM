import { useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../../context/useAuth";
import {
  createUser,
  getUsers,
  updateUser,
} from "../../services/user.service";

const hmisRoles = [
  ["receptionist", "Receptionist"],
  ["nurse", "Nurse / Triage"],
  ["doctor", "Doctor / Clinician"],
  ["laboratory", "Laboratory Technician"],
  ["pharmacist", "Pharmacist"],
  ["cashier", "Cashier"],
];

const otherRoles = [
  ["manager", "Manager"],
  ["finance", "Finance"],
  ["hr", "HR"],
  ["procurement", "Procurement"],
  ["stores", "Stores / Receiving"],
  ["livestock", "Livestock"],
  ["dairy", "Dairy"],
  ["sales", "Sales"],
  ["farm_officer", "Farm Officer"],
  ["staff", "Staff"],
];

const roleDepartment = {
  receptionist: "reception",
  nurse: "nursing",
  doctor: "medical",
  laboratory: "laboratory",
  pharmacist: "pharmacy",
  cashier: "finance",
};

const roleAccessDescriptions = {
  receptionist: "Registration, patient demographics, and visit tracking. No diagnosis or clinical-note access.",
  nurse: "Patient history, triage, vitals, nursing notes, and visit tracking. No prescribing or finance access.",
  doctor: "Full clinical workflow: diagnosis, treatment plan, lab orders, prescriptions, and clinical history.",
  laboratory: "Lab worklist, limited patient identifiers, doctor diagnosis, requested tests, and lab results.",
  pharmacist: "Medication-relevant patient history, prescriptions, and dispense status. No billing or lab-result access.",
  cashier: "HMIS bills, approved payment collection, and deposit-account selection. No general finance access.",
};

const departments = [
  ["reception", "Reception"],
  ["nursing", "Nursing"],
  ["medical", "Medical / Clinical"],
  ["laboratory", "Laboratory"],
  ["pharmacy", "Pharmacy"],
  ["radiology", "Radiology"],
  ["finance", "Finance"],
  ["procurement", "Procurement"],
  ["stores", "Stores"],
  ["human_resources", "Human Resources"],
  ["agriculture", "Agriculture"],
  ["dairy", "Dairy"],
  ["livestock", "Livestock"],
  ["sales", "Sales"],
  ["administration", "Administration"],
  ["general", "General"],
];

const initialForm = {
  name: "",
  email: "",
  phone: "",
  department: "",
  role: "staff",
  password: "",
  isActive: true,
};

const UserManagementPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getUsers();
      setUsers(response.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load user accounts."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;

    getUsers()
      .then((response) => {
        if (current) setUsers(response.data || []);
      })
      .catch((requestError) => {
        if (current) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load user accounts."
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, []);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm(initialForm);
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const openEditForm = (account) => {
    setEditingUser(account);
    setForm({
      name: account.name || "",
      email: account.email || "",
      phone: account.phone || "",
      department: roleDepartment[account.role] || account.department || "",
      role: account.role || "staff",
      password: "",
      isActive: account.isActive !== false,
    });
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingUser(null);
    setForm(initialForm);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      ...(name === "role" && roleDepartment[value]
        ? { department: roleDepartment[value] }
        : {}),
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password && form.password.length < 12) {
      setError("A new password must be at least 12 characters.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      department: form.department.trim(),
      role: form.role,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;

    try {
      setSaving(true);
      let response;
      if (editingUser) {
        response = await updateUser(editingUser._id, payload);
      } else {
        response = await createUser(payload);
      }
      await loadUsers();
      setNotice(response.message || "Account saved.");
      setShowForm(false);
      setEditingUser(null);
      setForm(initialForm);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save this user account."
      );
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = currentUser?.role === "super_admin";
  const normalizedSearch = search.trim().toLowerCase();
  const visibleUsers = users.filter((account) => {
    const matchesSearch = [
      account.name,
      account.email,
      account.department,
      account.role,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? account.isActive : !account.isActive);
    return matchesSearch && matchesStatus;
  });
  const activeCount = users.filter((account) => account.isActive).length;
  const inactiveCount = users.filter((account) => !account.isActive).length;
  const canChangeOwnAccess = (account) =>
    account._id !== currentUser?._id;
  const canEditAccount = (account) =>
    canChangeOwnAccess(account) && (
      currentUser?.role === "super_admin" ||
      !["admin", "super_admin"].includes(account.role)
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
            <UserCog size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <p className="text-sm text-slate-500">Manage ERP accounts, roles, and access status.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={18} /> Create Account
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Summary icon={Users} label="Accounts" value={users.length} />
        <Summary icon={Check} label="Active" value={activeCount} />
        <Summary icon={ShieldCheck} label="Inactive" value={inactiveCount} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search accounts"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter accounts by status"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading accounts...</p>
        ) : visibleUsers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No matching accounts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((account) => (
                  <tr key={account._id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{account.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{account.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">
                      {account.role.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{account.department || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${account.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          title={canEditAccount(account) ? "Edit account" : "Only a super admin can manage this account"}
                          disabled={!canEditAccount(account)}
                          onClick={() => openEditForm(account)}
                          className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-form-title"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 id="account-form-title" className="text-lg font-semibold text-slate-900">
                  {editingUser ? "Edit Account" : "Create Account"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingUser ? "Leave password blank to keep it unchanged." : "Set an initial password. Email verification is not required."}
                </p>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close form" className="rounded p-2 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Full name" name="name" value={form.name} onChange={handleChange} required autoComplete="name" />
              <Field label="Email address" name="email" value={form.email} onChange={handleChange} type="email" required autoComplete="email" />
              <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} type="tel" autoComplete="tel" />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Department
                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  disabled={Boolean(roleDepartment[form.role])}
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">Select department</option>
                  {departments.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Role
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  disabled={editingUser && !canChangeOwnAccess(editingUser)}
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100"
                >
                  {isSuperAdmin && <>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Administrator</option>
                  </>}
                  <optgroup label="HMIS">
                    {hmisRoles.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="ERP">
                    {otherRoles.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                </select>
                {roleAccessDescriptions[form.role] && (
                  <span className="text-xs font-normal leading-5 text-slate-500">
                    {roleAccessDescriptions[form.role]}
                  </span>
                )}
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                {editingUser ? "Reset password" : "Initial password"}
                <span className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    type="password"
                    required={!editingUser}
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                  disabled={editingUser && !canChangeOwnAccess(editingUser)}
                  className="h-4 w-4 accent-primary-600 disabled:opacity-50"
                />
                Account active
                {editingUser && !canChangeOwnAccess(editingUser) && (
                  <span className="ml-auto text-xs font-normal text-slate-500">You cannot deactivate your own account</span>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                {saving ? "Saving..." : editingUser ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Summary = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600"><Icon size={19} /></div>
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  </div>
);

const Field = ({ label, ...props }) => (
  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
    {label}
    <input {...props} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
  </label>
);

export default UserManagementPage;
