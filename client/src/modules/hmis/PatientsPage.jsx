import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  createPatient,
  deletePatient,
  getPatientById,
  getPatients,
  updatePatient,
} from "../../services/medicalPatient.service";

import { getFarmers } from "../../services/farmer.service";
import { useAuth } from "../../context/useAuth";

const initialForm = {
  patientNumber: "",
  farmer: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  estimatedAge: "",
  sex: "",
  phone: "",
  nationalId: "",
  address: "",
  payer: "cash",
  payerDetails: {
    scheme: "",
    memberNumber: "",
    principalMember: "",
    validityStart: "",
    validityEnd: "",
    limit: "",
  },
  consentAcknowledged: false,
  nextOfKin: {
    name: "",
    phone: "",
    relationship: "",
  },
};

const PatientsPage = () => {
  const { user } = useAuth();
  const canRegisterPatients = ["admin", "super_admin", "receptionist"].includes(user?.role);
  const canEditPatients = ["admin", "super_admin", "receptionist"].includes(user?.role);
  const canVoidPatients = ["admin", "super_admin"].includes(user?.role);
  const canViewFarmers = !["pharmacist", "pharmacy"].includes(user?.role);
  const [patients, setPatients] = useState([]);
  const [farmers, setFarmers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [selectedPatient, setSelectedPatient] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getPatients();

      setPatients(response?.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load patients."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadFarmers = async () => {
    try {
      const response = await getFarmers();

      setFarmers(response?.data || []);
    } catch (err) {
      console.error(err);

      // Farmer linking should not prevent the patient
      // registry from loading.
      setFarmers([]);
    }
  };

  useEffect(() => {
    loadPatients();
    if (canViewFarmers) loadFarmers();
  }, [canViewFarmers]);

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

  const handleNextOfKinChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      nextOfKin: {
        ...previous.nextOfKin,
        [name]: value,
      },
    }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (patient) => {
    setError("");
    setSuccess("");

    setEditingId(patient._id);

    setForm({
      patientNumber: patient.patientNumber || "",
      farmer: patient.farmer?._id || patient.farmer || "",
      firstName: patient.firstName || "",
      lastName: patient.lastName || "",
      dateOfBirth: patient.dateOfBirth
        ? patient.dateOfBirth.substring(0, 10)
        : "",
      estimatedAge: patient.estimatedAge || "",
      sex: patient.sex || "",
      phone: patient.phone || "",
      nationalId: patient.nationalId || "",
      address: patient.address || "",
      payer: patient.payer || "cash",
      payerDetails: {
        scheme: patient.payerDetails?.scheme || "",
        memberNumber: patient.payerDetails?.memberNumber || "",
        principalMember: patient.payerDetails?.principalMember || "",
        validityStart: patient.payerDetails?.validityStart
          ? patient.payerDetails.validityStart.substring(0, 10)
          : "",
        validityEnd: patient.payerDetails?.validityEnd
          ? patient.payerDetails.validityEnd.substring(0, 10)
          : "",
        limit: patient.payerDetails?.limit || "",
      },
      consentAcknowledged: Boolean(patient.consentAcknowledged),
      nextOfKin: {
        name: patient.nextOfKin?.name || "",
        phone: patient.nextOfKin?.phone || "",
        relationship:
          patient.nextOfKin?.relationship || "",
      },
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

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        patientNumber: form.patientNumber.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        estimatedAge: form.estimatedAge
          ? Number(form.estimatedAge)
          : undefined,
        sex: form.sex || undefined,
        phone: form.phone.trim(),
        nationalId: form.nationalId.trim(),
        address: form.address.trim(),
        payer: form.payer || "cash",
        payerDetails: {
          scheme: form.payerDetails.scheme.trim(),
          memberNumber: form.payerDetails.memberNumber.trim(),
          principalMember:
            form.payerDetails.principalMember.trim(),
          validityStart:
            form.payerDetails.validityStart || undefined,
          validityEnd:
            form.payerDetails.validityEnd || undefined,
          limit: form.payerDetails.limit
            ? Number(form.payerDetails.limit)
            : undefined,
        },
        consentAcknowledged: Boolean(form.consentAcknowledged),
        nextOfKin: {
          name: form.nextOfKin.name.trim(),
          phone: form.nextOfKin.phone.trim(),
          relationship:
            form.nextOfKin.relationship.trim(),
        },
      };

      if (form.farmer) {
        payload.farmer = form.farmer;
      }

      if (editingId) {
        await updatePatient(editingId, payload);

        setSuccess(
          "Patient updated successfully."
        );
      } else {
        await createPatient(payload);

        setSuccess(
          "Patient registered successfully."
        );
      }

      await loadPatients();

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save patient."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (patient) => {
    const confirmed = window.confirm(
      `Delete patient ${patient.firstName} ${patient.lastName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deletePatient(patient._id);

      setSuccess(
        "Patient deleted successfully."
      );

      await loadPatients();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete patient."
      );
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const openView = async (patient) => {
    setSelectedPatient(patient);
    setShowView(true);
    setViewLoading(true);
    setViewError("");

    try {
      const response = await getPatientById(patient._id);
      setSelectedPatient(response?.data || patient);
    } catch (err) {
      setViewError(err.response?.data?.message || "Failed to load patient history.");
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setShowView(false);
    setSelectedPatient(null);
    setViewError("");
  };

  // =====================================================
  // FILTERING
  // =====================================================

  const filteredPatients = useMemo(() => {
    const searchTerm = search
      .trim()
      .toLowerCase();

    return patients.filter((patient) => {
      const fullName =
        `${patient.firstName || ""} ${
          patient.lastName || ""
        }`.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        fullName.includes(searchTerm) ||
        patient.patientNumber
          ?.toLowerCase()
          .includes(searchTerm) ||
        patient.phone
          ?.toLowerCase()
          .includes(searchTerm) ||
        patient.farmer?.membershipNumber
          ?.toLowerCase()
          .includes(searchTerm);

      const matchesSex =
        sexFilter === "all" ||
        patient.sex === sexFilter;

      return matchesSearch && matchesSex;
    });
  }, [patients, search, sexFilter]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalPatients = patients.length;

  const malePatients = patients.filter(
    (patient) => patient.sex === "male"
  ).length;

  const femalePatients = patients.filter(
    (patient) => patient.sex === "female"
  ).length;

  const farmerLinkedPatients = patients.filter(
    (patient) => patient.farmer
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
            <Users size={18} />
            HMIS / Patients
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Patient Registry
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {canRegisterPatients
              ? "Register and manage patients attending the Keiyian Medical Centre."
              : "View patient demographics and clinical history."}
          </p>
        </div>

        {canRegisterPatients && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus size={18} />
            Register Patient
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Patients"
          value={totalPatients}
          icon={Users}
        />

        <SummaryCard
          label="Male"
          value={malePatients}
          icon={Users}
        />

        <SummaryCard
          label="Female"
          value={femalePatients}
          icon={Users}
        />

        <SummaryCard
          label="Farmer Linked"
          value={farmerLinkedPatients}
          icon={UserPlus}
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
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
              placeholder="Search by patient name, number, phone or farmer membership..."
              className="form-input pl-10"
            />
          </div>

          <select
            value={sexFilter}
            onChange={(e) =>
              setSexFilter(e.target.value)
            }
            className="form-input"
          >
            <option value="all">All Sexes</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Patient Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            Registered Patients
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredPatients.length} of{" "}
            {patients.length} patients
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Loading patients...
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-400">
              <Users size={28} />
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              No patients found
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              {search
                ? "Try changing your search or filter."
                : "No patients have been registered yet."}
            </p>

            {!search && canRegisterPatients && (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <Plus size={17} />
                Register First Patient
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>
                    Patient
                  </TableHeading>

                  <TableHeading>
                    Patient No.
                  </TableHeading>

                  <TableHeading>
                    Sex
                  </TableHeading>

                  <TableHeading>
                    Phone
                  </TableHeading>

                  <TableHeading>
                    Farmer
                  </TableHeading>

                  <TableHeading align="right">
                    Actions
                  </TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">
                          {patient.firstName
                            ?.charAt(0)
                            ?.toUpperCase()}
                          {patient.lastName
                            ?.charAt(0)
                            ?.toUpperCase()}
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">
                            {patient.firstName}{" "}
                            {patient.lastName}
                          </p>

                          {patient.dateOfBirth && (
                            <p className="text-xs text-slate-500">
                              DOB:{" "}
                              {formatDate(
                                patient.dateOfBirth
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">
                      {patient.patientNumber}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {capitalize(
                        patient.sex
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {patient.phone || "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {patient.farmer ? (
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {
                              patient.farmer
                                .firstName
                            }{" "}
                            {
                              patient.farmer
                                .lastName
                            }
                          </p>

                          <p className="text-xs text-slate-500">
                            {
                              patient.farmer
                                .membershipNumber
                            }
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">
                          Not linked
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <ActionButton
                          title="View patient"
                          onClick={() =>
                            openView(patient)
                          }
                        >
                          <Eye size={17} />
                        </ActionButton>

                        {canEditPatients && (
                          <>
                            <ActionButton
                              title="Edit patient"
                              onClick={() => openEditForm(patient)}
                            >
                              <Edit size={17} />
                            </ActionButton>

                            {canVoidPatients && (
                              <ActionButton
                                title="Void patient"
                                danger
                                onClick={() => handleDelete(patient)}
                              >
                                <Trash2 size={17} />
                              </ActionButton>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <PatientFormModal
          form={form}
          setForm={setForm}
          farmers={farmers}
          editingId={editingId}
          saving={saving}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onChange={handleChange}
          onNextOfKinChange={
            handleNextOfKinChange
          }
        />
      )}

      {/* View Modal */}
      {showView && selectedPatient && (
        <PatientViewModal
          patient={selectedPatient}
          loading={viewLoading}
          error={viewError}
          onClose={closeView}
        />
      )}
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
// PATIENT FORM MODAL
// =====================================================

const PatientFormModal = ({
  form,
  setForm,
  farmers,
  editingId,
  saving,
  onClose,
  onSubmit,
  onChange,
  onNextOfKinChange,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? "Edit Patient"
                : "Register Patient"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingId
                ? "Update the patient's registration information."
                : "Enter the patient's registration information."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div className="space-y-6 p-6">
            {/* Patient Information */}
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Patient Information
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Patient Number">
                  <input
                    name="patientNumber"
                    value={form.patientNumber}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Auto-generated if left blank"
                  />
                </FormField>

                <FormField label="Linked Farmer">
                  <select
                    name="farmer"
                    value={form.farmer}
                    onChange={onChange}
                    className="form-input"
                  >
                    <option value="">
                      Not linked to a farmer
                    </option>

                    {farmers.map((farmer) => (
                      <option
                        key={farmer._id}
                        value={farmer._id}
                      >
                        {farmer.membershipNumber} —{" "}
                        {farmer.firstName}{" "}
                        {farmer.lastName}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="First Name"
                  required
                >
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={onChange}
                    className="form-input"
                    placeholder="First name"
                    required
                  />
                </FormField>

                <FormField
                  label="Last Name"
                  required
                >
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Last name"
                    required
                  />
                </FormField>

                <FormField label="Date of Birth">
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={form.dateOfBirth}
                    onChange={onChange}
                    className="form-input"
                  />
                </FormField>

                <FormField label="Estimated Age">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    name="estimatedAge"
                    value={form.estimatedAge}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Age in years"
                  />
                </FormField>

                <FormField label="Sex">
                  <select
                    name="sex"
                    value={form.sex}
                    onChange={onChange}
                    className="form-input"
                  >
                    <option value="">
                      Select sex
                    </option>
                    <option value="male">
                      Male
                    </option>
                    <option value="female">
                      Female
                    </option>
                    <option value="other">
                      Other
                    </option>
                  </select>
                </FormField>

                <FormField label="Phone">
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Phone number"
                  />
                </FormField>

                <FormField label="National ID / Birth Certificate number">
                  <input
                    name="nationalId"
                    value={form.nationalId}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Unique ID or birth certificate number"
                  />
                </FormField>

                <FormField label="Address">
                  <input
                    name="address"
                    value={form.address}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Residential address"
                  />
                </FormField>

                <FormField label="Payer Type">
                  <select
                    name="payer"
                    value={form.payer}
                    onChange={onChange}
                    className="form-input"
                  >
                    <option value="cash">Cash</option>
                    <option value="insurance">
                      Insurance
                    </option>
                    <option value="corporate">
                      Corporate
                    </option>
                    <option value="scheme">Scheme</option>
                  </select>
                </FormField>

                <FormField label="Scheme/Provider">
                  <input
                    name="scheme"
                    value={form.payerDetails.scheme}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payerDetails: {
                          ...previous.payerDetails,
                          scheme: event.target.value,
                        },
                      }))
                    }
                    className="form-input"
                    placeholder="e.g. NHIF / Insurance"
                  />
                </FormField>

                <FormField label="Member Number">
                  <input
                    name="memberNumber"
                    value={form.payerDetails.memberNumber}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payerDetails: {
                          ...previous.payerDetails,
                          memberNumber: event.target.value,
                        },
                      }))
                    }
                    className="form-input"
                    placeholder="Member number"
                  />
                </FormField>

                <FormField label="Principal Member">
                  <input
                    name="principalMember"
                    value={form.payerDetails.principalMember}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payerDetails: {
                          ...previous.payerDetails,
                          principalMember: event.target.value,
                        },
                      }))
                    }
                    className="form-input"
                    placeholder="Principal member name"
                  />
                </FormField>

                <FormField label="Validity Start">
                  <input
                    type="date"
                    name="validityStart"
                    value={form.payerDetails.validityStart}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payerDetails: {
                          ...previous.payerDetails,
                          validityStart: event.target.value,
                        },
                      }))
                    }
                    className="form-input"
                  />
                </FormField>

                <FormField label="Validity End">
                  <input
                    type="date"
                    name="validityEnd"
                    value={form.payerDetails.validityEnd}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payerDetails: {
                          ...previous.payerDetails,
                          validityEnd: event.target.value,
                        },
                      }))
                    }
                    className="form-input"
                  />
                </FormField>

                <FormField label="Coverage Limit">
                  <input
                    type="number"
                    min="0"
                    name="limit"
                    value={form.payerDetails.limit}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payerDetails: {
                          ...previous.payerDetails,
                          limit: event.target.value,
                        },
                      }))
                    }
                    className="form-input"
                    placeholder="Optional limit"
                  />
                </FormField>
              </div>
            </section>

            {/* Consent & Next of Kin */}
            <section className="border-t border-slate-200 pt-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Consent & Next of Kin
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.consentAcknowledged}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          consentAcknowledged:
                            event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Patient consent has been explained and acknowledged.
                  </label>
                </div>

                <FormField label="Name">
                  <input
                    name="name"
                    value={form.nextOfKin.name}
                    onChange={onNextOfKinChange}
                    className="form-input"
                    placeholder="Full name"
                  />
                </FormField>

                <FormField label="Phone">
                  <input
                    type="tel"
                    name="phone"
                    value={form.nextOfKin.phone}
                    onChange={onNextOfKinChange}
                    className="form-input"
                    placeholder="Phone number"
                  />
                </FormField>

                <FormField label="Relationship">
                  <input
                    name="relationship"
                    value={
                      form.nextOfKin.relationship
                    }
                    onChange={onNextOfKinChange}
                    className="form-input"
                    placeholder="e.g. Spouse"
                  />
                </FormField>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed"
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
                ? "Update Patient"
                : "Register Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================
// PATIENT VIEW MODAL
// =====================================================

const PatientViewModal = ({
  patient,
  loading,
  error,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-primary-600">
              Patient Record
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {patient.firstName}{" "}
              {patient.lastName}
            </h2>
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
          {/* Patient Identity */}
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
              {patient.firstName
                ?.charAt(0)
                ?.toUpperCase()}
              {patient.lastName
                ?.charAt(0)
                ?.toUpperCase()}
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                {patient.firstName}{" "}
                {patient.lastName}
              </h3>

              <p className="text-sm text-slate-500">
                Patient No:{" "}
                {patient.patientNumber}
              </p>
            </div>
          </div>

          {/* Basic Details */}
          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Patient details <span className="ml-2 font-normal text-slate-500">ID, phone, demographics</span></summary>
            <div className="border-t border-slate-200 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Patient Number"
                value={patient.patientNumber}
              />

              <DetailItem
                label="National ID / Birth Certificate number"
                value={patient.nationalId}
              />

              <DetailItem
                label="Sex"
                value={capitalize(
                  patient.sex
                )}
              />

              <DetailItem
                label="Estimated Age"
                value={patient.estimatedAge ? `${patient.estimatedAge} years` : "—"}
              />

              <DetailItem
                label="Date of Birth"
                value={
                  patient.dateOfBirth
                    ? formatDate(
                        patient.dateOfBirth
                      )
                    : "—"
                }
              />

              <DetailItem
                label="Phone"
                value={patient.phone}
              />

              <DetailItem
                label="Address"
                value={patient.address}
              />

              <DetailItem
                label="Patient Status"
                value={capitalize(patient.status)}
              />
            </div>
            </div>
          </details>

          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Payer & consent</summary>
            <div className="border-t border-slate-200 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="Payer Type" value={capitalize(patient.payer)} />
              <DetailItem label="Scheme / Insurer" value={patient.payerDetails?.scheme} />
              <DetailItem label="Member Number" value={patient.payerDetails?.memberNumber} />
              <DetailItem label="Principal Member" value={patient.payerDetails?.principalMember} />
              <DetailItem
                label="Coverage Validity"
                value={[
                  patient.payerDetails?.validityStart && formatDate(patient.payerDetails.validityStart),
                  patient.payerDetails?.validityEnd && formatDate(patient.payerDetails.validityEnd),
                ].filter(Boolean).join(" to ")}
              />
              <DetailItem
                label="Coverage Limit"
                value={patient.payerDetails?.limit ? `KES ${patient.payerDetails.limit}` : "—"}
              />
              <DetailItem
                label="Consent Acknowledged"
                value={patient.consentAcknowledged ? "Yes" : "No"}
              />
              <DetailItem
                label="Consent Date"
                value={patient.consentDate ? formatDate(patient.consentDate) : "—"}
              />
            </div>
            </div>
          </details>

          {/* Farmer */}
          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Cooperative link</summary>
            <div className="border-t border-slate-200 p-4">

            {patient.farmer ? (
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">
                  {patient.farmer.firstName}{" "}
                  {patient.farmer.lastName}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Membership No:{" "}
                  {
                    patient.farmer
                      .membershipNumber
                  }
                </p>

                {patient.farmer.phone && (
                  <p className="mt-1 text-sm text-slate-500">
                    Phone:{" "}
                    {patient.farmer.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                This patient is not linked to a
                cooperative farmer.
              </p>
            )}
            </div>
          </details>

          {/* Next of Kin */}
          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Next of kin</summary>
            <div className="border-t border-slate-200 p-4">

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DetailItem
                label="Name"
                value={
                  patient.nextOfKin?.name
                }
              />

              <DetailItem
                label="Phone"
                value={
                  patient.nextOfKin?.phone
                }
              />

              <DetailItem
                label="Relationship"
                value={
                  patient.nextOfKin
                    ?.relationship
                }
              />
            </div>
            </div>
          </details>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading clinical history...</p>
          ) : (
            <PatientClinicalHistory history={patient.history} />
          )}
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

const PatientClinicalHistory = ({ history = {} }) => {
  const visits = history.visits || [];
  const labResults = history.labResults || [];
  const prescriptions = history.prescriptions || [];

  return (
    <details className="border-t border-slate-200 pt-6">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Clinical history <span className="ml-2 font-normal text-slate-500">{visits.length} visits · {labResults.length} lab results · {prescriptions.length} prescriptions</span></summary>
      <div className="mt-5 space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Visit & Consultation History
        </h3>
        {visits.length === 0 ? (
          <p className="text-sm text-slate-500">No visits recorded.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {visits.map((visit) => (
              <article key={visit._id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(visit.visitDate)} · {capitalize(visit.visitType)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {visit.visitNumber || "No visit number"} · {capitalize(visit.status)}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DetailItem label="Chief Complaint" value={visit.chiefComplaint} />
                  <DetailItem label="Clinician" value={visit.clinician?.name} />
                  <DetailItem label="Triage Notes" value={visit.triageNotes} />
                  <DetailItem
                    label="Vitals"
                    value={[
                      visit.temperature != null && `Temp ${visit.temperature}`,
                      visit.pulseRate != null && `Pulse ${visit.pulseRate}`,
                      visit.respiratoryRate != null && `Resp ${visit.respiratoryRate}`,
                      visit.bloodPressure && `BP ${visit.bloodPressure}`,
                      visit.oxygenSaturation != null && `SpO2 ${visit.oxygenSaturation}%`,
                      visit.weightKg != null && `Weight ${visit.weightKg} kg`,
                      visit.heightCm != null && `Height ${visit.heightCm} cm`,
                    ].filter(Boolean).join(" · ")}
                  />
                  <DetailItem label="Assessment / Diagnosis" value={visit.assessment || visit.diagnosis} />
                  <DetailItem label="Treatment Plan" value={visit.treatmentPlan} />
                  <DetailItem label="Clinical Notes" value={visit.clinicalNotes} />
                  <DetailItem label="Admission Reason" value={visit.admissionReason} />
                  <DetailItem label="Ward / Bed" value={[visit.ward, visit.bedNumber].filter(Boolean).join(" / ")} />
                  <DetailItem label="Discharge Summary" value={visit.dischargeSummary} />
                  <DetailItem label="Discharge Plan" value={visit.dischargePlan} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Laboratory Results
        </h3>
        {labResults.length === 0 ? (
          <p className="text-sm text-slate-500">No laboratory results recorded.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {labResults.map((result) => (
              <article key={result._id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{result.testName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(result.performedAt || result.createdAt)} · {capitalize(result.status)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-700">Result: {result.result || "Pending"}</p>
                {result.referenceRange && (
                  <p className="text-xs text-slate-500">Reference range: {result.referenceRange}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Prescription History
        </h3>
        {prescriptions.length === 0 ? (
          <p className="text-sm text-slate-500">No prescriptions recorded.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {prescriptions.map((prescription) => (
              <article key={prescription._id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    Prescribed by {prescription.prescribedBy?.name || "Unknown clinician"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(prescription.createdAt)} · {capitalize(prescription.status)}
                  </p>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {(prescription.medications || []).map((medication, index) => (
                    <li key={`${prescription._id}-${index}`}>
                      <span className="font-medium">{medication.name || "Medication"}</span>
                      {[medication.dosage, medication.frequency, medication.duration, medication.instructions]
                        .filter(Boolean)
                        .join(" · ")}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </details>
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

const DetailItem = ({ label, value }) => {
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
// HELPERS
// =====================================================

const capitalize = (value) => {
  if (!value) return "—";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
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

export default PatientsPage;
