import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Wallet,
} from "lucide-react";

import {
  getPayroll,
  createPayroll,
  updatePayroll,
  deletePayroll,
} from "../../services/payroll.service.js";

import { getEmployees } from "../../services/employee.service.js";

const initialForm = {
  employee: "",
  period: "",
  basicSalary: "",
  allowances: "",
  deductions: "",
  status: "draft",
};

const payrollStatuses = [
  "draft",
  "approved",
  "paid",
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
};

const getStatusClass = (status) => {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700";

    case "approved":
      return "bg-blue-50 text-blue-700";

    case "draft":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
};

const PayrollPage = () => {
  const [payroll, setPayroll] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPayroll, setEditingPayroll] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState("");

  // ================================
  // LOAD DATA
  // ================================

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        payrollResponse,
        employeeResponse,
      ] = await Promise.all([
        getPayroll(),
        getEmployees(),
      ]);

      setPayroll(payrollResponse.data || []);
      setEmployees(employeeResponse.data || []);
    } catch (err) {
      console.error(
        "Failed to load payroll:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to load payroll records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ================================
  // SEARCH
  // ================================

  const filteredPayroll = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return payroll;
    }

    return payroll.filter((record) => {
      const employeeName =
        `${record.employee?.firstName || ""} ${
          record.employee?.lastName || ""
        }`.toLowerCase();

      const employeeNumber =
        record.employee?.employeeNumber || "";

      return (
        employeeName.includes(keyword) ||
        employeeNumber
          .toLowerCase()
          .includes(keyword) ||
        record.period
          ?.toLowerCase()
          .includes(keyword) ||
        record.status
          ?.toLowerCase()
          .includes(keyword)
      );
    });
  }, [payroll, search]);

  // ================================
  // SUMMARY
  // ================================

  const totalGross = payroll.reduce(
    (total, record) =>
      total + Number(record.grossSalary || 0),
    0
  );

  const totalDeductions = payroll.reduce(
    (total, record) =>
      total + Number(record.deductions || 0),
    0
  );

  const totalNet = payroll.reduce(
    (total, record) =>
      total + Number(record.netSalary || 0),
    0
  );

  const paidRecords = payroll.filter(
    (record) => record.status === "paid"
  ).length;

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
    setEditingPayroll(null);
    setForm({ ...initialForm });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingPayroll(record);

    setForm({
      employee:
        record.employee?._id ||
        record.employee ||
        "",

      period: record.period || "",

      basicSalary:
        record.basicSalary ?? "",

      allowances:
        record.allowances ?? "",

      deductions:
        record.deductions ?? "",

      status: record.status || "draft",
    });

    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingPayroll(null);
    setForm({ ...initialForm });
    setError("");
  };

  // ================================
  // CALCULATIONS
  // ================================

  const calculatedGross =
    Number(form.basicSalary || 0) +
    Number(form.allowances || 0);

  const calculatedNet =
    calculatedGross -
    Number(form.deductions || 0);

  // ================================
  // CREATE / UPDATE
  // ================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.employee || !form.period.trim()) {
      setError(
        "Employee and payroll period are required."
      );
      return;
    }

    if (Number(form.basicSalary || 0) < 0) {
      setError(
        "Basic salary cannot be negative."
      );
      return;
    }

    if (Number(form.allowances || 0) < 0) {
      setError(
        "Allowances cannot be negative."
      );
      return;
    }

    if (Number(form.deductions || 0) < 0) {
      setError(
        "Deductions cannot be negative."
      );
      return;
    }

    if (calculatedNet < 0) {
      setError(
        "Deductions cannot be greater than gross salary."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        employee: form.employee,

        period: form.period.trim(),

        basicSalary: Number(
          form.basicSalary || 0
        ),

        allowances: Number(
          form.allowances || 0
        ),

        deductions: Number(
          form.deductions || 0
        ),

        status: form.status,
      };

      if (editingPayroll) {
        await updatePayroll(
          editingPayroll._id,
          payload
        );
      } else {
        await createPayroll(payload);
      }

      await loadData();

      closeModal();
    } catch (err) {
      console.error(
        "Failed to save payroll:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to save payroll record."
      );
    } finally {
      setSaving(false);
    }
  };

  // ================================
  // DELETE
  // ================================

  const handleDelete = async (record) => {
    const employeeName =
      `${record.employee?.firstName || ""} ${
        record.employee?.lastName || ""
      }`.trim();

    const confirmed = window.confirm(
      `Delete payroll record for ${
        employeeName || "this employee"
      } for ${record.period}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deletePayroll(record._id);

      setPayroll((previous) =>
        previous.filter(
          (item) => item._id !== record._id
        )
      );
    } catch (err) {
      console.error(
        "Failed to delete payroll:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to delete payroll record."
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
            Payroll
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage employee payroll records and
            salary payments.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
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
            Create Payroll
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
                Total Gross
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {formatCurrency(totalGross)}
              </p>
            </div>

            <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
              <Wallet size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Deductions
          </p>

          <p className="mt-2 text-xl font-bold text-red-600">
            {formatCurrency(totalDeductions)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Net Payroll
          </p>

          <p className="mt-2 text-xl font-bold text-emerald-600">
            {formatCurrency(totalNet)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Paid Records
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {paidRecords}
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
            placeholder="Search payroll records..."
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
                  Period
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Basic
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Allowances
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Deductions
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Net
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
                    Loading payroll records...
                  </td>
                </tr>
              ) : filteredPayroll.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No payroll records found.
                  </td>
                </tr>
              ) : (
                filteredPayroll.map(
                  (record) => (
                    <tr
                      key={record._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {record.employee
                            ?.firstName}{" "}
                          {record.employee?.lastName}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {
                            record.employee
                              ?.employeeNumber
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {record.period}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatCurrency(
                          record.basicSalary
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatCurrency(
                          record.allowances
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-red-600">
                        {formatCurrency(
                          record.deductions
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                        {formatCurrency(
                          record.netSalary
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                record
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                            title="Edit payroll"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                record
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete payroll"
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingPayroll
                    ? "Edit Payroll"
                    : "Create Payroll"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Enter salary information for the
                  payroll period.
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
                {/* EMPLOYEE */}

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee *
                  </label>

                  <select
                    name="employee"
                    value={form.employee}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    <option value="">
                      Select employee
                    </option>

                    {employees
                      .filter(
                        (employee) =>
                          employee.status ===
                          "active"
                      )
                      .map((employee) => (
                        <option
                          key={employee._id}
                          value={employee._id}
                        >
                          {employee.employeeNumber}{" "}
                          —{" "}
                          {employee.firstName}{" "}
                          {employee.lastName}
                        </option>
                      ))}
                  </select>

                  {employees.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Create an employee before
                      creating payroll.
                    </p>
                  )}
                </div>

                {/* PERIOD */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Payroll Period *
                  </label>

                  <input
                    type="text"
                    name="period"
                    value={form.period}
                    onChange={handleChange}
                    placeholder="e.g. September 2026"
                    className="form-input"
                    required
                  />
                </div>

                {/* STATUS */}

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
                    {payrollStatuses.map(
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

                {/* BASIC SALARY */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Basic Salary (KES)
                  </label>

                  <input
                    type="number"
                    name="basicSalary"
                    value={form.basicSalary}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </div>

                {/* ALLOWANCES */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Allowances (KES)
                  </label>

                  <input
                    type="number"
                    name="allowances"
                    value={form.allowances}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </div>

                {/* DEDUCTIONS */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Deductions (KES)
                  </label>

                  <input
                    type="number"
                    name="deductions"
                    value={form.deductions}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </div>
              </div>

              {/* CALCULATION */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Gross Salary
                    </p>

                    <p className="mt-1 font-bold text-slate-900">
                      {formatCurrency(
                        calculatedGross
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Deductions
                    </p>

                    <p className="mt-1 font-bold text-red-600">
                      {formatCurrency(
                        form.deductions
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Net Salary
                    </p>

                    <p className="mt-1 font-bold text-emerald-600">
                      {formatCurrency(
                        calculatedNet
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* BUTTONS */}

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
                    : editingPayroll
                    ? "Update Payroll"
                    : "Create Payroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPage;