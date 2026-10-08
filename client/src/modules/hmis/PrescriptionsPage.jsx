import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Loader2,
  Pill,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  createPrescription,
  deletePrescription,
  getPrescriptions,
  updatePrescription,
} from "../../services/prescription.service";

import { getPatients } from "../../services/medicalPatient.service";

import { getMedicalVisits } from "../../services/medicalVisit.service";
import { useAuth } from "../../context/useAuth";
import PatientProfilePanel from "../../components/hmis/PatientProfilePanel";

const emptyMedication = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  instructions: "",
};

const initialForm = {
  patient: "",
  visit: "",
  medications: [{ ...emptyMedication }],
  status: "prescribed",
};

const PrescriptionsPage = () => {
  const { user } = useAuth();
  const isDoctor = ["doctor", "admin", "super_admin"].includes(user?.role);
  const isPharmacyStaff = ["pharmacist", "pharmacy"].includes(user?.role);
  const [prescriptions, setPrescriptions] =
    useState([]);

  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [selectedPrescription, setSelectedPrescription] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getPrescriptions();

      setPrescriptions(response?.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load prescriptions."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const response = await getPatients();

      setPatients(response?.data || []);
    } catch (err) {
      console.error(err);

      setPatients([]);
    }
  };

  const loadVisits = async () => {
    try {
      const response = await getMedicalVisits();

      setVisits(response?.data || []);
    } catch (err) {
      console.error(err);

      setVisits([]);
    }
  };

  useEffect(() => {
    loadPrescriptions();
    loadPatients();
    loadVisits();
  }, []);

  // =====================================================
  // FORM HANDLERS
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleMedicationChange = (
    index,
    e
  ) => {
    const { name, value } = e.target;

    setForm((previous) => {
      const medications = [
        ...previous.medications,
      ];

      medications[index] = {
        ...medications[index],
        [name]: value,
      };

      return {
        ...previous,
        medications,
      };
    });
  };

  const addMedication = () => {
    setForm((previous) => ({
      ...previous,
      medications: [
        ...previous.medications,
        { ...emptyMedication },
      ],
    }));
  };

  const removeMedication = (index) => {
    setForm((previous) => {
      if (previous.medications.length === 1) {
        return previous;
      }

      return {
        ...previous,
        medications: previous.medications.filter(
          (_, medicationIndex) =>
            medicationIndex !== index
        ),
      };
    });
  };

  const resetForm = () => {
    setForm({
      ...initialForm,
      medications: [{ ...emptyMedication }],
    });

    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();

    setError("");
    setSuccess("");

    setShowForm(true);
  };

  const openEditForm = (prescription) => {
    setError("");
    setSuccess("");

    setEditingId(prescription._id);

    setForm({
      patient:
        prescription.patient?._id ||
        prescription.patient ||
        "",

      visit:
        prescription.visit?._id ||
        prescription.visit ||
        "",

      medications:
        prescription.medications?.length
          ? prescription.medications.map(
              (medication) => ({
                name: medication.name || "",
                dosage:
                  medication.dosage || "",
                frequency:
                  medication.frequency ||
                  "",
                duration:
                  medication.duration ||
                  "",
                quantity:
                  medication.quantity ??
                  "",
                instructions:
                  medication.instructions ||
                  "",
              })
            )
          : [{ ...emptyMedication }],

      status:
        prescription.status ||
        "prescribed",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    resetForm();
  };

  // =====================================================
  // CREATE / UPDATE
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.patient) {
      setError("Please select a patient.");
      return;
    }

    const validMedications =
      form.medications.filter(
        (medication) =>
          medication.name.trim() !== ""
      );

    if (validMedications.length === 0) {
      setError(
        "Please add at least one medication."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        patient: form.patient,

        medications: validMedications.map(
          (medication) => ({
            name: medication.name.trim(),
            dosage: medication.dosage.trim(),
            frequency:
              medication.frequency.trim(),
            duration:
              medication.duration.trim(),
            quantity:
              medication.quantity === ""
                ? undefined
                : Number(
                    medication.quantity
                  ),
            instructions:
              medication.instructions.trim(),
          })
        ),

        status: form.status,
      };

      // Visit is optional according to the schema.
      if (form.visit) {
        payload.visit = form.visit;
      }

      if (editingId) {
        await updatePrescription(
          editingId,
          payload
        );

        setSuccess(
          "Prescription updated successfully."
        );
      } else {
        await createPrescription(payload);

        setSuccess(
          "Prescription created successfully."
        );
      }

      await loadPrescriptions();

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save prescription."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (
    prescription
  ) => {
    const patientName = getPatientName(
      prescription.patient
    );

    const confirmed = window.confirm(
      `Delete the prescription for ${patientName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deletePrescription(
        prescription._id
      );

      setSuccess(
        "Prescription deleted successfully."
      );

      await loadPrescriptions();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete prescription."
      );
    }
  };

  const handleDispense = async (prescription) => {
    try {
      setError("");
      setSuccess("");
      await updatePrescription(prescription._id, { status: "dispensed" });
      setSuccess("Prescription marked as dispensed.");
      await loadPrescriptions();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to dispense this prescription.");
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const openView = (prescription) => {
    setSelectedPrescription(
      prescription
    );

    setShowView(true);
  };

  const closeView = () => {
    setShowView(false);
    setSelectedPrescription(null);
  };

  // =====================================================
  // FILTERING
  // =====================================================

  const filteredPrescriptions = useMemo(() => {
    const searchTerm = search
      .trim()
      .toLowerCase();

    return prescriptions.filter(
      (prescription) => {
        const patientName =
          getPatientName(
            prescription.patient
          ).toLowerCase();

        const patientNumber =
          prescription.patient?.patientNumber?.toLowerCase() ||
          "";

        const medicationNames =
          prescription.medications
            ?.map(
              (medication) =>
                medication.name
            )
            .join(" ")
            .toLowerCase() || "";

        const matchesSearch =
          !searchTerm ||
          patientName.includes(
            searchTerm
          ) ||
          patientNumber.includes(
            searchTerm
          ) ||
          medicationNames.includes(
            searchTerm
          );

        const matchesStatus =
          statusFilter === "all" ||
          prescription.status ===
            statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }, [
    prescriptions,
    search,
    statusFilter,
  ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalPrescriptions =
    prescriptions.length;

  const prescribedCount =
    prescriptions.filter(
      (prescription) =>
        prescription.status ===
        "prescribed"
    ).length;

  const dispensedCount =
    prescriptions.filter(
      (prescription) =>
        prescription.status ===
        "dispensed"
    ).length;

  const cancelledCount =
    prescriptions.filter(
      (prescription) =>
        prescription.status ===
        "cancelled"
    ).length;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-600">
            <Pill size={18} />
            HMIS / Prescriptions
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Prescriptions
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create and manage patient prescriptions,
            medications, dosage instructions, and
            dispensing status.
          </p>
        </div>

        {isDoctor && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus size={18} />
            New Prescription
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError("")}
        />
      )}

      {success && (
        <Alert
          type="success"
          message={success}
          onClose={() => setSuccess("")}
        />
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Prescriptions"
          value={totalPrescriptions}
          icon={Pill}
        />

        <SummaryCard
          label="Prescribed"
          value={prescribedCount}
          icon={Pill}
        />

        <SummaryCard
          label="Dispensed"
          value={dispensedCount}
          icon={Pill}
        />

        <SummaryCard
          label="Cancelled"
          value={cancelledCount}
          icon={Pill}
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search patient, patient number or medication..."
              className="form-input pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="form-input"
          >
            <option value="all">
              All Statuses
            </option>

            <option value="prescribed">
              Prescribed
            </option>

            <option value="dispensed">
              Dispensed
            </option>

            <option value="cancelled">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            Prescription Records
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing{" "}
            {filteredPrescriptions.length}{" "}
            of {prescriptions.length}{" "}
            prescriptions
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Loading prescriptions...
            </div>
          </div>
        ) : filteredPrescriptions.length ===
          0 ? (
          <EmptyState
            search={search}
            onCreate={openCreateForm}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>
                    Patient
                  </TableHeading>

                  <TableHeading>
                    Medications
                  </TableHeading>

                  <TableHeading>
                    Visit
                  </TableHeading>

                  <TableHeading>
                    Prescribed By
                  </TableHeading>

                  <TableHeading>
                    Status
                  </TableHeading>

                  <TableHeading align="right">
                    Actions
                  </TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPrescriptions.map(
                  (prescription) => (
                    <tr
                      key={prescription._id}
                      className="transition hover:bg-slate-50"
                    >
                      {/* Patient */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {getPatientName(
                              prescription.patient
                            )}
                          </p>

                          <p className="text-xs text-slate-500">
                            {prescription
                              .patient
                              ?.patientNumber ||
                              "—"}
                          </p>
                        </div>
                      </td>

                      {/* Medications */}
                      <td className="max-w-[280px] px-5 py-4">
                        <div className="space-y-1">
                          {prescription.medications
                            ?.slice(0, 2)
                            .map(
                              (
                                medication,
                                index
                              ) => (
                                <p
                                  key={`${medication.name}-${index}`}
                                  className="truncate text-sm text-slate-700"
                                >
                                  <span className="font-medium">
                                    {
                                      medication.name
                                    }
                                  </span>

                                  {medication.dosage && (
                                    <span className="text-slate-500">
                                      {" "}
                                      —{" "}
                                      {
                                        medication.dosage
                                      }
                                    </span>
                                  )}
                                </p>
                              )
                            )}

                          {prescription
                            .medications
                            ?.length >
                            2 && (
                            <p className="text-xs font-medium text-primary-600">
                              +
                              {prescription
                                .medications
                                .length -
                                2}{" "}
                              more
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Visit */}
                      <td className="whitespace-nowrap px-5 py-4">
                        {prescription.visit ? (
                          <div>
                            <p className="text-sm text-slate-700">
                              {formatDate(
                                prescription
                                  .visit
                                  .visitDate
                              )}
                            </p>

                            <p className="text-xs text-slate-500">
                              {formatVisitType(
                                prescription
                                  .visit
                                  .visitType
                              )}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            No linked visit
                          </span>
                        )}
                      </td>

                      {/* Prescriber */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {prescription
                              .prescribedBy
                              ?.name ||
                              "—"}
                          </p>

                          {prescription
                            .prescribedBy
                            ?.role && (
                            <p className="text-xs text-slate-500">
                              {formatRole(
                                prescription
                                  .prescribedBy
                                  .role
                              )}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <StatusBadge
                          status={
                            prescription.status
                          }
                        />
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <ActionButton
                            title="View prescription"
                            onClick={() =>
                              openView(
                                prescription
                              )
                            }
                          >
                            <Eye size={17} />
                          </ActionButton>

                          {isDoctor && (
                            <ActionButton
                              title="Edit prescription"
                              onClick={() => openEditForm(prescription)}
                            >
                              <Edit size={17} />
                            </ActionButton>
                          )}
                          {isPharmacyStaff && prescription.status === "prescribed" && (
                            <ActionButton
                              title="Mark prescription as dispensed"
                              onClick={() => handleDispense(prescription)}
                            >
                              <Pill size={17} />
                            </ActionButton>
                          )}
                          {["admin", "super_admin"].includes(user?.role) && (
                            <ActionButton
                              title="Void prescription"
                              danger
                              onClick={() => handleDelete(prescription)}
                            >
                              <Trash2 size={17} />
                            </ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <PrescriptionFormModal
          form={form}
          patients={patients}
          visits={visits}
          editingId={editingId}
          saving={saving}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onChange={handleChange}
          onMedicationChange={
            handleMedicationChange
          }
          onAddMedication={
            addMedication
          }
          onRemoveMedication={
            removeMedication
          }
        />
      )}

      {/* View Modal */}
      {showView &&
        selectedPrescription && (
          <PrescriptionViewModal
            prescription={
              selectedPrescription
            }
            onClose={closeView}
          />
        )}
    </div>
  );
};

// =====================================================
// PRESCRIPTION FORM MODAL
// =====================================================

const PrescriptionFormModal = ({
  form,
  patients,
  visits,
  editingId,
  saving,
  onClose,
  onSubmit,
  onChange,
  onMedicationChange,
  onAddMedication,
  onRemoveMedication,
}) => {
  const selectedPatientVisits =
    form.patient
      ? visits.filter((visit) => {
          const patientId =
            visit.patient?._id ||
            visit.patient;

          return patientId === form.patient;
        })
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? "Edit Prescription"
                : "New Prescription"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Prescribe one or more medications for a
              patient.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="space-y-6 p-6">
            {/* Patient / Visit */}
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Patient & Visit
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="Patient"
                  required
                >
                  <select
                    name="patient"
                    value={form.patient}
                    onChange={onChange}
                    className="form-input"
                    required
                  >
                    <option value="">
                      Select patient
                    </option>

                    {patients.map((patient) => (
                      <option
                        key={patient._id}
                        value={patient._id}
                      >
                        {patient.patientNumber} —{" "}
                        {patient.firstName}{" "}
                        {patient.lastName}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Medical Visit">
                  <select
                    name="visit"
                    value={form.visit}
                    onChange={onChange}
                    className="form-input"
                    disabled={!form.patient}
                  >
                    <option value="">
                      {form.patient
                        ? "No linked visit"
                        : "Select a patient first"}
                    </option>

                    {selectedPatientVisits.map(
                      (visit) => (
                        <option
                          key={visit._id}
                          value={visit._id}
                        >
                          {formatDate(
                            visit.visitDate
                          )}{" "}
                          —{" "}
                          {formatVisitType(
                            visit.visitType
                          )}
                        </option>
                      )
                    )}
                  </select>
                </FormField>

                <FormField label="Prescription Status">
                  <select
                    name="status"
                    value={form.status}
                    onChange={onChange}
                    className="form-input"
                  >
                    <option value="prescribed">
                      Prescribed
                    </option>

                    <option value="dispensed">
                      Dispensed
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </FormField>
              </div>
            </section>

            {/* Medications */}
            <section className="border-t border-slate-200 pt-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Medications
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Add all medications included in
                    this prescription.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onAddMedication}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"
                >
                  <Plus size={16} />
                  Add Medication
                </button>
              </div>

              <div className="space-y-4">
                {form.medications.map(
                  (medication, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800">
                          Medication{" "}
                          {index + 1}
                        </h4>

                        {form.medications
                          .length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onRemoveMedication(
                                index
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2
                              size={14}
                            />
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          label="Medicine Name"
                          required
                        >
                          <input
                            name="name"
                            value={
                              medication.name
                            }
                            onChange={(e) =>
                              onMedicationChange(
                                index,
                                e
                              )
                            }
                            className="form-input"
                            placeholder="e.g. Amoxicillin"
                            required
                          />
                        </FormField>

                        <FormField label="Dosage">
                          <input
                            name="dosage"
                            value={
                              medication.dosage
                            }
                            onChange={(e) =>
                              onMedicationChange(
                                index,
                                e
                              )
                            }
                            className="form-input"
                            placeholder="e.g. 500 mg"
                          />
                        </FormField>

                        <FormField label="Frequency">
                          <input
                            name="frequency"
                            value={
                              medication.frequency
                            }
                            onChange={(e) =>
                              onMedicationChange(
                                index,
                                e
                              )
                            }
                            className="form-input"
                            placeholder="e.g. 3 times daily"
                          />
                        </FormField>

                        <FormField label="Duration">
                          <input
                            name="duration"
                            value={
                              medication.duration
                            }
                            onChange={(e) =>
                              onMedicationChange(
                                index,
                                e
                              )
                            }
                            className="form-input"
                            placeholder="e.g. 7 days"
                          />
                        </FormField>

                        <FormField label="Quantity">
                          <input
                            type="number"
                            min="0"
                            name="quantity"
                            value={
                              medication.quantity
                            }
                            onChange={(e) =>
                              onMedicationChange(
                                index,
                                e
                              )
                            }
                            className="form-input"
                            placeholder="Quantity"
                          />
                        </FormField>

                        <FormField label="Instructions">
                          <input
                            name="instructions"
                            value={
                              medication.instructions
                            }
                            onChange={(e) =>
                              onMedicationChange(
                                index,
                                e
                              )
                            }
                            className="form-input"
                            placeholder="e.g. Take after meals"
                          />
                        </FormField>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* Prescriber */}
            <section className="rounded-lg border border-orange-100 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <Pill
                  size={20}
                  className="mt-0.5 text-orange-600"
                />

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Prescriber
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    The logged-in ERP user will
                    automatically be recorded as the
                    prescriber.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving && (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              )}

              {editingId
                ? "Update Prescription"
                : "Save Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================
// PRESCRIPTION VIEW MODAL
// =====================================================

const PrescriptionViewModal = ({
  prescription,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-primary-600">
              Prescription
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">Prescription details</h2>

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(prescription.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <PatientProfilePanel patient={prescription.patient} />
          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </p>

              <div className="mt-2">
                <StatusBadge
                  status={
                    prescription.status
                  }
                />
              </div>
            </div>

            <DetailItem
              label="Prescription Date"
              value={formatDate(
                prescription.createdAt
              )}
            />
          </div>

          {/* Linked Visit */}
          {prescription.visit && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Linked Medical Visit
              </h3>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">
                  {formatDate(
                    prescription.visit
                      .visitDate
                  )}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {formatVisitType(
                    prescription.visit
                      .visitType
                  )}
                </p>

                {prescription.visit
                  .diagnosis && (
                  <p className="mt-2 text-sm text-slate-600">
                    Diagnosis:{" "}
                    {
                      prescription.visit
                        .diagnosis
                    }
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Medications */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Medications
              </h3>

              <span className="text-xs font-medium text-slate-500">
                {prescription.medications
                  ?.length || 0}{" "}
                medication(s)
              </span>
            </div>

            <div className="space-y-3">
              {prescription.medications?.map(
                (medication, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {medication.name ||
                            "Unnamed medication"}
                        </p>

                        {medication.dosage && (
                          <p className="mt-1 text-sm text-slate-600">
                            Dosage:{" "}
                            {
                              medication.dosage
                            }
                          </p>
                        )}
                      </div>

                      {medication.quantity !==
                        undefined &&
                        medication.quantity !==
                          null && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Qty:{" "}
                            {
                              medication.quantity
                            }
                          </span>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <DetailItem
                        label="Frequency"
                        value={
                          medication.frequency
                        }
                      />

                      <DetailItem
                        label="Duration"
                        value={
                          medication.duration
                        }
                      />

                      <DetailItem
                        label="Instructions"
                        value={
                          medication.instructions
                        }
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Prescriber */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Prescribed By
            </h3>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">
                {prescription
                  .prescribedBy?.name ||
                  "—"}
              </p>

              {prescription
                .prescribedBy?.role && (
                <p className="mt-1 text-sm text-slate-500">
                  {formatRole(
                    prescription
                      .prescribedBy
                      .role
                  )}
                </p>
              )}

              {prescription
                .prescribedBy?.email && (
                <p className="mt-1 text-sm text-slate-500">
                  {
                    prescription
                      .prescribedBy
                      .email
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// SUMMARY CARD
// =====================================================

const SummaryCard = ({
  label,
  value,
  icon: Icon,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// ALERT
// =====================================================

const Alert = ({
  type,
  message,
  onClose,
}) => {
  const isError = type === "error";

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
        className={
          isError
            ? "text-red-500 hover:text-red-700"
            : "text-emerald-500 hover:text-emerald-700"
        }
      >
        <X size={17} />
      </button>
    </div>
  );
};

// =====================================================
// EMPTY STATE
// =====================================================

const EmptyState = ({
  search,
  onCreate,
}) => {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
      <div className="rounded-full bg-slate-100 p-4 text-slate-400">
        <Pill size={28} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">
        No prescriptions found
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500">
        {search
          ? "Try changing your search or filter."
          : "No prescriptions have been recorded yet."}
      </p>

      {!search && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={17} />
          Create First Prescription
        </button>
      )}
    </div>
  );
};

// =====================================================
// FORM FIELD
// =====================================================

const FormField = ({
  label,
  required = false,
  children,
}) => {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
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

// =====================================================
// DETAIL ITEM
// =====================================================

const DetailItem = ({
  label,
  value,
}) => {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
};

// =====================================================
// TABLE HEADING
// =====================================================

const TableHeading = ({
  children,
  align = "left",
}) => {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
};

// =====================================================
// ACTION BUTTON
// =====================================================

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

// =====================================================
// STATUS BADGE
// =====================================================

const StatusBadge = ({ status }) => {
  const config = {
    prescribed: {
      label: "Prescribed",
      className:
        "bg-blue-50 text-blue-700",
    },

    dispensed: {
      label: "Dispensed",
      className:
        "bg-emerald-50 text-emerald-700",
    },

    cancelled: {
      label: "Cancelled",
      className:
        "bg-slate-100 text-slate-600",
    },
  };

  const current =
    config[status] || {
      label: status || "Unknown",
      className:
        "bg-slate-100 text-slate-700",
    };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${current.className}`}
    >
      {current.label}
    </span>
  );
};

// =====================================================
// HELPERS
// =====================================================

const getPatientName = (patient) => {
  if (!patient) return "Unknown Patient";

  if (typeof patient === "string") {
    return patient;
  }

  return `${patient.firstName || ""} ${
    patient.lastName || ""
  }`.trim() || "Unknown Patient";
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

const formatVisitType = (type) => {
  const labels = {
    outpatient: "Outpatient",
    follow_up: "Follow Up",
    emergency: "Emergency",
  };

  return (
    labels[type] ||
    type ||
    "Unknown"
  );
};

const formatRole = (role) => {
  if (!role) return "";

  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
};

export default PrescriptionsPage;
