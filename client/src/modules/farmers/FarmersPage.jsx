import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import {
  createFarmer,
  deleteFarmer,
  getFarmers,
  updateFarmer,
} from "../../services/farmer.service";

const initialForm = {
  membershipNumber: "",
  firstName: "",
  lastName: "",
  nationalId: "",
  phone: "",
  email: "",
  address: "",
  farmLocation: "",
  membershipStatus: "active",
  shares: 0,
};

const FarmersPage = () => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const loadFarmers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getFarmers();

      setFarmers(response.farmers || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load farmers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFarmers();
  }, []);

  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer) => {
      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        farmer.membershipNumber
          ?.toLowerCase()
          .includes(searchValue) ||
        farmer.firstName
          ?.toLowerCase()
          .includes(searchValue) ||
        farmer.lastName
          ?.toLowerCase()
          .includes(searchValue) ||
        farmer.phone
          ?.toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "all" ||
        farmer.membershipStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [farmers, search, statusFilter]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "shares" ? Number(value) : value,
    }));
  };

  const openCreateForm = () => {
    setEditingFarmer(null);
    setForm(initialForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (farmer) => {
    setEditingFarmer(farmer);

    setForm({
      membershipNumber: farmer.membershipNumber || "",
      firstName: farmer.firstName || "",
      lastName: farmer.lastName || "",
      nationalId: farmer.nationalId || "",
      phone: farmer.phone || "",
      email: farmer.email || "",
      address: farmer.address || "",
      farmLocation: farmer.farmLocation || "",
      membershipStatus:
        farmer.membershipStatus || "active",
      shares: farmer.shares || 0,
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingFarmer(null);
    setForm(initialForm);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (editingFarmer) {
        await updateFarmer(editingFarmer._id, form);
      } else {
        await createFarmer(form);
      }

      await loadFarmers();
      closeForm();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save farmer."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (farmer) => {
    const confirmed = window.confirm(
      `Delete ${farmer.firstName} ${farmer.lastName}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteFarmer(farmer._id);

      await loadFarmers();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete farmer."
      );
    }
  };

  const getStatusClasses = (status) => {
    if (status === "active") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "suspended") {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-primary-600">
            Cooperative Management
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Farmers
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage cooperative members and farmer records.
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus size={18} />
          Add Farmer
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Farmers
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {farmers.length}
              </p>
            </div>

            <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
              <Users size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Active Members
          </p>

          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {
              farmers.filter(
                (farmer) =>
                  farmer.membershipStatus === "active"
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total Shares
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {farmers.reduce(
              (total, farmer) =>
                total + Number(farmer.shares || 0),
              0
            )}
          </p>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
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
              placeholder="Search by name, membership number or phone..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary-400 focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Membership
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Farmer
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Phone
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Farm Location
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Shares
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading farmers...
                  </td>
                </tr>
              ) : filteredFarmers.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-12 text-center"
                  >
                    <Users
                      size={32}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      No farmers found
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Add your first cooperative farmer.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFarmers.map((farmer) => (
                  <tr
                    key={farmer._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                      {farmer.membershipNumber}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {farmer.firstName}{" "}
                        {farmer.lastName}
                      </div>

                      {farmer.nationalId && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          ID: {farmer.nationalId}
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {farmer.phone}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {farmer.farmLocation || "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {farmer.shares || 0}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                          farmer.membershipStatus
                        )}`}
                      >
                        {farmer.membershipStatus}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          title="View"
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye size={17} />
                        </button>

                        <button
                          title="Edit"
                          onClick={() =>
                            openEditForm(farmer)
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                        >
                          <Edit size={17} />
                        </button>

                        <button
                          title="Delete"
                          onClick={() =>
                            handleDelete(farmer)
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Result count */}
        {!loading && (
          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Showing {filteredFarmers.length} of{" "}
            {farmers.length} farmers
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingFarmer
                    ? "Edit Farmer"
                    : "Register Farmer"}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Enter the cooperative member's details.
                </p>
              </div>

              <button
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 p-6"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Membership Number *
                  </label>

                  <input
                    name="membershipNumber"
                    value={form.membershipNumber}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    National ID
                  </label>

                  <input
                    name="nationalId"
                    value={form.nationalId}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First Name *
                  </label>

                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last Name *
                  </label>

                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone *
                  </label>

                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    required
                    placeholder="07XXXXXXXX"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Farm Location
                  </label>

                  <input
                    name="farmLocation"
                    value={form.farmLocation}
                    onChange={handleChange}
                    placeholder="Village / Area"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Membership Status
                  </label>

                  <select
                    name="membershipStatus"
                    value={form.membershipStatus}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">
                      Inactive
                    </option>
                    <option value="suspended">
                      Suspended
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Shares
                  </label>

                  <input
                    type="number"
                    min="0"
                    name="shares"
                    value={form.shares}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows="3"
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
                    : editingFarmer
                    ? "Update Farmer"
                    : "Register Farmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmersPage;