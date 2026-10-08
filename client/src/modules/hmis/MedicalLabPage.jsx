import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  FlaskConical,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  createMedicalLabResult,
  deleteMedicalLabResult,
  getMedicalLabPatients,
  getMedicalLabWorklist,
  getMedicalLabResults,
  updateMedicalLabResult,
} from "../../services/medicalLab.service";

import { getPatients } from "../../services/medicalPatient.service";

import { getMedicalVisits } from "../../services/medicalVisit.service";
import PatientProfilePanel from "../../components/hmis/PatientProfilePanel";
import { useAuth } from "../../context/useAuth";

const initialForm = {
  patient: "",
  visit: "",
  testName: "",
  result: "",
  referenceRange: "",
  status: "pending",
};

const MedicalLabPage = () => {
  const { user } = useAuth();
  const isLabTechnician = user?.role === "laboratory";
  const canWriteLabResults = ["laboratory", "admin", "super_admin"].includes(user?.role);
  const canVoidLabResults = ["admin", "super_admin"].includes(user?.role);
  const [labResults, setLabResults] = useState([]);
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [worklistLoading, setWorklistLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [selectedResult, setSelectedResult] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadLabResults = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await getMedicalLabResults();

      setLabResults(response?.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load laboratory results."
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

  const loadLabWorklist = async () => {
    setWorklistLoading(true);
    try {
      const [worklistResponse, patientsResponse] = await Promise.all([
        getMedicalLabWorklist(),
        getMedicalLabPatients(),
      ]);
      const worklist = worklistResponse?.data || [];
      setVisits(worklist);
      setPatients(patientsResponse?.data || []);
    } catch (err) {
      console.error(err);
      setVisits([]);
      setPatients([]);
      setError(err.response?.data?.message || "Failed to load doctor-requested laboratory tests.");
    } finally {
      setWorklistLoading(false);
    }
  };

  useEffect(() => {
    loadLabResults();
    if (isLabTechnician) {
      loadLabWorklist();
    } else {
      loadPatients();
      loadVisits();
    }
  }, [isLabTechnician]);

  // =====================================================
  // FORM
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => {
      if (name === "patient") return { ...previous, patient: value, visit: "", testName: "" };
      if (name === "visit") return { ...previous, visit: value, testName: "" };
      return { ...previous, [name]: value };
    });
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

  const openRequestedTest = (visit, testName) => {
    setEditingId(null);
    setForm({
      ...initialForm,
      patient: visit.patient._id,
      visit: visit._id,
      testName,
      status: "pending",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (result) => {
    setError("");
    setSuccess("");

    setEditingId(result._id);

    setForm({
      patient:
        result.patient?._id ||
        result.patient ||
        "",
      visit:
        result.visit?._id ||
        result.visit ||
        "",
      testName: result.testName || "",
      result: result.result || "",
      referenceRange:
        result.referenceRange || "",
      status: result.status || "pending",
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

    if (!form.testName.trim()) {
      setError("Please enter the test name.");
      return;
    }
    if (isLabTechnician && !form.visit) {
      setError("Select a doctor-diagnosed visit with a requested test.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        patient: form.patient,
        testName: form.testName.trim(),
        result: form.result.trim(),
        referenceRange:
          form.referenceRange.trim(),
        status: form.status,
      };

      // Visit is optional in the backend schema.
      if (form.visit) {
        payload.visit = form.visit;
      }

      if (editingId) {
        await updateMedicalLabResult(
          editingId,
          payload
        );

        setSuccess(
          "Laboratory result updated successfully."
        );
      } else {
        await createMedicalLabResult(payload);

        setSuccess(
          "Laboratory result created successfully."
        );
      }

      await loadLabResults();

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save laboratory result."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (labResult) => {
    const patientName = getPatientName(
      labResult.patient
    );

    const confirmed = window.confirm(
      `Delete the ${labResult.testName} result for ${patientName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deleteMedicalLabResult(
        labResult._id
      );

      setSuccess(
        "Laboratory result deleted successfully."
      );

      await loadLabResults();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete laboratory result."
      );
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const openView = (result) => {
    setSelectedResult(result);
    setShowView(true);
  };

  const closeView = () => {
    setShowView(false);
    setSelectedResult(null);
  };

  // =====================================================
  // FILTERING
  // =====================================================

  const filteredResults = useMemo(() => {
    const searchTerm = search
      .trim()
      .toLowerCase();

    return labResults.filter((item) => {
      const patientName = getPatientName(
        item.patient
      ).toLowerCase();

      const patientNumber =
        item.patient?.patientNumber
          ?.toLowerCase() || "";

      const testName =
        item.testName?.toLowerCase() || "";

      const result =
        item.result?.toLowerCase() || "";

      const matchesSearch =
        !searchTerm ||
        patientName.includes(searchTerm) ||
        patientNumber.includes(searchTerm) ||
        testName.includes(searchTerm) ||
        result.includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      return (
        matchesSearch && matchesStatus
      );
    });
  }, [
    labResults,
    search,
    statusFilter,
  ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalResults = labResults.length;

  const pendingResults = labResults.filter(
    (item) => item.status === "pending"
  ).length;

  const completedResults = labResults.filter(
    (item) => item.status === "completed"
  ).length;

  const cancelledResults = labResults.filter(
    (item) => item.status === "cancelled"
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
            <FlaskConical size={18} />
            HMIS / Laboratory
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Medical Laboratory
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Record and manage patient laboratory
            investigations and results.
          </p>
        </div>

        {canWriteLabResults && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus size={18} />
            New Lab Result
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
          label="Total Results"
          value={totalResults}
          icon={FlaskConical}
        />

        <SummaryCard
          label="Pending"
          value={pendingResults}
          icon={FlaskConical}
        />

        <SummaryCard
          label="Completed"
          value={completedResults}
          icon={FlaskConical}
        />

        <SummaryCard
          label="Cancelled"
          value={cancelledResults}
          icon={FlaskConical}
        />
      </div>

      {isLabTechnician && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">Doctor Requests</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {visits.reduce((count, visit) => count + (visit.labOrders?.length || 0), 0)} tests awaiting results
                </p>
              </div>
              <FlaskConical size={19} className="text-primary-600" />
            </div>
          </div>
          {worklistLoading ? (
            <div className="p-6 text-sm text-slate-500">Loading doctor requests...</div>
          ) : visits.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No doctor-requested tests are waiting.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visits.map((visit) => (
                <article key={visit._id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(180px,0.8fr)_minmax(180px,1fr)_minmax(220px,1fr)] lg:items-center">
                  <div>
                    <p className="font-medium text-slate-900">{getPatientName(visit.patient)}</p>
                    <p className="text-xs text-slate-500">{visit.patient?.patientNumber || "—"} · {formatDateTime(visit.visitDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Doctor diagnosis</p>
                    <p className="mt-1 text-sm text-slate-700">{visit.diagnosis}</p>
                    <p className="mt-1 text-xs text-slate-500">Ordered by {visit.clinician?.name || "Doctor"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(visit.labOrders || []).map((testName) => (
                      <button
                        key={testName}
                        type="button"
                        onClick={() => openRequestedTest(visit, testName)}
                        className="inline-flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-100"
                      >
                        <Plus size={15} />
                        Record {testName}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

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
              placeholder="Search patient, patient number, test or result..."
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
            <option value="pending">
              Pending
            </option>
            <option value="completed">
              Completed
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            Laboratory Results
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredResults.length} of{" "}
            {labResults.length} results
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Loading laboratory results...
            </div>
          </div>
        ) : filteredResults.length === 0 ? (
          <EmptyState
            search={search}
            onCreate={canWriteLabResults ? openCreateForm : undefined}
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
                    Test
                  </TableHeading>

                  <TableHeading>
                    Result
                  </TableHeading>

                  <TableHeading>
                    Reference Range
                  </TableHeading>

                  <TableHeading>
                    Performed By
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
                {filteredResults.map((item) => (
                  <tr
                    key={item._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {getPatientName(
                            item.patient
                          )}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.patient
                            ?.patientNumber ||
                            "—"}
                        </p>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-800">
                      {item.testName}
                    </td>

                    <td className="max-w-[220px] px-5 py-4">
                      <p className="truncate text-sm text-slate-700">
                        {item.result || "Pending"}
                      </p>
                    </td>

                    <td className="max-w-[180px] px-5 py-4">
                      <p className="truncate text-sm text-slate-500">
                        {item.referenceRange ||
                          "—"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {item.performedBy
                            ?.name || "—"}
                        </p>

                        {item.performedBy
                          ?.role && (
                          <p className="text-xs text-slate-500">
                            {formatRole(
                              item.performedBy
                                .role
                            )}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusBadge
                        status={item.status}
                      />
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <ActionButton
                          title="View result"
                          onClick={() =>
                            openView(item)
                          }
                        >
                          <Eye size={17} />
                        </ActionButton>

                        {canWriteLabResults && (
                          <ActionButton title="Edit result" onClick={() => openEditForm(item)}>
                            <Edit size={17} />
                          </ActionButton>
                        )}
                        {canVoidLabResults && (
                          <ActionButton title="Void result" danger onClick={() => handleDelete(item)}>
                            <Trash2 size={17} />
                          </ActionButton>
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
        <LabFormModal
          form={form}
          patients={patients}
          visits={visits}
          editingId={editingId}
          saving={saving}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onChange={handleChange}
          isLabTechnician={isLabTechnician}
        />
      )}

      {/* View Modal */}
      {showView && selectedResult && (
        <LabViewModal
          result={selectedResult}
          onClose={closeView}
        />
      )}
    </div>
  );
};

// =====================================================
// LAB FORM MODAL
// =====================================================

const LabFormModal = ({
  form,
  patients,
  visits,
  editingId,
  saving,
  onClose,
  onSubmit,
  onChange,
  isLabTechnician,
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
  const selectedVisit = selectedPatientVisits.find((visit) => visit._id === form.visit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? "Edit Laboratory Result"
                : "New Laboratory Result"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Record a laboratory investigation for a
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

              <div className="grid grid-cols-1 gap-4">
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
                          {formatDateTime(
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

                {isLabTechnician && selectedVisit && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Doctor Diagnosis</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedVisit.diagnosis}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Requested Tests</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedVisit.labOrders.join(", ")}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Test Details */}
            <section className="border-t border-slate-200 pt-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Test Details
              </h3>

              <div className="space-y-4">
                <FormField
                  label="Test Name"
                  required
                >
                  {isLabTechnician ? (
                    <select
                      name="testName"
                      value={form.testName}
                      onChange={onChange}
                      className="form-input"
                      disabled={!selectedVisit}
                      required
                    >
                      <option value="">Select a doctor-requested test</option>
                      {(selectedVisit?.labOrders || []).map((order) => (
                        <option key={order} value={order}>{order}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="testName"
                      value={form.testName}
                      onChange={onChange}
                      className="form-input"
                      placeholder="e.g. Blood Glucose"
                      required
                    />
                  )}
                </FormField>

                <FormField label="Result">
                  <textarea
                    name="result"
                    value={form.result}
                    onChange={onChange}
                    className="form-input min-h-[100px] resize-y"
                    placeholder="Enter laboratory result..."
                  />
                </FormField>

                <FormField label="Reference Range">
                  <input
                    name="referenceRange"
                    value={
                      form.referenceRange
                    }
                    onChange={onChange}
                    className="form-input"
                    placeholder="e.g. 70–100 mg/dL"
                  />
                </FormField>

                <FormField label="Status">
                  <select
                    name="status"
                    value={form.status}
                    onChange={onChange}
                    className="form-input"
                  >
                    <option value="pending">
                      Pending
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </FormField>
              </div>
            </section>

            {/* Performer */}
            <section className="rounded-lg border border-purple-100 bg-purple-50 p-4">
              <div className="flex items-start gap-3">
                <FlaskConical
                  size={20}
                  className="mt-0.5 text-purple-600"
                />

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Laboratory Performer
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    The logged-in ERP user will
                    automatically be recorded as the
                    person performing the laboratory
                    test.
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
                ? "Update Result"
                : "Save Result"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================
// LAB VIEW MODAL
// =====================================================

const LabViewModal = ({
  result,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-primary-600">
              Laboratory Result
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {result.testName}
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
          <PatientProfilePanel patient={result.patient} />
          {/* Patient */}
          {/* Test */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Test Information
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <DetailItem
                label="Test Name"
                value={result.testName}
              />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Status
                </p>

                <div className="mt-2">
                  <StatusBadge
                    status={result.status}
                  />
                </div>
              </div>

              <DetailItem
                label="Reference Range"
                value={
                  result.referenceRange
                }
              />

              <DetailItem
                label="Performed At"
                value={
                  result.performedAt
                    ? formatDateTime(
                        result.performedAt
                      )
                    : "—"
                }
              />
            </div>
          </div>

          {/* Result */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Result
            </p>

            <div className="mt-2 rounded-lg bg-slate-50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {result.result ||
                  "No result recorded."}
              </p>
            </div>
          </div>

          {/* Linked Visit */}
          {result.visit && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Linked Medical Visit
              </h3>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">
                  {formatDateTime(
                    result.visit
                      .visitDate
                  )}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {formatVisitType(
                    result.visit
                      .visitType
                  )}
                </p>

                {result.visit.diagnosis && (
                  <p className="mt-2 text-sm text-slate-600">
                    Diagnosis:{" "}
                    {
                      result.visit
                        .diagnosis
                    }
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Performer */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Performed By
            </h3>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">
                {result.performedBy?.name ||
                  "—"}
              </p>

              {result.performedBy
                ?.role && (
                <p className="mt-1 text-sm text-slate-500">
                  {formatRole(
                    result.performedBy
                      .role
                  )}
                </p>
              )}

              {result.performedBy
                ?.email && (
                <p className="mt-1 text-sm text-slate-500">
                  {
                    result.performedBy
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
        <FlaskConical size={28} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">
        No laboratory results found
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500">
        {search
          ? "Try changing your search or filter."
          : "No laboratory results have been recorded yet."}
      </p>

      {!search && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={17} />
          Create First Result
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
    pending: {
      label: "Pending",
      className:
        "bg-amber-50 text-amber-700",
    },
    completed: {
      label: "Completed",
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

export default MedicalLabPage;
