import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  Tractor,
} from "lucide-react";

import {
  createLivestock,
  deleteLivestock,
  getLivestock,
  updateLivestock,
} from "../../services/livestock.service";

import { getFarmers } from "../../services/farmer.service";

const initialForm = {
  animalTag: "",
  farmer: "",
  species: "cattle",
  breed: "",
  sex: "female",
  dateOfBirth: "",
  healthStatus: "healthy",
  status: "active",
};

const LivestockPage = () => {
  const [livestock, setLivestock] = useState([]);
  const [farmers, setFarmers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState(null);

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [livestockResponse, farmersResponse] =
        await Promise.all([
          getLivestock(),
          getFarmers(),
        ]);

      setLivestock(livestockResponse.livestock || []);
      setFarmers(farmersResponse.farmers || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load livestock data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLivestock = useMemo(() => {
    return livestock.filter((animal) => {
      const searchValue = search.toLowerCase().trim();

      const farmerName = animal.farmer
        ? `${animal.farmer.firstName || ""} ${
            animal.farmer.lastName || ""
          }`.toLowerCase()
        : "";

      const matchesSearch =
        !searchValue ||
        animal.animalTag
          ?.toLowerCase()
          .includes(searchValue) ||
        animal.breed
          ?.toLowerCase()
          .includes(searchValue) ||
        farmerName.includes(searchValue);

      const matchesSpecies =
        speciesFilter === "all" ||
        animal.species === speciesFilter;

      const matchesStatus =
        statusFilter === "all" ||
        animal.status === statusFilter;

      return (
        matchesSearch &&
        matchesSpecies &&
        matchesStatus
      );
    });
  }, [
    livestock,
    search,
    speciesFilter,
    statusFilter,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingAnimal(null);
    setForm(initialForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (animal) => {
    setEditingAnimal(animal);

    setForm({
      animalTag: animal.animalTag || "",
      farmer: animal.farmer?._id || animal.farmer || "",
      species: animal.species || "cattle",
      breed: animal.breed || "",
      sex: animal.sex || "female",
      dateOfBirth: animal.dateOfBirth
        ? new Date(animal.dateOfBirth)
            .toISOString()
            .split("T")[0]
        : "",
      healthStatus:
        animal.healthStatus || "healthy",
      status: animal.status || "active",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingAnimal(null);
    setForm(initialForm);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        dateOfBirth: form.dateOfBirth
          ? form.dateOfBirth
          : undefined,
      };

      if (editingAnimal) {
        await updateLivestock(
          editingAnimal._id,
          payload
        );
      } else {
        await createLivestock(payload);
      }

      await loadData();
      closeForm();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save livestock."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (animal) => {
    const confirmed = window.confirm(
      `Delete livestock record ${animal.animalTag}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteLivestock(animal._id);

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete livestock."
      );
    }
  };

  const getStatusClasses = (status) => {
    if (status === "active") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "sold") {
      return "bg-blue-50 text-blue-700";
    }

    if (status === "transferred") {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  const getHealthClasses = (health) => {
    if (health?.toLowerCase() === "healthy") {
      return "bg-emerald-50 text-emerald-700";
    }

    return "bg-amber-50 text-amber-700";
  };

  const totalActive = livestock.filter(
    (animal) => animal.status === "active"
  ).length;

  const totalCattle = livestock.filter(
    (animal) =>
      animal.species === "cattle" &&
      animal.status === "active"
  ).length;

  const totalHealthy = livestock.filter(
    (animal) =>
      animal.healthStatus?.toLowerCase() ===
        "healthy" &&
      animal.status === "active"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-primary-600">
            Livestock Management
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Livestock
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage animals owned by cooperative farmers.
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus size={18} />
          Register Livestock
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
          <p className="text-sm text-slate-500">
            Total Active Livestock
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {totalActive}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Active Cattle
          </p>

          <p className="mt-1 text-2xl font-bold text-primary-600">
            {totalCattle}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Healthy Animals
          </p>

          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {totalHealthy}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
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
              placeholder="Search tag, breed or farmer..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={speciesFilter}
              onChange={(event) =>
                setSpeciesFilter(event.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400"
            >
              <option value="all">All Species</option>
              <option value="cattle">Cattle</option>
              <option value="goat">Goats</option>
              <option value="sheep">Sheep</option>
              <option value="pig">Pigs</option>
              <option value="poultry">Poultry</option>
              <option value="other">Other</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="deceased">Deceased</option>
              <option value="transferred">
                Transferred
              </option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Animal Tag
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Farmer
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Species
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Breed
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sex
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Health
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
                    colSpan="8"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading livestock...
                  </td>
                </tr>
              ) : filteredLivestock.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-5 py-12 text-center"
                  >
                    <Tractor
                      size={32}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      No livestock found
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Register your first animal.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLivestock.map((animal) => {
                  const farmerName = animal.farmer
                    ? `${animal.farmer.firstName || ""} ${
                        animal.farmer.lastName || ""
                      }`
                    : "Unknown Farmer";

                  return (
                    <tr
                      key={animal._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                        {animal.animalTag}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {farmerName}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm capitalize text-slate-600">
                        {animal.species}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {animal.breed || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm capitalize text-slate-600">
                        {animal.sex || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getHealthClasses(
                            animal.healthStatus
                          )}`}
                        >
                          {animal.healthStatus ||
                            "Unknown"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                            animal.status
                          )}`}
                        >
                          {animal.status}
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
                              openEditForm(animal)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                          >
                            <Edit size={17} />
                          </button>

                          <button
                            title="Delete"
                            onClick={() =>
                              handleDelete(animal)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Showing {filteredLivestock.length} of{" "}
            {livestock.length} livestock records
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingAnimal
                    ? "Edit Livestock"
                    : "Register Livestock"}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Record animal ownership and details.
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
                {/* Animal Tag */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Animal Tag *
                  </label>

                  <input
                    name="animalTag"
                    value={form.animalTag}
                    onChange={handleChange}
                    required
                    placeholder="e.g. COW-001"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                {/* Farmer */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Farmer *
                  </label>

                  <select
                    name="farmer"
                    value={form.farmer}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="">
                      Select farmer
                    </option>

                    {farmers.map((farmer) => (
                      <option
                        key={farmer._id}
                        value={farmer._id}
                      >
                        {farmer.membershipNumber} -{" "}
                        {farmer.firstName}{" "}
                        {farmer.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Species */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Species *
                  </label>

                  <select
                    name="species"
                    value={form.species}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="cattle">
                      Cattle
                    </option>
                    <option value="goat">Goat</option>
                    <option value="sheep">
                      Sheep
                    </option>
                    <option value="pig">Pig</option>
                    <option value="poultry">
                      Poultry
                    </option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Breed */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Breed
                  </label>

                  <input
                    name="breed"
                    value={form.breed}
                    onChange={handleChange}
                    placeholder="e.g. Friesian"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                {/* Sex */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Sex
                  </label>

                  <select
                    name="sex"
                    value={form.sex}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="female">
                      Female
                    </option>
                    <option value="male">Male</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date of Birth
                  </label>

                  <input
                    type="date"
                    name="dateOfBirth"
                    value={form.dateOfBirth}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                {/* Health Status */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Health Status
                  </label>

                  <input
                    name="healthStatus"
                    value={form.healthStatus}
                    onChange={handleChange}
                    placeholder="e.g. Healthy"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="active">
                      Active
                    </option>
                    <option value="sold">Sold</option>
                    <option value="deceased">
                      Deceased
                    </option>
                    <option value="transferred">
                      Transferred
                    </option>
                  </select>
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
                    : editingAnimal
                    ? "Update Livestock"
                    : "Register Livestock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LivestockPage;