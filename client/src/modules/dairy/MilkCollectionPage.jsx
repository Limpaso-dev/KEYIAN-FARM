import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Milk,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import {
  createMilkCollection,
  deleteMilkCollection,
  getMilkCollections,
  updateMilkCollection,
} from "../../services/milkCollection.service";

import { getFarmers } from "../../services/farmer.service";

const initialForm = {
  farmer: "",
  collectionCentre: "",
  collectionDate: "",
  quantityLitres: "",
  pricePerLitre: "",
  status: "accepted",
};

const MilkCollectionPage = () => {
  const [collections, setCollections] = useState([]);
  const [farmers, setFarmers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [farmersLoading, setFarmersLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [centreFilter, setCentreFilter] =
    useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getMilkCollections();

      setCollections(response.milkCollections || []);
    } catch (err) {
      console.error(
        "Failed to fetch milk collections:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to load milk collection records."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchFarmers = async () => {
    try {
      setFarmersLoading(true);

      const response = await getFarmers();

      setFarmers(response.data || response.farmers || []);
    } catch (err) {
      console.error(
        "Failed to fetch farmers:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to load farmers."
      );
    } finally {
      setFarmersLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchFarmers();
  }, []);

  const getFarmerName = (farmer) => {
    if (!farmer) return "Unknown farmer";

    const name =
      `${farmer.firstName || ""} ${
        farmer.lastName || ""
      }`.trim();

    return (
      name ||
      farmer.membershipNumber ||
      "Unknown farmer"
    );
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (collection) => {
    setEditingId(collection._id);

    setForm({
      farmer:
        collection.farmer?._id ||
        collection.farmer ||
        "",

      collectionCentre:
        collection.collectionCentre || "",

      collectionDate: collection.collectionDate
        ? new Date(collection.collectionDate)
            .toISOString()
            .split("T")[0]
        : "",

      quantityLitres:
        collection.quantityLitres ?? "",

      pricePerLitre:
        collection.pricePerLitre ?? "",

      status:
        collection.status || "accepted",
    });

    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;

    setShowModal(false);
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const calculatedTotal = useMemo(() => {
    const quantity = Number(form.quantityLitres);
    const price = Number(form.pricePerLitre);

    if (
      Number.isFinite(quantity) &&
      Number.isFinite(price) &&
      quantity >= 0 &&
      price >= 0
    ) {
      return quantity * price;
    }

    return 0;
  }, [
    form.quantityLitres,
    form.pricePerLitre,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setFormError("");

    if (!form.farmer) {
      setFormError("Please select a farmer.");
      return;
    }

    if (!form.collectionCentre.trim()) {
      setFormError(
        "Please enter the collection centre."
      );
      return;
    }

    if (!form.collectionDate) {
      setFormError(
        "Please select the collection date."
      );
      return;
    }

    if (
      form.quantityLitres === "" ||
      Number(form.quantityLitres) <= 0
    ) {
      setFormError(
        "Quantity collected must be greater than zero."
      );
      return;
    }

    if (
      form.pricePerLitre === "" ||
      Number(form.pricePerLitre) < 0
    ) {
      setFormError(
        "Price per litre cannot be negative."
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        farmer: form.farmer,
        collectionCentre:
          form.collectionCentre.trim(),
        collectionDate: form.collectionDate,
        quantityLitres:
          Number(form.quantityLitres),
        pricePerLitre:
          Number(form.pricePerLitre),
        totalAmount: calculatedTotal,
        status: form.status,
      };

      if (editingId) {
        await updateMilkCollection(
          editingId,
          payload
        );
      } else {
        await createMilkCollection(payload);
      }

      closeModal();
      await fetchCollections();
    } catch (err) {
      console.error(
        "Failed to save milk collection:",
        err
      );

      setFormError(
        err.response?.data?.message ||
          "Failed to save milk collection record."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this milk collection record?"
    );

    if (!confirmed) return;

    try {
      await deleteMilkCollection(id);

      await fetchCollections();
    } catch (err) {
      console.error(
        "Failed to delete milk collection:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to delete milk collection record."
      );
    }
  };

  const centres = useMemo(() => {
    return [
      ...new Set(
        collections
          .map(
            (item) => item.collectionCentre
          )
          .filter(Boolean)
      ),
    ];
  }, [collections]);

  const filteredCollections = useMemo(() => {
    const search =
      searchTerm.trim().toLowerCase();

    return collections.filter((item) => {
      const farmerName = item.farmer
        ? `${item.farmer.firstName || ""} ${
            item.farmer.lastName || ""
          }`
        : "";

      const membershipNumber =
        item.farmer?.membershipNumber || "";

      const matchesSearch =
        !search ||
        farmerName
          .toLowerCase()
          .includes(search) ||
        membershipNumber
          .toLowerCase()
          .includes(search) ||
        item.collectionCentre
          ?.toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      const matchesCentre =
        centreFilter === "all" ||
        item.collectionCentre ===
          centreFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCentre
      );
    });
  }, [
    collections,
    searchTerm,
    statusFilter,
    centreFilter,
  ]);

  const statistics = useMemo(() => {
    const totalLitres =
      collections.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantityLitres || 0
          ),
        0
      );

    const totalValue =
      collections.reduce(
        (sum, item) =>
          sum +
          Number(
            item.totalAmount || 0
          ),
        0
      );

    const accepted =
      collections.filter(
        (item) =>
          item.status === "accepted"
      );

    const rejected =
      collections.filter(
        (item) =>
          item.status === "rejected"
      );

    return {
      totalRecords:
        collections.length,

      totalLitres,

      totalValue,

      acceptedLitres:
        accepted.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantityLitres || 0
            ),
          0
        ),

      rejectedLitres:
        rejected.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantityLitres || 0
            ),
          0
        ),
    };
  }, [collections]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(
      "en-KE",
      {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 2,
      }
    ).format(Number(amount || 0));
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Intl.DateTimeFormat(
      "en-KE",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    ).format(new Date(date));
  };

  const statusBadge = (status) => {
    const styles = {
      accepted:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20",

      rejected:
        "bg-red-50 text-red-700 ring-red-600/20",

      partial:
        "bg-amber-50 text-amber-700 ring-amber-600/20",
    };

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
          styles[status] ||
          "bg-slate-50 text-slate-600 ring-slate-500/20"
        }`}
      >
        {status || "unknown"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Milk size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Milk Collection
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage farmer milk deliveries
                and collection records.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus size={18} />

          Record Milk Collection
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="rounded p-1 hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Collection Records"
          value={statistics.totalRecords}
          icon={Activity}
          description="Total records"
        />

        <StatCard
          title="Total Milk"
          value={`${statistics.totalLitres.toLocaleString(
            "en-KE"
          )} L`}
          icon={Milk}
          description="All recorded milk"
        />

        <StatCard
          title="Accepted Milk"
          value={`${statistics.acceptedLitres.toLocaleString(
            "en-KE"
          )} L`}
          icon={CheckCircle2}
          description="Accepted quantity"
        />

        <StatCard
          title="Rejected Milk"
          value={`${statistics.rejectedLitres.toLocaleString(
            "en-KE"
          )} L`}
          icon={XCircle}
          description="Rejected quantity"
        />

        <StatCard
          title="Collection Value"
          value={formatCurrency(
            statistics.totalValue
          )}
          icon={CircleDollarSign}
          description="Recorded value"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Search farmer, membership no..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">
              All statuses
            </option>

            <option value="accepted">
              Accepted
            </option>

            <option value="partial">
              Partial
            </option>

            <option value="rejected">
              Rejected
            </option>
          </select>

          <select
            value={centreFilter}
            onChange={(event) =>
              setCentreFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">
              All collection centres
            </option>

            {centres.map((centre) => (
              <option
                key={centre}
                value={centre}
              >
                {centre}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
            Showing{" "}
            <span className="mx-1 font-semibold text-slate-800">
              {filteredCollections.length}
            </span>
            of{" "}
            <span className="ml-1 font-semibold text-slate-800">
              {collections.length}
            </span>{" "}
            records
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <TableHeader>
                  Date
                </TableHeader>

                <TableHeader>
                  Farmer
                </TableHeader>

                <TableHeader>
                  Collection Centre
                </TableHeader>

                <TableHeader>
                  Quantity
                </TableHeader>

                <TableHeader>
                  Price / Litre
                </TableHeader>

                <TableHeader>
                  Total Amount
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader align="right">
                  Actions
                </TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-14 text-center"
                  >
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

                    <p className="mt-3 text-sm text-slate-500">
                      Loading milk collection
                      records...
                    </p>
                  </td>
                </tr>
              ) : filteredCollections.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-14 text-center"
                  >
                    <Milk
                      size={40}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 font-medium text-slate-700">
                      No milk collection
                      records found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Record a collection
                      or adjust your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCollections.map(
                  (collection) => (
                    <tr
                      key={collection._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            size={16}
                            className="text-slate-400"
                          />

                          {formatDate(
                            collection.collectionDate
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-800">
                          {getFarmerName(
                            collection.farmer
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {collection.farmer
                            ?.membershipNumber ||
                            "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {
                          collection.collectionCentre
                        }
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-slate-800">
                        {Number(
                          collection.quantityLitres ||
                            0
                        ).toLocaleString(
                          "en-KE"
                        )}{" "}
                        L
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatCurrency(
                          collection.pricePerLitre
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-slate-800">
                        {formatCurrency(
                          collection.totalAmount
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {statusBadge(
                          collection.status
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                collection
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-700"
                            title="Edit"
                          >
                            <Edit3 size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                collection._id
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? "Edit Milk Collection"
                    : "Record Milk Collection"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the farmer's milk
                  delivery details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="Farmer"
                  required
                  className="md:col-span-2"
                >
                  <select
                    name="farmer"
                    value={form.farmer}
                    onChange={handleChange}
                    disabled={farmersLoading}
                    className="form-input"
                  >
                    <option value="">
                      {farmersLoading
                        ? "Loading farmers..."
                        : "Select farmer"}
                    </option>

                    {farmers.map((farmer) => (
                      <option
                        key={farmer._id}
                        value={farmer._id}
                      >
                        {getFarmerName(
                          farmer
                        )}

                        {farmer.membershipNumber
                          ? ` — ${farmer.membershipNumber}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Collection Centre"
                  required
                >
                  <input
                    type="text"
                    name="collectionCentre"
                    value={
                      form.collectionCentre
                    }
                    onChange={handleChange}
                    placeholder="e.g. Keiyian Centre"
                    className="form-input"
                  />
                </FormField>

                <FormField
                  label="Collection Date"
                  required
                >
                  <input
                    type="date"
                    name="collectionDate"
                    value={
                      form.collectionDate
                    }
                    onChange={handleChange}
                    className="form-input"
                  />
                </FormField>

                <FormField
                  label="Quantity (Litres)"
                  required
                >
                  <input
                    type="number"
                    name="quantityLitres"
                    value={
                      form.quantityLitres
                    }
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </FormField>

                <FormField
                  label="Price per Litre"
                  required
                >
                  <input
                    type="number"
                    name="pricePerLitre"
                    value={
                      form.pricePerLitre
                    }
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </FormField>

                <FormField
                  label="Status"
                  required
                >
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="accepted">
                      Accepted
                    </option>

                    <option value="partial">
                      Partial
                    </option>

                    <option value="rejected">
                      Rejected
                    </option>
                  </select>
                </FormField>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Total Amount
                  </label>

                  <div className="flex h-[42px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900">
                    {formatCurrency(
                      calculatedTotal
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}

                  {submitting
                    ? "Saving..."
                    : editingId
                    ? "Update Collection"
                    : "Record Collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
};

const TableHeader = ({
  children,
  align = "left",
}) => {
  return (
    <th
      className={`px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wide text-slate-500`}
    >
      {children}
    </th>
  );
};

const FormField = ({
  label,
  required = false,
  children,
  className = "",
}) => {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
};

export default MilkCollectionPage;