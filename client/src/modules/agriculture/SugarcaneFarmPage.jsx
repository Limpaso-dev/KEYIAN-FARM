import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Plus,
  Search,
  Sprout,
  Trash2,
  X,
} from "lucide-react";

import {
  createSugarcaneFarm,
  deleteSugarcaneFarm,
  getSugarcaneFarms,
  updateSugarcaneFarm,
} from "../../services/sugarcane.service";

import { getFarmers } from "../../services/farmer.service";

const emptyForm = {
  farmer: "",
  farmName: "",
  location: "",
  acreage: "",
  variety: "",
  plantingDate: "",
  expectedHarvestDate: "",
  status: "active",
  harvestRecords: [],
};

const SugarcaneFarmPage = () => {
  const [farms, setFarms] = useState([]);
  const [farmers, setFarmers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editingFarm, setEditingFarm] = useState(null);
  const [viewingFarm, setViewingFarm] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      setLoading(true);

      const [farmResponse, farmerResponse] =
        await Promise.all([
          getSugarcaneFarms(),
          getFarmers(),
        ]);

      setFarms(farmResponse.sugarcaneFarms || []);
      setFarmers(farmerResponse.farmers || []);
    } catch (error) {
      console.error(
        "Failed to load sugarcane farm data:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to load sugarcane farm data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredFarms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return farms.filter((farm) => {
      const farmerName = farm.farmer
        ? `${farm.farmer.firstName || ""} ${
            farm.farmer.lastName || ""
          }`
            .trim()
            .toLowerCase()
        : "";

      const matchesSearch =
        !query ||
        farmerName.includes(query) ||
        farm.farmName
          ?.toLowerCase()
          .includes(query) ||
        farm.location
          ?.toLowerCase()
          .includes(query) ||
        farm.variety
          ?.toLowerCase()
          .includes(query) ||
        farm.farmer?.membershipNumber
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        farm.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [farms, search, statusFilter]);

  const totalAcreage = useMemo(
    () =>
      farms.reduce(
        (total, farm) =>
          total + Number(farm.acreage || 0),
        0
      ),
    [farms]
  );

  const totalHarvest = useMemo(
    () =>
      farms.reduce(
        (farmTotal, farm) =>
          farmTotal +
          (farm.harvestRecords || []).reduce(
            (total, record) =>
              total +
              Number(record.quantityTonnes || 0),
            0
          ),
        0
      ),
    [farms]
  );

  const activeFarms = farms.filter(
    (farm) => farm.status === "active"
  ).length;

  const harvestedFarms = farms.filter(
    (farm) => farm.status === "harvested"
  ).length;

  const openCreateModal = () => {
    setEditingFarm(null);
    setForm({
      ...emptyForm,
      harvestRecords: [],
    });
    setShowModal(true);
  };

  const openEditModal = (farm) => {
    setEditingFarm(farm);

    setForm({
      farmer: farm.farmer?._id || farm.farmer || "",
      farmName: farm.farmName || "",
      location: farm.location || "",
      acreage: farm.acreage ?? "",
      variety: farm.variety || "",
      plantingDate: farm.plantingDate
        ? farm.plantingDate.substring(0, 10)
        : "",
      expectedHarvestDate:
        farm.expectedHarvestDate
          ? farm.expectedHarvestDate.substring(
              0,
              10
            )
          : "",
      status: farm.status || "active",
      harvestRecords:
        farm.harvestRecords || [],
    });

    setShowModal(true);
  };

  const openViewModal = (farm) => {
    setViewingFarm(farm);
    setShowViewModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFarm(null);

    setForm({
      ...emptyForm,
      harvestRecords: [],
    });
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setViewingFarm(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const addHarvestRecord = () => {
    setForm((current) => ({
      ...current,
      harvestRecords: [
        ...current.harvestRecords,
        {
          harvestDate: "",
          quantityTonnes: "",
        },
      ],
    }));
  };

  const updateHarvestRecord = (
    index,
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      harvestRecords:
        current.harvestRecords.map(
          (record, recordIndex) =>
            recordIndex === index
              ? {
                  ...record,
                  [field]: value,
                }
              : record
        ),
    }));
  };

  const removeHarvestRecord = (index) => {
    setForm((current) => ({
      ...current,
      harvestRecords:
        current.harvestRecords.filter(
          (_, recordIndex) =>
            recordIndex !== index
        ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.farmer) {
      alert("Please select a farmer.");
      return;
    }

    if (
      !form.acreage ||
      Number(form.acreage) <= 0
    ) {
      alert("Please enter a valid acreage.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        farmer: form.farmer,
        farmName: form.farmName.trim(),
        location: form.location.trim(),
        acreage: Number(form.acreage),
        variety: form.variety.trim(),
        plantingDate:
          form.plantingDate || undefined,
        expectedHarvestDate:
          form.expectedHarvestDate || undefined,
        status: form.status,

        harvestRecords:
          form.harvestRecords
            .filter(
              (record) =>
                record.harvestDate ||
                record.quantityTonnes
            )
            .map((record) => ({
              harvestDate:
                record.harvestDate || undefined,
              quantityTonnes: Number(
                record.quantityTonnes || 0
              ),
            })),
      };

      if (editingFarm) {
        await updateSugarcaneFarm(
          editingFarm._id,
          payload
        );
      } else {
        await createSugarcaneFarm(payload);
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error(
        "Failed to save sugarcane farm:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save sugarcane farm."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (farm) => {
    const farmerName = farm.farmer
      ? `${farm.farmer.firstName || ""} ${
          farm.farmer.lastName || ""
        }`.trim()
      : "this farmer";

    const confirmed = window.confirm(
      `Delete the sugarcane farm record for ${farmerName}?`
    );

    if (!confirmed) return;

    try {
      await deleteSugarcaneFarm(farm._id);
      await loadData();
    } catch (error) {
      console.error(
        "Failed to delete sugarcane farm:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete sugarcane farm."
      );
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <Sprout size={25} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Sugarcane Farming
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage sugarcane farms, planting,
                harvesting and farmer information.
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
          Add Sugarcane Farm
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Total Farms"
          value={farms.length}
        />

        <SummaryCard
          label="Active Farms"
          value={activeFarms}
        />

        <SummaryCard
          label="Harvested"
          value={harvestedFarms}
        />

        <SummaryCard
          label="Total Acreage"
          value={`${totalAcreage.toLocaleString()} acres`}
        />

        <SummaryCard
          label="Total Harvest"
          value={`${totalHarvest.toLocaleString()} tonnes`}
        />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
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
              placeholder="Search farmer, farm, location, variety..."
              className="form-input pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="form-input"
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="harvested">
              Harvested
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <TableHeader>
                  Farmer
                </TableHeader>

                <TableHeader>
                  Farm
                </TableHeader>

                <TableHeader>
                  Location
                </TableHeader>

                <TableHeader>
                  Acreage
                </TableHeader>

                <TableHeader>
                  Variety
                </TableHeader>

                <TableHeader>
                  Planting Date
                </TableHeader>

                <TableHeader>
                  Expected Harvest
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Actions
                </TableHeader>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Loading sugarcane farms...
                  </td>
                </tr>
              ) : filteredFarms.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-12 text-center"
                  >
                    <Sprout
                      size={34}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      No sugarcane farms found
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Add a sugarcane farm or
                      adjust your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFarms.map((farm) => (
                  <tr
                    key={farm._id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {getFarmerName(
                          farm.farmer
                        )}
                      </p>

                      <p className="text-xs text-slate-500">
                        {farm.farmer
                          ?.membershipNumber ||
                          "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {farm.farmName || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {farm.location || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-slate-700">
                      {farm.acreage} acres
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {farm.variety || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {farm.plantingDate
                        ? new Date(
                            farm.plantingDate
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {farm.expectedHarvestDate
                        ? new Date(
                            farm.expectedHarvestDate
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge
                        status={farm.status}
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <ActionButton
                          title="View"
                          onClick={() =>
                            openViewModal(farm)
                          }
                        >
                          <Eye size={16} />
                        </ActionButton>

                        <ActionButton
                          title="Edit"
                          onClick={() =>
                            openEditModal(farm)
                          }
                        >
                          <Edit size={16} />
                        </ActionButton>

                        <ActionButton
                          title="Delete"
                          danger
                          onClick={() =>
                            handleDelete(farm)
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
        <Modal
          title={
            editingFarm
              ? "Edit Sugarcane Farm"
              : "Add Sugarcane Farm"
          }
          onClose={closeModal}
        >
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Farmer *">
                <select
                  name="farmer"
                  value={form.farmer}
                  onChange={handleChange}
                  className="form-input"
                  required
                >
                  <option value="">
                    Select farmer
                  </option>

                  {farmers.map((farmer) => (
                    <option
                      key={farmer._id}
                      value={farmer._id}
                    >
                      {getFarmerName(
                        farmer
                      )}{" "}
                      —{" "}
                      {farmer.membershipNumber}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Farm Name">
                <input
                  name="farmName"
                  value={form.farmName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Main Sugarcane Farm"
                />
              </FormField>

              <FormField label="Location">
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Farm location"
                />
              </FormField>

              <FormField label="Acreage *">
                <input
                  name="acreage"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.acreage}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </FormField>

              <FormField label="Sugarcane Variety">
                <input
                  name="variety"
                  value={form.variety}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. NCo 376"
                />
              </FormField>

              <FormField label="Planting Date">
                <input
                  name="plantingDate"
                  type="date"
                  value={form.plantingDate}
                  onChange={handleChange}
                  className="form-input"
                />
              </FormField>

              <FormField label="Expected Harvest Date">
                <input
                  name="expectedHarvestDate"
                  type="date"
                  value={
                    form.expectedHarvestDate
                  }
                  onChange={handleChange}
                  className="form-input"
                />
              </FormField>

              <FormField label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="harvested">
                    Harvested
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </FormField>
            </div>

            {/* Harvest Records */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Harvest Records
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Record sugarcane harvest
                    quantities.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    addHarvestRecord
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                >
                  <Plus size={15} />
                  Add Record
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {form.harvestRecords
                  .length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                    No harvest records
                    added.
                  </p>
                ) : (
                  form.harvestRecords.map(
                    (
                      record,
                      index
                    ) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <input
                          type="date"
                          value={
                            record.harvestDate ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateHarvestRecord(
                              index,
                              "harvestDate",
                              event.target
                                .value
                            )
                          }
                          className="form-input"
                        />

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            record.quantityTonnes ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateHarvestRecord(
                              index,
                              "quantityTonnes",
                              event.target
                                .value
                            )
                          }
                          placeholder="Quantity (tonnes)"
                          className="form-input"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeHarvestRecord(
                              index
                            )
                          }
                          className="flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50"
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            <ModalActions
              onCancel={closeModal}
              saving={saving}
              submitLabel={
                editingFarm
                  ? "Update Sugarcane Farm"
                  : "Save Sugarcane Farm"
              }
            />
          </form>
        </Modal>
      )}

      {/* View Modal */}
      {showViewModal &&
        viewingFarm && (
          <Modal
            title="Sugarcane Farm Details"
            onClose={closeViewModal}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailItem
                  label="Farmer"
                  value={getFarmerName(
                    viewingFarm.farmer
                  )}
                />

                <DetailItem
                  label="Membership Number"
                  value={
                    viewingFarm.farmer
                      ?.membershipNumber ||
                    "—"
                  }
                />

                <DetailItem
                  label="Farm Name"
                  value={
                    viewingFarm.farmName
                  }
                />

                <DetailItem
                  label="Location"
                  value={
                    viewingFarm.location
                  }
                />

                <DetailItem
                  label="Acreage"
                  value={`${viewingFarm.acreage || 0} acres`}
                />

                <DetailItem
                  label="Variety"
                  value={
                    viewingFarm.variety
                  }
                />

                <DetailItem
                  label="Planting Date"
                  value={
                    viewingFarm.plantingDate
                      ? new Date(
                          viewingFarm.plantingDate
                        ).toLocaleDateString()
                      : "—"
                  }
                />

                <DetailItem
                  label="Expected Harvest"
                  value={
                    viewingFarm.expectedHarvestDate
                      ? new Date(
                          viewingFarm.expectedHarvestDate
                        ).toLocaleDateString()
                      : "—"
                  }
                />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <div className="mt-1">
                    <StatusBadge
                      status={
                        viewingFarm.status
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Harvest Records
                </h3>

                {viewingFarm
                  .harvestRecords?.length ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                    <table className="min-w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <TableHeader>
                            Harvest Date
                          </TableHeader>

                          <TableHeader>
                            Quantity
                          </TableHeader>
                        </tr>
                      </thead>

                      <tbody>
                        {viewingFarm.harvestRecords.map(
                          (
                            record,
                            index
                          ) => (
                            <tr
                              key={index}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {record.harvestDate
                                  ? new Date(
                                      record.harvestDate
                                    ).toLocaleDateString()
                                  : "—"}
                              </td>

                              <td className="px-4 py-3 text-sm text-slate-600">
                                {record.quantityTonnes ||
                                  0}{" "}
                                tonnes
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    No harvest records
                    available.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={
                    closeViewModal
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-2 text-2xl font-bold text-slate-900">
      {value}
    </p>
  </div>
);

const TableHeader = ({
  children,
}) => (
  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
    {children}
  </th>
);

const StatusBadge = ({
  status,
}) => {
  const styles = {
    active:
      "bg-green-100 text-green-700",
    harvested:
      "bg-blue-100 text-blue-700",
    inactive:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        styles[status] ||
        "bg-slate-100 text-slate-600"
      }`}
    >
      {status || "unknown"}
    </span>
  );
};

const ActionButton = ({
  children,
  onClick,
  title,
  danger = false,
}) => (
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

const FormField = ({
  label,
  children,
}) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {label}
    </label>

    {children}
  </div>
);

const DetailItem = ({
  label,
  value,
}) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-1 text-sm font-medium text-slate-800">
      {value || "—"}
    </p>
  </div>
);

const Modal = ({
  title,
  children,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={19} />
        </button>
      </div>

      <div className="p-6">
        {children}
      </div>
    </div>
  </div>
);

const ModalActions = ({
  onCancel,
  saving,
  submitLabel,
}) => (
  <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
    <button
      type="button"
      onClick={onCancel}
      disabled={saving}
      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      Cancel
    </button>

    <button
      type="submit"
      disabled={saving}
      className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saving
        ? "Saving..."
        : submitLabel}
    </button>
  </div>
);

export default SugarcaneFarmPage;