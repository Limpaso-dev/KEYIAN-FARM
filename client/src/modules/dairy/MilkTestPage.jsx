import { useEffect, useMemo, useState } from "react";
import {
  Beaker,
  CheckCircle2,
  ClipboardList,
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import {
  createMilkTest,
  deleteMilkTest,
  getMilkTests,
  updateMilkTest,
} from "../../services/milkLaboratory.service";

import { getMilkCollections } from "../../services/milkCollection.service";

const initialForm = {
  milkCollection: "",
  sampleNumber: "",
  fatPercentage: "",
  proteinPercentage: "",
  snfPercentage: "",
  acidity: "",
  temperature: "",
  result: "pending",
  testedAt: "",
  remarks: "",
};

const MilkTestPage = () => {
  const [tests, setTests] = useState([]);
  const [collections, setCollections] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [resultFilter, setResultFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);

  const [form, setForm] = useState(initialForm);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [testsResponse, collectionsResponse] =
        await Promise.all([
          getMilkTests(),
          getMilkCollections(),
        ]);

      setTests(testsResponse.milkTests || []);
      setCollections(
        collectionsResponse.milkCollections || []
      );
    } catch (error) {
      console.error("Failed to load milk laboratory data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const search = searchTerm.toLowerCase();

      const farmerName = test.milkCollection?.farmer
        ? `${test.milkCollection.farmer.firstName || ""} ${
            test.milkCollection.farmer.lastName || ""
          }`.toLowerCase()
        : "";

      const matchesSearch =
        test.sampleNumber
          ?.toLowerCase()
          .includes(search) ||
        farmerName.includes(search) ||
        test.milkCollection?.collectionCentre
          ?.toLowerCase()
          .includes(search);

      const matchesResult =
        resultFilter === "all" ||
        test.result === resultFilter;

      return matchesSearch && matchesResult;
    });
  }, [tests, searchTerm, resultFilter]);

  const summary = useMemo(() => {
    return {
      total: tests.length,
      pass: tests.filter((test) => test.result === "pass").length,
      fail: tests.filter((test) => test.result === "fail").length,
      pending: tests.filter(
        (test) => test.result === "pending"
      ).length,
    };
  }, [tests]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingTest(null);

    setForm({
      ...initialForm,
      testedAt: new Date().toISOString().slice(0, 16),
    });

    setShowModal(true);
  };

  const openEditModal = (test) => {
    setEditingTest(test);

    setForm({
      milkCollection:
        test.milkCollection?._id ||
        test.milkCollection ||
        "",
      sampleNumber: test.sampleNumber || "",
      fatPercentage: test.fatPercentage ?? "",
      proteinPercentage: test.proteinPercentage ?? "",
      snfPercentage: test.snfPercentage ?? "",
      acidity: test.acidity ?? "",
      temperature: test.temperature ?? "",
      result: test.result || "pending",
      testedAt: test.testedAt
        ? new Date(test.testedAt)
            .toISOString()
            .slice(0, 16)
        : "",
      remarks: test.remarks || "",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingTest(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.milkCollection) {
      alert("Please select a milk collection.");
      return;
    }

    if (!form.sampleNumber.trim()) {
      alert("Please enter the sample number.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        milkCollection: form.milkCollection,
        sampleNumber: form.sampleNumber.trim(),

        fatPercentage:
          form.fatPercentage === ""
            ? undefined
            : Number(form.fatPercentage),

        proteinPercentage:
          form.proteinPercentage === ""
            ? undefined
            : Number(form.proteinPercentage),

        snfPercentage:
          form.snfPercentage === ""
            ? undefined
            : Number(form.snfPercentage),

        acidity:
          form.acidity === ""
            ? undefined
            : Number(form.acidity),

        temperature:
          form.temperature === ""
            ? undefined
            : Number(form.temperature),

        result: form.result,

        testedAt: form.testedAt
          ? new Date(form.testedAt).toISOString()
          : undefined,

        remarks: form.remarks.trim(),
      };

      if (editingTest) {
        await updateMilkTest(
          editingTest._id,
          payload
        );
      } else {
        await createMilkTest(payload);
      }

      await fetchData();
      closeModal();
    } catch (error) {
      console.error("Failed to save milk test:", error);

      alert(
        error.response?.data?.message ||
          "Failed to save milk laboratory test."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this milk test?"
    );

    if (!confirmed) return;

    try {
      await deleteMilkTest(id);
      await fetchData();
    } catch (error) {
      console.error("Failed to delete milk test:", error);

      alert(
        error.response?.data?.message ||
          "Failed to delete milk test."
      );
    }
  };

  const openViewModal = (test) => {
    setSelectedTest(test);
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

  const formatDateTime = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleString(
      "en-KE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const getFarmerName = (test) => {
    const farmer = test.milkCollection?.farmer;

    if (!farmer) return "Unknown farmer";

    return `${farmer.firstName || ""} ${
      farmer.lastName || ""
    }`.trim();
  };

  const getResultClasses = (result) => {
    if (result === "pass") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (result === "fail") {
      return "bg-red-50 text-red-700 border-red-200";
    }

    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Beaker size={23} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Milk Testing
              </h2>

              <p className="text-sm text-slate-500">
                Record and manage milk quality laboratory
                tests.
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
          Record Milk Test
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Tests"
          value={summary.total}
          icon={ClipboardList}
        />

        <SummaryCard
          title="Passed"
          value={summary.pass}
          icon={CheckCircle2}
          valueClass="text-emerald-600"
        />

        <SummaryCard
          title="Failed"
          value={summary.fail}
          icon={XCircle}
          valueClass="text-red-600"
        />

        <SummaryCard
          title="Pending"
          value={summary.pending}
          icon={Beaker}
          valueClass="text-amber-600"
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
              placeholder="Search sample number, farmer or collection centre..."
              className="form-input pl-10"
            />
          </div>

          <select
            value={resultFilter}
            onChange={(event) =>
              setResultFilter(event.target.value)
            }
            className="form-input lg:w-48"
          >
            <option value="all">All Results</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <TableHeader>Sample No.</TableHeader>
                <TableHeader>Farmer</TableHeader>
                <TableHeader>Collection Centre</TableHeader>
                <TableHeader>Collection Date</TableHeader>
                <TableHeader>Fat %</TableHeader>
                <TableHeader>Protein %</TableHeader>
                <TableHeader>SNF %</TableHeader>
                <TableHeader>Result</TableHeader>
                <TableHeader>Actions</TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

                      <p className="mt-3 text-sm text-slate-500">
                        Loading milk tests...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredTests.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-12 text-center"
                  >
                    <Beaker
                      size={35}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-600">
                      No milk tests found
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Record a milk laboratory test to
                      get started.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTests.map((test) => (
                  <tr
                    key={test._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-800">
                      {test.sampleNumber}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {getFarmerName(test)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {test.milkCollection
                        ?.collectionCentre || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {formatDate(
                        test.milkCollection
                          ?.collectionDate
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {test.fatPercentage ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {test.proteinPercentage ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {test.snfPercentage ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getResultClasses(
                          test.result
                        )}`}
                      >
                        {test.result}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-1">
                        <ActionButton
                          title="View"
                          onClick={() =>
                            openViewModal(test)
                          }
                        >
                          <Eye size={16} />
                        </ActionButton>

                        <ActionButton
                          title="Edit"
                          onClick={() =>
                            openEditModal(test)
                          }
                        >
                          <Edit size={16} />
                        </ActionButton>

                        <ActionButton
                          title="Delete"
                          danger
                          onClick={() =>
                            handleDelete(test._id)
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingTest
                    ? "Edit Milk Test"
                    : "Record Milk Test"}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Enter the laboratory results for the
                  selected milk collection.
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
              {/* Collection Information */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-slate-800">
                  Collection Information
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Milk Collection"
                    required
                  >
                    <select
                      name="milkCollection"
                      value={form.milkCollection}
                      onChange={handleChange}
                      className="form-input"
                      required
                    >
                      <option value="">
                        Select milk collection
                      </option>

                      {collections.map((collection) => (
                        <option
                          key={collection._id}
                          value={collection._id}
                        >
                          {collection.farmer
                            ? `${collection.farmer.firstName || ""} ${
                                collection.farmer.lastName || ""
                              }`
                            : "Unknown farmer"}{" "}
                          —{" "}
                          {collection.collectionCentre}{" "}
                          —{" "}
                          {collection.quantityLitres}L —{" "}
                          {formatDate(
                            collection.collectionDate
                          )}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Sample Number"
                    required
                  >
                    <input
                      type="text"
                      name="sampleNumber"
                      value={form.sampleNumber}
                      onChange={handleChange}
                      placeholder="e.g. ML-0001"
                      className="form-input"
                      required
                    />
                  </FormField>
                </div>
              </div>

              {/* Quality Parameters */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-slate-800">
                  Quality Parameters
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Fat Percentage (%)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="fatPercentage"
                      value={form.fatPercentage}
                      onChange={handleChange}
                      placeholder="e.g. 4.20"
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Protein Percentage (%)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="proteinPercentage"
                      value={form.proteinPercentage}
                      onChange={handleChange}
                      placeholder="e.g. 3.30"
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="SNF Percentage (%)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="snfPercentage"
                      value={form.snfPercentage}
                      onChange={handleChange}
                      placeholder="e.g. 8.50"
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Acidity">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="acidity"
                      value={form.acidity}
                      onChange={handleChange}
                      placeholder="Acidity"
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Temperature">
                    <input
                      type="number"
                      step="0.01"
                      name="temperature"
                      value={form.temperature}
                      onChange={handleChange}
                      placeholder="Temperature"
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Result" required>
                    <select
                      name="result"
                      value={form.result}
                      onChange={handleChange}
                      className="form-input"
                      required
                    >
                      <option value="pending">
                        Pending
                      </option>

                      <option value="pass">Pass</option>

                      <option value="fail">Fail</option>
                    </select>
                  </FormField>
                </div>
              </div>

              {/* Testing Details */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-slate-800">
                  Testing Details
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Tested At">
                    <input
                      type="datetime-local"
                      name="testedAt"
                      value={form.testedAt}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Remarks">
                    <textarea
                      name="remarks"
                      value={form.remarks}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Enter any laboratory observations..."
                      className="form-input resize-none"
                    />
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
                    : editingTest
                    ? "Update Test"
                    : "Save Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Milk Test Details
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Sample {selectedTest.sampleNumber}
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
                    Test Result
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getResultClasses(
                      selectedTest.result
                    )}`}
                  >
                    {selectedTest.result}
                  </span>
                </div>

                <Beaker
                  size={32}
                  className="text-primary-600"
                />
              </div>

              <DetailSection title="Collection">
                <DetailItem
                  label="Sample Number"
                  value={selectedTest.sampleNumber}
                />

                <DetailItem
                  label="Farmer"
                  value={getFarmerName(selectedTest)}
                />

                <DetailItem
                  label="Collection Centre"
                  value={
                    selectedTest.milkCollection
                      ?.collectionCentre
                  }
                />

                <DetailItem
                  label="Collection Date"
                  value={formatDate(
                    selectedTest.milkCollection
                      ?.collectionDate
                  )}
                />

                <DetailItem
                  label="Quantity"
                  value={
                    selectedTest.milkCollection
                      ?.quantityLitres
                      ? `${selectedTest.milkCollection.quantityLitres} L`
                      : "—"
                  }
                />
              </DetailSection>

              <DetailSection title="Laboratory Results">
                <DetailItem
                  label="Fat"
                  value={
                    selectedTest.fatPercentage !==
                    undefined
                      ? `${selectedTest.fatPercentage}%`
                      : "—"
                  }
                />

                <DetailItem
                  label="Protein"
                  value={
                    selectedTest.proteinPercentage !==
                    undefined
                      ? `${selectedTest.proteinPercentage}%`
                      : "—"
                  }
                />

                <DetailItem
                  label="SNF"
                  value={
                    selectedTest.snfPercentage !==
                    undefined
                      ? `${selectedTest.snfPercentage}%`
                      : "—"
                  }
                />

                <DetailItem
                  label="Acidity"
                  value={selectedTest.acidity}
                />

                <DetailItem
                  label="Temperature"
                  value={selectedTest.temperature}
                />
              </DetailSection>

              <DetailSection title="Testing Details">
                <DetailItem
                  label="Tested By"
                  value={
                    selectedTest.testedBy?.name ||
                    "—"
                  }
                />

                <DetailItem
                  label="Tested At"
                  value={formatDateTime(
                    selectedTest.testedAt
                  )}
                />

                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-slate-500">
                    Remarks
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {selectedTest.remarks || "No remarks"}
                  </p>
                </div>
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
  icon: Icon,
  valueClass = "text-slate-900",
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
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

        <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
          <Icon size={21} />
        </div>
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
          <span className="ml-1 text-red-500">*</span>
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

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
};

export default MilkTestPage;