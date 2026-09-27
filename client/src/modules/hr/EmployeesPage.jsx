import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Users,
} from "lucide-react";

import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../../services/employee.service.js";

const initialForm = {
  employeeNumber: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  department: "",
  position: "",
  employmentType: "permanent",
  dateJoined: "",
  salary: "",
  status: "active",
};

const employmentTypes = [
  "permanent",
  "contract",
  "casual",
  "intern",
];

const employeeStatuses = [
  "active",
  "inactive",
  "terminated",
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
};

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusClass = (status) => {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";

    case "inactive":
      return "bg-slate-100 text-slate-600";

    case "terminated":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
};

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState("");

  // ================================
  // LOAD EMPLOYEES
  // ================================

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getEmployees();

      setEmployees(response.data || []);
    } catch (err) {
      console.error("Failed to load employees:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load employees."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // ================================
  // SEARCH
  // ================================

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return employees;
    }

    return employees.filter((employee) => {
      const fullName =
        `${employee.firstName || ""} ${
          employee.lastName || ""
        }`.toLowerCase();

      return (
        fullName.includes(keyword) ||
        employee.employeeNumber
          ?.toLowerCase()
          .includes(keyword) ||
        employee.phone
          ?.toLowerCase()
          .includes(keyword) ||
        employee.email
          ?.toLowerCase()
          .includes(keyword) ||
        employee.department
          ?.toLowerCase()
          .includes(keyword) ||
        employee.position
          ?.toLowerCase()
          .includes(keyword) ||
        employee.employmentType
          ?.toLowerCase()
          .includes(keyword) ||
        employee.status
          ?.toLowerCase()
          .includes(keyword)
      );
    });
  }, [employees, search]);

  // ================================
  // SUMMARY
  // ================================

  const activeEmployees = employees.filter(
    (employee) => employee.status === "active"
  ).length;

  const inactiveEmployees = employees.filter(
    (employee) => employee.status === "inactive"
  ).length;

  const terminatedEmployees = employees.filter(
    (employee) => employee.status === "terminated"
  ).length;

  const totalPayroll = employees
    .filter((employee) => employee.status === "active")
    .reduce(
      (total, employee) =>
        total + Number(employee.salary || 0),
      0
    );

  // ================================
  // FORM
  // ================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    setForm({ ...initialForm });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);

    setForm({
      employeeNumber: employee.employeeNumber || "",
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      phone: employee.phone || "",
      email: employee.email || "",
      department: employee.department || "",
      position: employee.position || "",
      employmentType:
        employee.employmentType || "permanent",
      dateJoined: employee.dateJoined
        ? new Date(employee.dateJoined)
            .toISOString()
            .split("T")[0]
        : "",
      salary: employee.salary ?? "",
      status: employee.status || "active",
    });

    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingEmployee(null);
    setForm({ ...initialForm });
    setError("");
  };

  // ================================
  // CREATE / UPDATE
  // ================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.employeeNumber.trim() ||
      !form.firstName.trim() ||
      !form.lastName.trim()
    ) {
      setError(
        "Employee number, first name and last name are required."
      );
      return;
    }

    if (
      form.salary !== "" &&
      Number(form.salary) < 0
    ) {
      setError("Salary cannot be negative.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        employeeNumber:
          form.employeeNumber.trim(),

        firstName: form.firstName.trim(),

        lastName: form.lastName.trim(),

        phone: form.phone.trim(),

        email: form.email.trim(),

        department: form.department.trim(),

        position: form.position.trim(),

        employmentType:
          form.employmentType,

        dateJoined:
          form.dateJoined || undefined,

        salary:
          form.salary === ""
            ? 0
            : Number(form.salary),

        status: form.status,
      };

      if (editingEmployee) {
        await updateEmployee(
          editingEmployee._id,
          payload
        );
      } else {
        await createEmployee(payload);
      }

      await loadEmployees();

      closeModal();
    } catch (err) {
      console.error("Failed to save employee:", err);

      setError(
        err.response?.data?.message ||
          "Failed to save employee."
      );
    } finally {
      setSaving(false);
    }
  };

  // ================================
  // DELETE
  // ================================

  const handleDelete = async (employee) => {
    const confirmed = window.confirm(
      `Delete ${employee.firstName} ${employee.lastName}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteEmployee(employee._id);

      setEmployees((previous) =>
        previous.filter(
          (item) => item._id !== employee._id
        )
      );
    } catch (err) {
      console.error("Failed to delete employee:", err);

      setError(
        err.response?.data?.message ||
          "Failed to delete employee."
      );
    }
  };

  // ================================
  // UI
  // ================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Employees
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage employee records and employment
            information.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadEmployees}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus size={18} />
            Add Employee
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && !showModal && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Employees
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {employees.length}
              </p>
            </div>

            <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
              <Users size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Active Employees
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {activeEmployees}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Inactive / Terminated
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
            {inactiveEmployees +
              terminatedEmployees}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Active Salary Base
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(totalPayroll)}
          </p>
        </div>
      </div>

      {/* SEARCH */}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search employees..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Department
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Position
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employment
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Salary
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Joined
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading employees...
                  </td>
                </tr>
              ) : filteredEmployees.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(
                  (employee) => (
                    <tr
                      key={employee._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {employee.firstName}{" "}
                          {employee.lastName}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {employee.employeeNumber}
                        </div>

                        {employee.email && (
                          <div className="text-xs text-slate-400">
                            {employee.email}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {employee.department ||
                          "-"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {employee.position || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="capitalize text-sm text-slate-600">
                          {employee.employmentType ||
                            "-"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          employee.salary
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          employee.dateJoined
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                            employee.status
                          )}`}
                        >
                          {employee.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                employee
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                            title="Edit employee"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                employee
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete employee"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingEmployee
                    ? "Edit Employee"
                    : "Add Employee"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Enter employee information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee Number *
                  </label>

                  <input
                    type="text"
                    name="employeeNumber"
                    value={
                      form.employeeNumber
                    }
                    onChange={handleChange}
                    placeholder="EMP-001"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+254..."
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First Name *
                  </label>

                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last Name *
                  </label>

                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>

                  <input
                    type="text"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="e.g. Finance"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Position
                  </label>

                  <input
                    type="text"
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    placeholder="e.g. Accountant"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employment Type
                  </label>

                  <select
                    name="employmentType"
                    value={
                      form.employmentType
                    }
                    onChange={handleChange}
                    className="form-input"
                  >
                    {employmentTypes.map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type
                            .charAt(0)
                            .toUpperCase() +
                            type.slice(1)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date Joined
                  </label>

                  <input
                    type="date"
                    name="dateJoined"
                    value={form.dateJoined}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Salary (KES)
                  </label>

                  <input
                    type="number"
                    name="salary"
                    value={form.salary}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="form-input"
                  >
                    {employeeStatuses.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status
                            .charAt(0)
                            .toUpperCase() +
                            status.slice(1)}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingEmployee
                    ? "Update Employee"
                    : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;