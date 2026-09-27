import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Users,
} from "lucide-react";

import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../../services/supplier.service";

const initialForm = {
  supplierCode: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  taxNumber: "",
  status: "active",
};

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadSuppliers = async () => {
    try {
      setLoading(true);

      const response = await getSuppliers();

      setSuppliers(response.data || []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);

      alert(
        error.response?.data?.message ||
          "Failed to load suppliers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditForm = (supplier) => {
    setEditingId(supplier._id);

    setForm({
      supplierCode: supplier.supplierCode || "",
      name: supplier.name || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      taxNumber: supplier.taxNumber || "",
      status: supplier.status || "active",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.supplierCode || !form.name) {
      alert("Supplier code and supplier name are required.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateSupplier(editingId, form);
      } else {
        await createSupplier(form);
      }

      await loadSuppliers();

      closeForm();
    } catch (error) {
      console.error("Failed to save supplier:", error);

      alert(
        error.response?.data?.message ||
          "Failed to save supplier"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this supplier?"
    );

    if (!confirmed) return;

    try {
      await deleteSupplier(id);
      await loadSuppliers();
    } catch (error) {
      console.error("Failed to delete supplier:", error);

      alert(
        error.response?.data?.message ||
          "Failed to delete supplier"
      );
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = search.toLowerCase();

    return (
      supplier.supplierCode?.toLowerCase().includes(query) ||
      supplier.name?.toLowerCase().includes(query) ||
      supplier.contactPerson
        ?.toLowerCase()
        .includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
              <Users size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Suppliers
              </h1>

              <p className="text-sm text-slate-500">
                Manage Keiyian procurement suppliers.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-8 text-center">
            <Users
              size={40}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-medium text-slate-700">
              No suppliers found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Add your first procurement supplier.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Code
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Supplier
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Contact Person
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Phone
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Tax Number
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                      {supplier.supplierCode}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {supplier.name}
                      </div>

                      {supplier.email && (
                        <div className="text-xs text-slate-500">
                          {supplier.email}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {supplier.contactPerson || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {supplier.phone || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {supplier.taxNumber || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          supplier.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {supplier.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(supplier)
                          }
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-700"
                          title="Edit supplier"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(supplier._id)
                          }
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete supplier"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? "Edit Supplier"
                    : "Add Supplier"}
                </h2>

                <p className="text-sm text-slate-500">
                  Enter supplier information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Supplier Code *
                  </label>

                  <input
                    name="supplierCode"
                    value={form.supplierCode}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="SUP-001"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Supplier Name *
                  </label>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Supplier name"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Contact Person
                  </label>

                  <input
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Contact person"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="07XX XXX XXX"
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
                    placeholder="supplier@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Tax Number
                  </label>

                  <input
                    name="taxNumber"
                    value={form.taxNumber}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="KRA PIN / Tax number"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Address
                </label>

                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Supplier address"
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
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Supplier"
                    : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;