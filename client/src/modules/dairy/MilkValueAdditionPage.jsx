import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Factory,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  createMilkValueAddition,
  deleteMilkValueAddition,
  getMilkValueAdditions,
  updateMilkValueAddition,
} from "../../services/milkValueAddition.service";

const initialForm = {
  productName: "",
  batchNumber: "",
  inputMilkLitres: "",
  outputQuantity: "",
  unit: "",
  productionDate: "",
  expiryDate: "",
  status: "processing",
};

const MilkValueAdditionPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form, setForm] = useState(initialForm);

  const fetchRecords = async () => {
    try {
      setLoading(true);

      const response =
        await getMilkValueAdditions();

      setRecords(
        response.milkValueAdditions || []
      );
    } catch (error) {
      console.error(
        "Failed to load milk value addition records:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        record.productName
          ?.toLowerCase()
          .includes(search) ||
        record.batchNumber
          ?.toLowerCase()
          .includes(search) ||
        record.unit
          ?.toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: records.length,

      processing: records.filter(
        (record) => record.status === "processing"
      ).length,

      completed: records.filter(
        (record) => record.status === "completed"
      ).length,

      rejected: records.filter(
        (record) => record.status === "rejected"
      ).length,
    };
  }, [records]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);

    setForm({
      productName: record.productName || "",
      batchNumber: record.batchNumber || "",
      inputMilkLitres:
        record.inputMilkLitres ?? "",
      outputQuantity:
        record.outputQuantity ?? "",
      unit: record.unit || "",
      productionDate: record.productionDate
        ? new Date(record.productionDate)
            .toISOString()
            .slice(0, 10)
        : "",
      expiryDate: record.expiryDate
        ? new Date(record.expiryDate)
            .toISOString()
            .slice(0, 10)
        : "",
      status: record.status || "processing",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingRecord(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.productName.trim()) {
      alert("Please enter the product name.");
      return;
    }

    if (!form.batchNumber.trim()) {
      alert("Please enter the batch number.");
      return;
    }

    if (!form.inputMilkLitres) {
      alert("Please enter the input milk quantity.");
      return;
    }

    if (!form.outputQuantity) {
      alert("Please enter the output quantity.");
      return;
    }

    if (!form.unit.trim()) {
      alert("Please enter the output unit.");
      return;
    }

    if (!form.productionDate) {
      alert("Please enter the production date.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        productName: form.productName.trim(),

        batchNumber: form.batchNumber.trim(),

        inputMilkLitres:
          Number(form.inputMilkLitres),

        outputQuantity:
          Number(form.outputQuantity),

        unit: form.unit.trim(),

        productionDate: new Date(
          form.productionDate
        ).toISOString(),

        expiryDate: form.expiryDate
          ? new Date(
              form.expiryDate
            ).toISOString()
          : undefined,

        status: form.status,
      };

      if (editingRecord) {
        await updateMilkValueAddition(
          editingRecord._id,
          payload
        );
      } else {
        await createMilkValueAddition(payload);
      }

      await fetchRecords();
      closeModal();
    } catch (error) {
      console.error(
        "Failed to save milk value addition record:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save milk value addition record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this production record?"
    );

    if (!confirmed) return;

    try {
      await deleteMilkValueAddition(id);
      await fetchRecords();
    } catch (error) {
      console.error(
        "Failed to delete production record:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete production record."
      );
    }
  };

  const openViewModal = (record) => {
    setSelectedRecord(record);
    setShowViewModal(true);
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString(
      "en-KE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const getStatusClasses = (status) => {
    if (status === "completed") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (status === "rejected") {
      return "border-red-200 bg-red-50 text-red-700";
    }

    return "border-amber-200 bg-amber-50 text-amber-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Factory size={23} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Milk Value Addition
              </h2>

              <p className="text-sm text-slate-500">
                Manage dairy production, batches and
                finished products.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <Plus size={18} />
          Record Production
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Batches"
          value={summary.total}
        />

        <SummaryCard
          title="Processing"
          value={summary.processing}
          valueClass="text-amber-600"
        />

        <SummaryCard
          title="Completed"
          value={summary.completed}
          valueClass="text-emerald-600"
        />

        <SummaryCard
          title="Rejected"
          value={summary.rejected}
          valueClass="text-red-600"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search product or batch number..."
              className="form-input pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="form-input lg:w-48"
          >
            <option value="all">All Statuses</option>
            <option value="processing">
              Processing
            </option>
            <option value="completed">
              Completed
            </option>
            <option value="rejected">
              Rejected
            </option>
          </select>
        </div>
      </div>

      {/* Production Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <TableHeader>Product</TableHeader>
                <TableHeader>Batch Number</TableHeader>
                <TableHeader>Input Milk</TableHeader>
                <TableHeader>Output</TableHeader>
                <TableHeader>Production Date</TableHeader>
                <TableHeader>Expiry Date</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

                      <p className="mt-3 text-sm text-slate-500">
                        Loading production records...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center"
                  >
                    <Factory
                      size={35}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-600">
                      No production records found
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Record a milk value addition
                      batch to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-800">
                      {record.productName}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {record.batchNumber}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {record.inputMilkLitres} L
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {record.outputQuantity}{" "}
                      {record.unit}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {formatDate(
                        record.productionDate
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {formatDate(
                        record.expiryDate
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                          record.status
                        )}`}
                      >
                        {record.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-1">
                        <ActionButton
                          title="View"
                          onClick={() =>
                            openViewModal(record)
                          }
                        >
                          <Eye size={16} />
                        </ActionButton>

                        <ActionButton
                          title="Edit"
                          onClick={() =>
                            openEditModal(record)
                          }
                        >
                          <Edit size={16} />
                        </ActionButton>

                        <ActionButton
                          title="Delete"
                          danger
                          onClick={() =>
                            handleDelete(record._id)
                          }
                        >
                          <Trash2 size={16} />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingRecord
                    ? "Edit Production Record"
                    : "Record Milk Production"}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Enter the details of the dairy
                  production batch.
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
              className="space-y-6 p-6"
            >
              {/* Product Details */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-slate-800">
                  Product Details
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Product Name"
                    required
                  >
                    <input
                      type="text"
                      name="productName"
                      value={form.productName}
                      onChange={handleChange}
                      placeholder="e.g. Yoghurt"
                      className="form-input"
                      required
                    />
                  </FormField>

                  <FormField
                    label="Batch Number"
                    required
                  >
                    <input
                      type="text"
                      name="batchNumber"
                      value={form.batchNumber}
                      onChange={handleChange}
                      placeholder="e.g. BATCH-0001"
                      className="form-input"
                      required
                    />
                  </FormField>
                </div>
              </div>

              {/* Production Quantities */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-slate-800">
                  Production Quantities
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    label="Input Milk (Litres)"
                    required
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="inputMilkLitres"
                      value={form.inputMilkLitres}
                      onChange={handleChange}
                      placeholder="e.g. 500"
                      className="form-input"
                      required
                    />
                  </FormField>

                  <FormField
                    label="Output Quantity"
                    required
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="outputQuantity"
                      value={form.outputQuantity}
                      onChange={handleChange}
                      placeholder="e.g. 450"
                      className="form-input"
                      required
                    />
                  </FormField>

                  <FormField
                    label="Output Unit"
                    required
                  >
                    <input
                      type="text"
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                      placeholder="e.g. litres, kg, packets"
                      className="form-input"
                      required
                    />
                  </FormField>
                </div>
              </div>

              {/* Dates and Status */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-slate-800">
                  Production Information
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    label="Production Date"
                    required
                  >
                    <input
                      type="date"
                      name="productionDate"
                      value={form.productionDate}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </FormField>

                  <FormField label="Expiry Date">
                    <input
                      type="date"
                      name="expiryDate"
                      value={form.expiryDate}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Status" required>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      className="form-input"
                      required
                    >
                      <option value="processing">
                        Processing
                      </option>

                      <option value="completed">
                        Completed
                      </option>

                      <option value="rejected">
                        Rejected
                      </option>
                    </select>
                  </FormField>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingRecord
                    ? "Update Record"
                    : "Save Production"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Production Details
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Batch{" "}
                  {selectedRecord.batchNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowViewModal(false)
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs text-slate-500">
                    Product
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {selectedRecord.productName}
                  </p>
                </div>

                <Factory
                  size={32}
                  className="text-primary-600"
                />
              </div>

              <DetailSection title="Product Information">
                <DetailItem
                  label="Product Name"
                  value={
                    selectedRecord.productName
                  }
                />

                <DetailItem
                  label="Batch Number"
                  value={
                    selectedRecord.batchNumber
                  }
                />

                <DetailItem
                  label="Status"
                  value={
                    selectedRecord.status
                  }
                />
              </DetailSection>

              <DetailSection title="Production Quantities">
                <DetailItem
                  label="Input Milk"
                  value={
                    selectedRecord.inputMilkLitres !==
                    undefined
                      ? `${selectedRecord.inputMilkLitres} L`
                      : "—"
                  }
                />

                <DetailItem
                  label="Output Quantity"
                  value={
                    selectedRecord.outputQuantity !==
                    undefined
                      ? `${selectedRecord.outputQuantity} ${selectedRecord.unit}`
                      : "—"
                  }
                />

                <DetailItem
                  label="Unit"
                  value={selectedRecord.unit}
                />
              </DetailSection>

              <DetailSection title="Dates">
                <DetailItem
                  label="Production Date"
                  value={formatDate(
                    selectedRecord.productionDate
                  )}
                />

                <DetailItem
                  label="Expiry Date"
                  value={formatDate(
                    selectedRecord.expiryDate
                  )}
                />
              </DetailSection>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  valueClass = "text-slate-900",
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {title}
        </p>

        <p
          className={`mt-2 text-2xl font-bold ${valueClass}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
};

const TableHeader = ({ children }) => {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
};

const ActionButton = ({
  children,
  title,
  onClick,
  danger = false,
}) => {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        danger
          ? "text-red-500 hover:bg-red-50 hover:text-red-700"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
};

const FormField = ({
  label,
  required = false,
  children,
}) => {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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

const DetailSection = ({ title, children }) => {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-slate-800">
        {title}
      </h4>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
};

const DetailItem = ({ label, value }) => {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium capitalize text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
};

export default MilkValueAdditionPage;