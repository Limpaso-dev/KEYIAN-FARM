import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";

import {
  createMedicalVisit,
  deleteMedicalVisit,
  getMedicalVisits,
  updateMedicalVisit,
} from "../../services/medicalVisit.service";

import { getPatients } from "../../services/medicalPatient.service";
import { useAuth } from "../../context/useAuth";
import PatientProfilePanel from "../../components/hmis/PatientProfilePanel";

const initialForm = {
  patient: "",
  visitDate: "",
  visitType: "outpatient",
  chiefComplaint: "",
  clinicalNotes: "",
  temperature: "",
  pulseRate: "",
  respiratoryRate: "",
  bloodPressure: "",
  oxygenSaturation: "",
  weightKg: "",
  heightCm: "",
  painScore: "",
  triagePriority: "routine",
  triageNotes: "",
  assessment: "",
  diagnosis: "",
  differentialDiagnosis: "",
  labOrders: "",
  treatmentPlan: "",
  disposition: "observe",
  followUpDate: "",
  referredTo: "",
  status: "registered",
};

const MedicalVisitsPage = () => {
  const { user } = useAuth();
  const isNurse = user?.role === "nurse";
  const isDoctor = user?.role === "doctor";
  const canOrderLabTests = user?.role === "doctor";
  const canCreateVisits = ["admin", "super_admin", "receptionist"].includes(user?.role);
  const canVoidVisits = ["admin", "super_admin"].includes(user?.role);
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(() => user?.role === "nurse" ? "triage_queue" : user?.role === "doctor" ? "doctor_queue" : "all");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [selectedVisit, setSelectedVisit] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadVisits = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getMedicalVisits();

      setVisits(response?.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load medical visits."
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

      setError(
        err.response?.data?.message ||
          "Failed to load patients."
      );
    }
  };

  useEffect(() => {
    loadVisits();
    loadPatients();
  }, []);

  useEffect(() => {
    if (isNurse) setStatusFilter("triage_queue");
    if (isDoctor) setStatusFilter("doctor_queue");
  }, [isNurse, isDoctor]);

  // =====================================================
  // FORM
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
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

    setForm({
      ...initialForm,
      visitDate: getCurrentDateTimeLocal(),
      status: user?.role === "receptionist" ? "waiting_for_triage" : "registered",
    });

    setShowForm(true);
  };

  const openEditForm = (visit) => {
    setError("");
    setSuccess("");

    setEditingId(visit._id);

    setForm({
      patient: visit.patient?._id || visit.patient || "",
      visitDate: visit.visitDate
        ? toDateTimeLocal(visit.visitDate)
        : "",
      visitType: visit.visitType || "outpatient",
      chiefComplaint:
        visit.chiefComplaint || "",
      clinicalNotes:
        visit.clinicalNotes || "",
      temperature: visit.temperature ?? "",
      pulseRate: visit.pulseRate ?? "",
      respiratoryRate: visit.respiratoryRate ?? "",
      bloodPressure: visit.bloodPressure || "",
      oxygenSaturation: visit.oxygenSaturation ?? "",
      weightKg: visit.weightKg ?? "",
      heightCm: visit.heightCm ?? "",
      painScore: visit.painScore ?? "",
      triagePriority: visit.triagePriority || "routine",
      triageNotes: visit.triageNotes || "",
      assessment: visit.assessment || "",
      diagnosis: visit.diagnosis || "",
      differentialDiagnosis: visit.differentialDiagnosis || "",
      labOrders: (visit.labOrders || []).join("\n"),
      treatmentPlan:
        visit.treatmentPlan || "",
      disposition: visit.disposition || "observe",
      followUpDate: visit.followUpDate ? toDateTimeLocal(visit.followUpDate) : "",
      referredTo: visit.referredTo || "",
      status: visit.status || "registered",
    });

    setShowForm(true);
  };

  const startTriage = async (visit) => {
    setSaving(true);
    setError("");
    try {
      await updateMedicalVisit(visit._id, { status: "in_triage" });
      await loadVisits();
      openEditForm({ ...visit, status: "in_triage" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start triage for this visit.");
    } finally {
      setSaving(false);
    }
  };

  const startConsultation = async (visit) => {
    setSaving(true);
    setError("");
    try {
      await updateMedicalVisit(visit._id, { status: "in_consultation" });
      await loadVisits();
      openEditForm({ ...visit, status: "in_consultation" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start this consultation.");
    } finally {
      setSaving(false);
    }
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

    if (isNurse && !editingId) {
      setError("Nurses can only triage visits registered by Reception.");
      return;
    }

    if (isNurse) {
      const hasVital = [form.temperature, form.pulseRate, form.respiratoryRate, form.bloodPressure, form.oxygenSaturation]
        .some((value) => String(value ?? "").trim() !== "");
      if (!hasVital || !form.triageNotes.trim()) {
        setError("Record at least one vital sign and triage notes before sending the patient to the doctor.");
        return;
      }
    }

    if (!form.patient) {
      setError("Please select a patient.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        patient: form.patient,
        visitDate: form.visitDate
          ? new Date(form.visitDate).toISOString()
          : undefined,
        visitType: form.visitType,
        chiefComplaint:
          form.chiefComplaint.trim(),
        clinicalNotes:
          form.clinicalNotes.trim(),
        temperature: form.temperature === "" ? undefined : Number(form.temperature),
        pulseRate: form.pulseRate === "" ? undefined : Number(form.pulseRate),
        respiratoryRate: form.respiratoryRate === "" ? undefined : Number(form.respiratoryRate),
        bloodPressure: form.bloodPressure.trim(),
        oxygenSaturation: form.oxygenSaturation === "" ? undefined : Number(form.oxygenSaturation),
        weightKg: form.weightKg === "" ? undefined : Number(form.weightKg),
        heightCm: form.heightCm === "" ? undefined : Number(form.heightCm),
        painScore: form.painScore === "" ? undefined : Number(form.painScore),
        triagePriority: form.triagePriority,
        triageNotes: form.triageNotes.trim(),
        assessment: form.assessment.trim(),
        diagnosis: form.diagnosis.trim(),
        differentialDiagnosis: form.differentialDiagnosis.trim(),
        treatmentPlan:
          form.treatmentPlan.trim(),
        disposition: form.disposition,
        followUpDate: form.followUpDate
          ? new Date(form.followUpDate).toISOString()
          : undefined,
        referredTo: form.referredTo.trim(),
        ...(user?.role === "receptionist" ? {} : { status: isNurse ? "waiting_for_doctor" : form.status }),
      };

      if (canOrderLabTests) {
        payload.labOrders = form.labOrders
          .split(/\r?\n/)
          .map((order) => order.trim())
          .filter(Boolean);
      }

      if (editingId) {
        await updateMedicalVisit(
          editingId,
          payload
        );

        setSuccess(
          "Medical visit updated successfully."
        );
      } else {
        await createMedicalVisit(payload);

        setSuccess(
          "Medical visit created successfully."
        );
      }

      await loadVisits();

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save medical visit."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (visit) => {
    const patientName = getPatientName(
      visit.patient
    );

    const confirmed = window.confirm(
      `Delete the medical visit for ${patientName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deleteMedicalVisit(visit._id);

      setSuccess(
        "Medical visit deleted successfully."
      );

      await loadVisits();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete medical visit."
      );
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const openView = (visit) => {
    setSelectedVisit(visit);
    setShowView(true);
  };

  const closeView = () => {
    setShowView(false);
    setSelectedVisit(null);
  };

  // =====================================================
  // FILTERING
  // =====================================================

  const filteredVisits = useMemo(() => {
    const searchTerm = search
      .trim()
      .toLowerCase();

    return visits.filter((visit) => {
      const patientName = getPatientName(
        visit.patient
      ).toLowerCase();

      const patientNumber =
        visit.patient?.patientNumber
          ?.toLowerCase() || "";

      const diagnosis = isNurse ? "" : visit.diagnosis?.toLowerCase() || "";

      const complaint =
        visit.chiefComplaint?.toLowerCase() ||
        "";

      const matchesSearch =
        !searchTerm ||
        patientName.includes(searchTerm) ||
        patientNumber.includes(searchTerm) ||
        diagnosis.includes(searchTerm) ||
        complaint.includes(searchTerm);

      const matchesType =
        typeFilter === "all" ||
        visit.visitType === typeFilter;

      const matchesStatus = isNurse && statusFilter === "triage_queue"
        ? ["waiting_for_triage", "in_triage"].includes(visit.status)
        : isDoctor && statusFilter === "doctor_queue"
          ? ["waiting_for_doctor", "in_consultation"].includes(visit.status)
        : statusFilter === "all" || visit.status === statusFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    visits,
    search,
    typeFilter,
    statusFilter,
    isNurse,
    isDoctor,
  ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalVisits = visits.length;

  const openVisits = visits.filter((visit) =>
    [
      "registered",
      "waiting_for_triage",
      "in_triage",
      "waiting_for_doctor",
      "in_consultation",
      "awaiting_investigations",
      "awaiting_results",
      "awaiting_pharmacy",
      "awaiting_billing",
      "admitted",
      "discharge_pending",
    ].includes(visit.status)
  ).length;

  const completedVisits = visits.filter((visit) =>
    ["cleared", "closed"].includes(visit.status)
  ).length;

  const emergencyVisits = visits.filter(
    (visit) => isNurse
      ? visit.triagePriority === "emergency"
      : visit.visitType === "emergency"
  ).length;
  const waitingForTriage = visits.filter((visit) => visit.status === "waiting_for_triage").length;
  const inTriage = visits.filter((visit) => visit.status === "in_triage").length;
  const waitingForDoctor = visits.filter((visit) => visit.status === "waiting_for_doctor").length;
  const inConsultation = visits.filter((visit) => visit.status === "in_consultation").length;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-600">
            <Stethoscope size={18} />
            HMIS / Medical Visits
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {isNurse ? "Triage Queue" : isDoctor ? "Doctor Queue" : "Medical Visits"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {isNurse
              ? "Review waiting patients, record triage observations, and hand off to the doctor."
              : isDoctor
                ? "Review triaged patients, document the consultation, and coordinate lab, pharmacy, and billing handoffs."
              : "Record and manage patient clinical encounters, diagnoses, and treatment plans."}
          </p>
        </div>

        {canCreateVisits && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus size={18} />
            New Medical Visit
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
        {isNurse ? (
          <>
            <SummaryCard label="Waiting for Triage" value={waitingForTriage} icon={Stethoscope} />
            <SummaryCard label="In Triage" value={inTriage} icon={FileText} />
            <SummaryCard label="Emergency Visits" value={emergencyVisits} icon={Stethoscope} />
          </>
        ) : isDoctor ? (
          <>
            <SummaryCard label="Waiting for Doctor" value={waitingForDoctor} icon={Stethoscope} />
            <SummaryCard label="In Consultation" value={inConsultation} icon={FileText} />
            <SummaryCard label="Emergency" value={emergencyVisits} icon={Stethoscope} />
          </>
        ) : (
          <>
            <SummaryCard label="Total Visits" value={totalVisits} icon={Stethoscope} />
            <SummaryCard label="Open" value={openVisits} icon={FileText} />
            <SummaryCard label="Completed" value={completedVisits} icon={FileText} />
            <SummaryCard label="Emergency" value={emergencyVisits} icon={Stethoscope} />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_180px]">
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
              placeholder={isNurse ? "Search patient number or complaint..." : "Search patient, patient number, diagnosis or complaint..."}
              className="form-input pl-10"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value)
            }
            className="form-input"
          >
            <option value="all">
              All Visit Types
            </option>
            <option value="outpatient">
              Outpatient
            </option>
            <option value="follow_up">
              Follow Up
            </option>
            <option value="emergency">
              Emergency
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="form-input"
          >
            {isNurse ? (
              <>
                <option value="triage_queue">All Triage Queue</option>
                <option value="waiting_for_triage">Waiting for Triage</option>
                <option value="in_triage">In Triage</option>
              </>
            ) : isDoctor ? (
              <>
                <option value="doctor_queue">Doctor Queue</option>
                <option value="waiting_for_doctor">Waiting for Doctor</option>
                <option value="in_consultation">In Consultation</option>
              </>
            ) : (
              <>
                <option value="all">All Statuses</option>
                <option value="registered">Registered</option>
                <option value="waiting_for_triage">Waiting for Triage</option>
                <option value="in_consultation">In Consultation</option>
                <option value="awaiting_results">Awaiting Results</option>
                <option value="awaiting_billing">Awaiting Billing</option>
                <option value="cleared">Cleared</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Visits Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            {isNurse ? "Patients Awaiting Triage" : isDoctor ? "Patients for Consultation" : "Clinical Encounters"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredVisits.length} of{" "}
            {visits.length} visits
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Loading medical visits...
            </div>
          </div>
        ) : filteredVisits.length === 0 ? (
          <EmptyState
            search={search}
            onCreate={canCreateVisits ? openCreateForm : undefined}
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
                    Visit Date
                  </TableHeading>

                  <TableHeading>
                    Type
                  </TableHeading>

                  <TableHeading>
                    {isNurse ? "Chief Complaint" : isDoctor ? "Complaint / Diagnosis" : "Diagnosis"}
                  </TableHeading>

                  {(isNurse || isDoctor) && <TableHeading>Priority</TableHeading>}

                  {!isNurse && !isDoctor && <TableHeading>Clinician</TableHeading>}

                  <TableHeading>
                    Status
                  </TableHeading>

                  <TableHeading align="right">
                    Actions
                  </TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredVisits.map((visit) => (
                  <tr
                    key={visit._id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {getPatientName(
                            visit.patient
                          )}
                        </p>

                        <p className="text-xs text-slate-500">
                          {visit.patient
                            ?.patientNumber ||
                            "—"}
                        </p>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {formatDateTime(
                        visit.visitDate
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <VisitTypeBadge
                        type={visit.visitType}
                      />
                    </td>

                    <td className="max-w-[220px] px-5 py-4">
                      <p className="truncate text-sm text-slate-700">
                        {isNurse ? visit.chiefComplaint || "—" : isDoctor ? visit.diagnosis || visit.chiefComplaint || "—" : visit.diagnosis || "—"}
                      </p>
                    </td>

                    {(isNurse || isDoctor) && (
                      <td className="whitespace-nowrap px-5 py-4">
                        <PriorityBadge priority={visit.triagePriority} />
                      </td>
                    )}

                    {!isNurse && !isDoctor && <td className="whitespace-nowrap px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {visit.clinician
                            ?.name || "—"}
                        </p>

                        {visit.clinician
                          ?.role && (
                          <p className="text-xs text-slate-500">
                            {formatRole(
                              visit.clinician
                                .role
                            )}
                          </p>
                        )}
                      </div>
                    </td>}

                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusBadge
                        status={visit.status}
                      />
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {isNurse ? (
                          <>
                            <ActionButton title="View triage details" onClick={() => openView(visit)}>
                              <Eye size={17} />
                            </ActionButton>
                            <ActionButton
                              title={visit.status === "waiting_for_triage" ? "Start triage" : "Continue triage"}
                              onClick={() => visit.status === "waiting_for_triage" ? startTriage(visit) : openEditForm(visit)}
                            >
                              <Stethoscope size={17} />
                            </ActionButton>
                          </>
                        ) : isDoctor ? (
                          <>
                            <ActionButton title="Review visit" onClick={() => openView(visit)}>
                              <Eye size={17} />
                            </ActionButton>
                            <ActionButton
                              title={visit.status === "waiting_for_doctor" ? "Start consultation" : "Continue consultation"}
                              onClick={() => visit.status === "waiting_for_doctor" ? startConsultation(visit) : openEditForm(visit)}
                            >
                              <Stethoscope size={17} />
                            </ActionButton>
                          </>
                        ) : (
                          <>
                            <ActionButton title="View visit" onClick={() => openView(visit)}>
                              <Eye size={17} />
                            </ActionButton>
                            <ActionButton title="Edit visit" onClick={() => openEditForm(visit)}>
                              <Edit size={17} />
                            </ActionButton>
                          </>
                        )}

                        {canVoidVisits && (
                          <ActionButton
                            title="Void visit"
                            danger
                            onClick={() => handleDelete(visit)}
                          >
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
        <VisitFormModal
          form={form}
          patients={patients}
          editingId={editingId}
          saving={saving}
          canOrderLabTests={canOrderLabTests}
          userRole={user?.role}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onChange={handleChange}
        />
      )}

      {/* View Modal */}
      {showView && selectedVisit && (
        <VisitViewModal
          visit={selectedVisit}
          onClose={closeView}
        />
      )}
    </div>
  );
};

// =====================================================
// VISIT FORM MODAL
// =====================================================

const VisitFormModal = ({
  form,
  patients,
  editingId,
  saving,
  canOrderLabTests,
  userRole,
  onClose,
  onSubmit,
  onChange,
}) => {
  const allStatusOptions = [
    ["registered", "Registered"],
    ["waiting_for_triage", "Waiting for Triage"],
    ["in_triage", "In Triage"],
    ["waiting_for_doctor", "Waiting for Doctor"],
    ["in_consultation", "In Consultation"],
    ["awaiting_investigations", "Awaiting Investigations"],
    ["awaiting_results", "Awaiting Results"],
    ["awaiting_pharmacy", "Awaiting Pharmacy"],
    ["awaiting_billing", "Awaiting Billing"],
    ["admitted", "Admitted"],
    ["discharge_pending", "Discharge Pending"],
    ["cleared", "Cleared"],
    ["closed", "Closed"],
    ["cancelled", "Cancelled"],
    ["referred", "Referred"],
    ["left_without_being_seen", "Left without being seen"],
    ["deceased", "Deceased"],
  ];
  const statusOptions = userRole === "receptionist"
    ? allStatusOptions.slice(0, 2)
    : userRole === "nurse"
      ? allStatusOptions.filter(([value]) => ["registered", "waiting_for_triage", "in_triage", "waiting_for_doctor", "awaiting_investigations", "awaiting_results", "awaiting_pharmacy"].includes(value))
      : userRole === "doctor"
        ? allStatusOptions.filter(([value]) => ["in_consultation", "awaiting_results", "awaiting_billing"].includes(value))
        : allStatusOptions;
  const visibleStatusOptions = statusOptions.some(([value]) => value === form.status)
    ? statusOptions
    : [...statusOptions, [form.status, form.status.replaceAll("_", " ")]];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {userRole === "nurse"
                ? "Triage Patient"
                : editingId
                  ? "Edit Medical Visit"
                  : "New Medical Visit"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {userRole === "nurse"
                ? "Record observations and complete the handoff to the doctor."
                : "Record the patient's clinical encounter."}
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
            {/* Encounter Details */}
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Encounter Details
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
                    disabled={userRole === "nurse" || userRole === "doctor"}
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

                <FormField
                  label="Visit Date"
                  required
                >
                  <input
                    type="datetime-local"
                    name="visitDate"
                    value={form.visitDate}
                    onChange={onChange}
                    disabled={userRole === "nurse" || userRole === "doctor"}
                    className="form-input"
                    required
                  />
                </FormField>

                <FormField label="Visit Type">
                  <select
                    name="visitType"
                    value={form.visitType}
                    onChange={onChange}
                    disabled={userRole === "nurse" || userRole === "doctor"}
                    className="form-input"
                  >
                    <option value="outpatient">
                      Outpatient
                    </option>
                    <option value="follow_up">
                      Follow Up
                    </option>
                    <option value="emergency">
                      Emergency
                    </option>
                  </select>
                </FormField>

                {userRole !== "nurse" && userRole !== "receptionist" && <FormField label="Status">
                  <select
                    name="status"
                    value={form.status}
                    onChange={onChange}
                    className="form-input"
                  >
                    {visibleStatusOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>}
              </div>
            </section>

            {/* Clinical Information */}
            {userRole !== "receptionist" && (
            <section className="border-t border-slate-200 pt-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Clinical Information
              </h3>

              <div className="space-y-4">
                <FormField label="Chief Complaint">
                  <textarea
                    name="chiefComplaint"
                    value={
                      form.chiefComplaint
                    }
                    onChange={onChange}
                    readOnly={userRole === "doctor"}
                    className="form-input min-h-[90px] resize-y"
                    placeholder="Describe the patient's main complaint..."
                  />
                </FormField>

                {userRole === "doctor" && <FormField label="Clinical Notes">
                  <textarea
                    name="clinicalNotes"
                    value={
                      form.clinicalNotes
                    }
                    onChange={onChange}
                    className="form-input min-h-[120px] resize-y"
                    placeholder="Enter clinical observations and notes..."
                  />
                </FormField>}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField label="Temperature (°C)">
                    <input
                      type="number"
                      step="0.1"
                      name="temperature"
                      value={form.temperature}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="37.5"
                    />
                  </FormField>

                  <FormField label="Pulse Rate">
                    <input
                      type="number"
                      name="pulseRate"
                      value={form.pulseRate}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="72"
                    />
                  </FormField>

                  <FormField label="Respiratory Rate">
                    <input
                      type="number"
                      name="respiratoryRate"
                      value={form.respiratoryRate}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="18"
                    />
                  </FormField>

                  <FormField label="Blood Pressure">
                    <input
                      name="bloodPressure"
                      value={form.bloodPressure}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="120/80"
                    />
                  </FormField>

                  <FormField label="O2 Saturation (%)">
                    <input
                      type="number"
                      name="oxygenSaturation"
                      value={form.oxygenSaturation}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="98"
                    />
                  </FormField>

                  <FormField label="Pain Score">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      name="painScore"
                      value={form.painScore}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="0-10"
                    />
                  </FormField>

                  <FormField label="Weight (kg)">
                    <input
                      type="number"
                      step="0.1"
                      name="weightKg"
                      value={form.weightKg}
                      onChange={onChange}
                      readOnly={userRole === "doctor"}
                      className="form-input"
                      placeholder="65.5"
                    />
                  </FormField>

                  <FormField label="Height (cm)">
                    <input
                      type="number"
                      step="0.1"
                      name="heightCm"
                      value={form.heightCm}
                      onChange={onChange}
                      disabled={userRole === "doctor"}
                      className="form-input disabled:bg-slate-100"
                      placeholder="170"
                    />
                  </FormField>

                  <FormField label="Triage Priority">
                    <select
                      name="triagePriority"
                      value={form.triagePriority}
                      onChange={onChange}
                      className="form-input"
                    >
                      <option value="routine">Routine</option>
                      <option value="urgent">Urgent</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Triage Notes">
                  <textarea
                    name="triageNotes"
                    value={form.triageNotes}
                    onChange={onChange}
                    readOnly={userRole === "doctor"}
                    className="form-input min-h-[90px] resize-y"
                    placeholder="Record triage observations and immediate concerns..."
                  />
                </FormField>

                {userRole === "doctor" && <>
                <FormField label="Assessment">
                  <textarea
                    name="assessment"
                    value={form.assessment}
                    onChange={onChange}
                    className="form-input min-h-[90px] resize-y"
                    placeholder="Clinical assessment and summary..."
                  />
                </FormField>

                <FormField label="Diagnosis">
                  <textarea
                    name="diagnosis"
                    value={form.diagnosis}
                    onChange={onChange}
                    className="form-input min-h-[90px] resize-y"
                    placeholder="Enter diagnosis..."
                  />
                </FormField>

                {canOrderLabTests && (
                  <FormField label="Laboratory Tests Requested">
                    <textarea
                      name="labOrders"
                      value={form.labOrders}
                      onChange={onChange}
                      className="form-input min-h-[90px] resize-y"
                      placeholder="Enter one requested investigation per line..."
                    />
                  </FormField>
                )}

                <FormField label="Differential Diagnosis">
                  <textarea
                    name="differentialDiagnosis"
                    value={form.differentialDiagnosis}
                    onChange={onChange}
                    className="form-input min-h-[90px] resize-y"
                    placeholder="Enter possible alternate diagnoses..."
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Disposition">
                    <select
                      name="disposition"
                      value={form.disposition}
                      onChange={onChange}
                      className="form-input"
                    >
                      <option value="observe">Observe</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="admit">Admit</option>
                      <option value="discharge">Discharge</option>
                      <option value="refer">Refer</option>
                    </select>
                  </FormField>

                  <FormField label="Follow-up Date">
                    <input
                      type="datetime-local"
                      name="followUpDate"
                      value={form.followUpDate}
                      onChange={onChange}
                      className="form-input"
                    />
                  </FormField>
                </div>

                <FormField label="Referral Destination">
                  <input
                    name="referredTo"
                    value={form.referredTo}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Ward, specialist, or partner facility"
                  />
                </FormField>

                <FormField label="Treatment Plan">
                  <textarea
                    name="treatmentPlan"
                    value={
                      form.treatmentPlan
                    }
                    onChange={onChange}
                    className="form-input min-h-[100px] resize-y"
                    placeholder="Enter treatment plan and follow-up instructions..."
                  />
                </FormField>
                </>}
              </div>
            </section>
            )}

            {/* Clinician Information */}
            <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Stethoscope
                  size={20}
                  className="mt-0.5 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Clinician
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {userRole === "nurse"
                      ? "Triage completion and the logged-in nurse will be recorded before the visit is sent to the doctor queue."
                      : "The logged-in medical-centre user will automatically be recorded as the clinician for this visit."}
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

              {userRole === "nurse"
                ? "Complete Triage & Send to Doctor"
                : editingId
                  ? "Update Visit"
                  : "Create Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================
// VISIT VIEW MODAL
// =====================================================

const VisitViewModal = ({
  visit,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-primary-600">
              Clinical Encounter
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">Visit details</h2>

            <p className="mt-1 text-sm text-slate-500">
              Visit No: {visit.visitNumber || "Not assigned"}
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
          <PatientProfilePanel patient={visit.patient} />
          {/* Encounter Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DetailItem
              label="Visit Date"
              value={formatDateTime(
                visit.visitDate
              )}
            />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Visit Type
              </p>

              <div className="mt-2">
                <VisitTypeBadge
                  type={visit.visitType}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </p>

              <div className="mt-2">
                <StatusBadge
                  status={visit.status}
                />
              </div>
            </div>
          </div>

          {/* Clinician */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Clinician
            </p>

            <p className="mt-1 font-semibold text-slate-900">
              {visit.clinician?.name || "—"}
            </p>

            {visit.clinician?.role && (
              <p className="mt-1 text-sm text-slate-500">
                {formatRole(
                  visit.clinician.role
                )}
              </p>
            )}

            {visit.clinician?.email && (
              <p className="mt-1 text-sm text-slate-500">
                {visit.clinician.email}
              </p>
            )}
          </div>

          {/* Clinical Information */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Clinical Information
            </h3>

            <div className="space-y-5">
              <ClinicalSection
                label="Chief Complaint"
                value={visit.chiefComplaint}
              />

              <ClinicalSection
                label="Clinical Notes"
                value={visit.clinicalNotes}
              />

              <ClinicalSection
                label="Assessment"
                value={visit.assessment}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Temperature" value={visit.temperature ? `${visit.temperature}°C` : "—"} />
                <DetailItem label="Pulse Rate" value={visit.pulseRate ? `${visit.pulseRate} bpm` : "—"} />
                <DetailItem label="Respiratory Rate" value={visit.respiratoryRate ? `${visit.respiratoryRate}/min` : "—"} />
                <DetailItem label="Blood Pressure" value={visit.bloodPressure || "—"} />
                <DetailItem label="Oxygen Saturation" value={visit.oxygenSaturation ? `${visit.oxygenSaturation}%` : "—"} />
                <DetailItem label="Pain Score" value={visit.painScore ?? "—"} />
                <DetailItem label="Weight" value={visit.weightKg ? `${visit.weightKg} kg` : "—"} />
                <DetailItem label="Height" value={visit.heightCm ? `${visit.heightCm} cm` : "—"} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Triage Priority
                </p>
                <div className="mt-2">
                  <PriorityBadge priority={visit.triagePriority} />
                </div>
              </div>

              <ClinicalSection
                label="Triage Notes"
                value={visit.triageNotes}
              />

              <ClinicalSection
                label="Diagnosis"
                value={visit.diagnosis}
              />

              <ClinicalSection
                label="Laboratory Tests Requested"
                value={(visit.labOrders || []).join("\n")}
              />

              {visit.labResults?.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Laboratory Results
                  </h3>
                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-4">
                    {visit.labResults.map((result) => (
                      <article key={result._id} className="py-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{result.testName}</p>
                          <StatusBadge status={result.status} />
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{result.result || "No result recorded"}</p>
                        {result.referenceRange && <p className="mt-1 text-xs text-slate-500">Reference range: {result.referenceRange}</p>}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <ClinicalSection
                label="Differential Diagnosis"
                value={visit.differentialDiagnosis}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Disposition" value={formatDisposition(visit.disposition)} />
                <DetailItem label="Follow-up Date" value={visit.followUpDate ? formatDateTime(visit.followUpDate) : "—"} />
                <DetailItem label="Referral Destination" value={visit.referredTo || "—"} />
              </div>

              <ClinicalSection
                label="Treatment Plan"
                value={visit.treatmentPlan}
              />
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
        <Stethoscope size={28} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">
        No medical visits found
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500">
        {search
          ? "Try changing your search or filters."
          : "No medical visits have been recorded yet."}
      </p>

      {!search && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={17} />
          Create First Visit
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
// CLINICAL SECTION
// =====================================================

const ClinicalSection = ({
  label,
  value,
}) => {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div className="mt-2 rounded-lg bg-slate-50 p-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {value || "No information recorded."}
        </p>
      </div>
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
// VISIT TYPE BADGE
// =====================================================

const VisitTypeBadge = ({ type }) => {
  const config = {
    outpatient: {
      label: "Outpatient",
      className:
        "bg-blue-50 text-blue-700",
    },
    follow_up: {
      label: "Follow Up",
      className:
        "bg-purple-50 text-purple-700",
    },
    emergency: {
      label: "Emergency",
      className:
        "bg-red-50 text-red-700",
    },
  };

  const current =
    config[type] || {
      label: type || "Unknown",
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
// STATUS BADGE
// =====================================================

const PriorityBadge = ({ priority }) => {
  const config = {
    routine: {
      label: "Routine",
      className: "bg-green-50 text-green-700",
    },
    urgent: {
      label: "Urgent",
      className: "bg-amber-50 text-amber-700",
    },
    emergency: {
      label: "Emergency",
      className: "bg-red-50 text-red-700",
    },
  };

  const current = config[priority] || {
    label: priority || "Routine",
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${current.className}`}>
      {current.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    registered: {
      label: "Registered",
      className:
        "bg-sky-50 text-sky-700",
    },
    waiting_for_triage: {
      label: "Waiting for Triage",
      className:
        "bg-amber-50 text-amber-700",
    },
    in_triage: {
      label: "In Triage",
      className:
        "bg-orange-50 text-orange-700",
    },
    waiting_for_doctor: {
      label: "Waiting for Doctor",
      className:
        "bg-yellow-50 text-yellow-700",
    },
    in_consultation: {
      label: "In Consultation",
      className:
        "bg-indigo-50 text-indigo-700",
    },
    awaiting_investigations: {
      label: "Awaiting Investigations",
      className:
        "bg-violet-50 text-violet-700",
    },
    awaiting_results: {
      label: "Awaiting Results",
      className:
        "bg-fuchsia-50 text-fuchsia-700",
    },
    awaiting_pharmacy: {
      label: "Awaiting Pharmacy",
      className:
        "bg-pink-50 text-pink-700",
    },
    admitted: {
      label: "Admitted",
      className:
        "bg-red-50 text-red-700",
    },
    discharge_pending: {
      label: "Discharge Pending",
      className:
        "bg-rose-50 text-rose-700",
    },
    cleared: {
      label: "Cleared",
      className:
        "bg-emerald-50 text-emerald-700",
    },
    closed: {
      label: "Closed",
      className:
        "bg-slate-100 text-slate-700",
    },
    cancelled: {
      label: "Cancelled",
      className:
        "bg-slate-100 text-slate-600",
    },
    referred: {
      label: "Referred",
      className:
        "bg-cyan-50 text-cyan-700",
    },
    left_without_being_seen: {
      label: "Left without being seen",
      className:
        "bg-gray-100 text-gray-700",
    },
    voided: {
      label: "Voided",
      className:
        "bg-red-100 text-red-700",
    },
    deceased: {
      label: "Deceased",
      className:
        "bg-black text-white",
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

const toDateTimeLocal = (date) => {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(
    parsed.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    parsed.getDate()
  ).padStart(2, "0");
  const hours = String(
    parsed.getHours()
  ).padStart(2, "0");
  const minutes = String(
    parsed.getMinutes()
  ).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getCurrentDateTimeLocal = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    now.getDate()
  ).padStart(2, "0");
  const hours = String(
    now.getHours()
  ).padStart(2, "0");
  const minutes = String(
    now.getMinutes()
  ).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

const formatDisposition = (value) => {
  if (!value) return "—";

  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
};

export default MedicalVisitsPage;
