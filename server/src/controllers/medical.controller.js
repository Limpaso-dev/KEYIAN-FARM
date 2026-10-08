import Patient from "../models/Patient.js";
import MedicalVisit from "../models/MedicalVisit.js";
import MedicalLabResult from "../models/MedicalLabResult.js";
import Prescription from "../models/Prescription.js";
import { logAudit, softDeleteRecord } from "../utils/globalRules.js";
import {
  findPossibleDuplicates,
  generatePatientNumber,
  normalizePatientRegistration,
} from "../utils/patientRegistration.js";
import {
  generateVisitNumber,
  isAllowedDoctorVisitTransition,
  normalizeVisitStatus,
} from "../utils/visitLifecycle.js";
import {
  normalizeTriageAssessment,
  isAllowedNurseTriageTransition,
} from "../utils/triage.js";
import {
  normalizeConsultationSummary,
} from "../utils/consultation.js";
import {
  normalizeAdmissionRequest,
  normalizeDischargeSummary,
} from "../utils/admission.js";
import {
  buildExceptionQueue,
} from "../utils/exceptions.js";
import {
  normalizeLabStatus,
  normalizeLabOrders,
  hasRequestedLabOrder,
  getOutstandingLabOrders,
} from "../utils/lab.js";
import {
  normalizePrescriptionStatus,
} from "../utils/prescription.js";

// =====================================================
// PATIENTS
// =====================================================

export const createPatient = async (req, res, next) => {
  try {
    const normalizedPayload = normalizePatientRegistration(req.body);

    if (!normalizedPayload.firstName || !normalizedPayload.lastName) {
      return res.status(400).json({
        success: false,
        message: "Patient first name and last name are required.",
      });
    }

    if (!normalizedPayload.consentAcknowledged) {
      return res.status(400).json({
        success: false,
        message: "Patient consent must be acknowledged before registration.",
      });
    }

    if (normalizedPayload.nationalId && await Patient.exists({ nationalId: normalizedPayload.nationalId })) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to a patient" });
    }

    const existingPatients = await Patient.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).lean();

    const duplicates = findPossibleDuplicates(existingPatients, normalizedPayload);

    if (duplicates.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Possible duplicate patient record detected.",
        duplicates,
      });
    }

    const patientPayload = {
      ...normalizedPayload,
      patientNumber: normalizedPayload.patientNumber || generatePatientNumber(),
      consentDate: normalizedPayload.consentAcknowledged ? new Date() : undefined,
    };

    const patient = await Patient.create(patientPayload);

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "Patient",
      entityId: patient._id,
      before: null,
      after: patient.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    const populatedPatient = await Patient.findById(
      patient._id
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    res.status(201).json({
      success: true,
      message: "Patient created successfully",
      data: populatedPatient,
    });
  } catch (error) {
    if (error.code === 11000 && (error.keyPattern?.nationalId || error.keyValue?.nationalId !== undefined)) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to a patient" });
    }
    next(error);
  }
};

export const getPatients = async (req, res, next) => {
  try {
    const patientQuery = Patient.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).sort({ createdAt: -1 });
    const patients = ["pharmacist", "pharmacy"].includes(req.user.role)
      ? await patientQuery.select("firstName lastName patientNumber estimatedAge dateOfBirth sex status")
      : await patientQuery.populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      );

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
};

export const getPatientById = async (req, res, next) => {
  try {
    const isPharmacyRole = ["pharmacist", "pharmacy"].includes(req.user.role);
    const patient = await Patient.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });
    if (!isPharmacyRole) {
      await patient?.populate("farmer", "firstName lastName membershipNumber phone");
    }

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    if (req.user.role === "receptionist") {
      return res.status(200).json({ success: true, data: patient });
    }

    const [visits, labResults, prescriptions] = await Promise.all([
      MedicalVisit.find({
        patient: patient._id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("clinician", "name role department")
        .sort({ visitDate: -1 })
        .lean(),
      isPharmacyRole ? Promise.resolve([]) : MedicalLabResult.find({
        patient: patient._id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("visit", "visitNumber visitDate")
        .populate("performedBy", "name role department")
        .sort({ createdAt: -1 })
        .lean(),
      Prescription.find({
        patient: patient._id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("visit", "visitNumber visitDate")
        .populate("prescribedBy", "name role department")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (isPharmacyRole) {
      const patientRecord = patient.toObject();
      const data = {
        _id: patientRecord._id,
        firstName: patientRecord.firstName,
        lastName: patientRecord.lastName,
        patientNumber: patientRecord.patientNumber,
        estimatedAge: patientRecord.estimatedAge,
        dateOfBirth: patientRecord.dateOfBirth,
        sex: patientRecord.sex,
        status: patientRecord.status,
        history: {
          visits: visits.map((visit) => ({
            _id: visit._id,
            visitNumber: visit.visitNumber,
            visitDate: visit.visitDate,
            visitType: visit.visitType,
            diagnosis: visit.diagnosis,
            treatmentPlan: visit.treatmentPlan,
            clinician: visit.clinician,
          })),
          prescriptions,
        },
      };

      return res.status(200).json({ success: true, data });
    }

    res.status(200).json({
      success: true,
      data: {
        ...patient.toObject(),
        history: { visits, labResults, prescriptions },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (req, res, next) => {
  try {
    const existingPatient = await Patient.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!existingPatient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const normalizedPayload = normalizePatientRegistration(req.body);

    if (!normalizedPayload.firstName || !normalizedPayload.lastName) {
      return res.status(400).json({
        success: false,
        message: "Patient first name and last name are required.",
      });
    }

    if (normalizedPayload.nationalId && await Patient.exists({ nationalId: normalizedPayload.nationalId, _id: { $ne: existingPatient._id } })) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to another patient" });
    }

    const patientLookup = await Patient.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).lean();

    const otherDuplicates = findPossibleDuplicates(
      patientLookup.filter((patient) => patient._id.toString() !== req.params.id),
      normalizedPayload
    );

    if (otherDuplicates.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This update would create a duplicate patient record.",
        duplicates: otherDuplicates,
      });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      {
        ...normalizedPayload,
        patientNumber: normalizedPayload.patientNumber || existingPatient.patientNumber,
        consentDate: normalizedPayload.consentAcknowledged ? new Date() : existingPatient.consentDate,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "Patient",
      entityId: patient._id,
      before: existingPatient.toObject(),
      after: patient.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Patient updated successfully",
      data: patient,
    });
  } catch (error) {
    if (error.code === 11000 && (error.keyPattern?.nationalId || error.keyValue?.nationalId !== undefined)) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to another patient" });
    }
    next(error);
  }
};

export const deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const softDeletedPatient = softDeleteRecord(patient.toObject(), {
      actor: req.user,
      reason: req.body?.reason || "Administrative void",
      metadata: { ip: req.ip },
    });

    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      softDeletedPatient,
      {
        new: true,
        runValidators: true,
      }
    );

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "Patient",
      entityId: patient._id,
      before: patient.toObject(),
      after: updatedPatient.toObject(),
      metadata: {
        reason: req.body?.reason || "Administrative void",
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Patient voided successfully",
      data: updatedPatient,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// MEDICAL VISITS
// =====================================================

const pickVisitFields = (source, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
);

const projectReceptionVisit = (visit) => {
  const record = visit?.toObject ? visit.toObject() : visit;
  const patient = record.patient?.toObject ? record.patient.toObject() : record.patient;
  return {
    _id: record._id,
    patient: patient ? {
      _id: patient._id,
      patientNumber: patient.patientNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
    } : null,
    visitNumber: record.visitNumber,
    visitDate: record.visitDate,
    visitType: record.visitType,
    status: record.status,
  };
};

const projectNurseTriageVisit = (visit) => {
  const record = visit?.toObject ? visit.toObject() : visit;
  const patient = record.patient?.toObject ? record.patient.toObject() : record.patient;
  return {
    _id: record._id,
    patient: patient ? pickVisitFields(patient, ["_id", "patientNumber", "firstName", "lastName", "estimatedAge", "dateOfBirth", "sex"]) : null,
    visitNumber: record.visitNumber,
    visitDate: record.visitDate,
    visitType: record.visitType,
    chiefComplaint: record.chiefComplaint,
    temperature: record.temperature,
    pulseRate: record.pulseRate,
    respiratoryRate: record.respiratoryRate,
    bloodPressure: record.bloodPressure,
    oxygenSaturation: record.oxygenSaturation,
    weightKg: record.weightKg,
    heightCm: record.heightCm,
    painScore: record.painScore,
    triagePriority: record.triagePriority,
    triageNotes: record.triageNotes,
    triageCompletedAt: record.triageCompletedAt,
    status: record.status,
  };
};

const attachLabResultsToVisits = async (visits) => {
  if (!visits.length) return visits;
  const visitIds = visits.map((visit) => visit._id);
  const results = await MedicalLabResult.find({
    visit: { $in: visitIds },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .populate("performedBy", "name role department")
    .sort({ createdAt: -1 })
    .lean();
  const resultsByVisit = new Map();
  results.forEach((result) => {
    const key = String(result.visit);
    resultsByVisit.set(key, [...(resultsByVisit.get(key) || []), result]);
  });
  return visits.map((visit) => ({
    ...(visit.toObject ? visit.toObject() : visit),
    labResults: resultsByVisit.get(String(visit._id)) || [],
  }));
};

const areVisitLabOrdersComplete = async (visit) => {
  const orders = normalizeLabOrders(visit?.labOrders);
  if (!orders.length) return true;
  const completedResults = await MedicalLabResult.find({
    visit: visit._id,
    status: "completed",
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  }).select("testName").lean();
  const completedNames = new Set(completedResults.map((result) => String(result.testName).trim().toLowerCase()));
  return orders.every((order) => completedNames.has(order.toLowerCase()));
};

const returnVisitToDoctorWhenLabsComplete = async (visitId, actor) => {
  const visit = await MedicalVisit.findById(visitId);
  if (!visit || visit.status !== "awaiting_results" || !(await areVisitLabOrdersComplete(visit))) return;
  const before = visit.toObject();
  visit.status = "waiting_for_doctor";
  await visit.save();
  await logAudit({
    actor,
    action: "lab_results_completed",
    entity: "MedicalVisit",
    entityId: visit._id,
    before,
    after: visit.toObject(),
  });
};

const isVisitStatusAllowed = (role, status, currentStatus) => {
  const statusByRole = {
    receptionist: ["registered", "waiting_for_triage"],
    nurse: ["in_triage", "waiting_for_doctor"],
  };
  const allowedStatuses = statusByRole[role];
  if (!allowedStatuses || !status) return true;
  const normalizedStatus = normalizeVisitStatus(status);
  if (role === "nurse" && !["waiting_for_triage", "in_triage"].includes(currentStatus)) return false;
  return normalizedStatus === currentStatus || allowedStatuses.includes(normalizedStatus);
};

export const createMedicalVisit = async (
  req,
  res,
  next
) => {
  try {
    const role = req.user.role;
    if (role === "receptionist" && Object.hasOwn(req.body || {}, "status")) {
      return res.status(403).json({ success: false, message: "Receptionists cannot set a patient visit status" });
    }
    const visitInput = role === "receptionist"
      ? pickVisitFields(req.body, ["patient", "visitDate", "visitType"])
      : req.body;
    const labOrders = normalizeLabOrders(visitInput?.labOrders);
    if (!isVisitStatusAllowed(role, visitInput?.status)) {
      return res.status(403).json({ success: false, message: "This role cannot set that visit status" });
    }
    if (labOrders.length && req.user.role !== "doctor") {
      return res.status(403).json({ success: false, message: "Only doctors can request laboratory tests" });
    }
    if (labOrders.length && !String(req.body?.diagnosis || "").trim()) {
      return res.status(400).json({ success: false, message: "A diagnosis is required before ordering laboratory tests" });
    }

    const payload = {
      ...visitInput,
      labOrders: req.user.role === "doctor" ? labOrders : [],
      status: normalizeVisitStatus(visitInput?.status || (role === "receptionist" ? "waiting_for_triage" : undefined)),
      visitNumber: visitInput?.visitNumber || generateVisitNumber(),
      ...(role === "doctor" ? normalizeConsultationSummary(visitInput) : {}),
    };

    // Automatically assign logged-in user as clinician
    if (!payload.clinician && req.user?._id) {
      payload.clinician = req.user._id;
    }

    const visit = await MedicalVisit.create(payload);

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "MedicalVisit",
      entityId: visit._id,
      before: null,
      after: visit.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    const populatedVisit = await MedicalVisit.findById(
      visit._id
    )
      .populate("patient")
      .populate(
        "clinician",
        "name email role department"
      );

    res.status(201).json({
      success: true,
      message: "Medical visit created successfully",
      data: role === "receptionist" ? projectReceptionVisit(populatedVisit) : populatedVisit,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalVisits = async (
  req,
  res,
  next
) => {
  try {
    const filter = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };
    if (req.user.role === "nurse") filter.status = { $in: ["waiting_for_triage", "in_triage"] };
    if (req.user.role === "doctor") filter.status = { $in: ["waiting_for_doctor", "in_consultation"] };
    const visits = await MedicalVisit.find(filter)
      .populate("patient")
      .populate(
        "clinician",
        "name email role department"
      )
      .sort({ visitDate: -1, createdAt: -1 });

    const doctorVisits = req.user.role === "doctor" ? await attachLabResultsToVisits(visits) : visits;
    const data = req.user.role === "receptionist"
      ? visits.map(projectReceptionVisit)
      : req.user.role === "nurse"
        ? visits.map(projectNurseTriageVisit)
        : doctorVisits;

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalVisitById = async (
  req,
  res,
  next
) => {
  try {
    const filter = {
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };
    if (req.user.role === "nurse") filter.status = { $in: ["waiting_for_triage", "in_triage"] };
    if (req.user.role === "doctor") filter.status = { $in: ["waiting_for_doctor", "in_consultation"] };
    const visit = await MedicalVisit.findOne(filter)
      .populate("patient")
      .populate(
        "clinician",
        "name email role department"
      );

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const data = req.user.role === "doctor"
      ? (await attachLabResultsToVisits([visit]))[0]
      : req.user.role === "receptionist"
        ? projectReceptionVisit(visit)
        : req.user.role === "nurse"
          ? projectNurseTriageVisit(visit)
          : visit;

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMedicalVisit = async (
  req,
  res,
  next
) => {
  try {
    const existingVisit = await MedicalVisit.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!existingVisit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const role = req.user.role;
    if (role === "receptionist" && Object.hasOwn(req.body || {}, "status")) {
      return res.status(403).json({ success: false, message: "Receptionists cannot change a patient visit status" });
    }
    const visitInput = role === "receptionist"
      ? pickVisitFields(req.body, ["visitDate", "visitType"])
      : role === "nurse"
        ? pickVisitFields(req.body, ["chiefComplaint", "temperature", "pulseRate", "respiratoryRate", "bloodPressure", "oxygenSaturation", "weightKg", "heightCm", "painScore", "triagePriority", "triageNotes", "status"])
        : role === "doctor"
          ? pickVisitFields(req.body, ["clinicalNotes", "assessment", "diagnosis", "differentialDiagnosis", "labOrders", "treatmentPlan", "disposition", "followUpDate", "referredTo", "status"])
        : req.body;

    if (role === "nurse" && !isAllowedNurseTriageTransition(
      existingVisit.status,
      normalizeVisitStatus(visitInput.status ?? existingVisit.status)
    )) {
      return res.status(409).json({ success: false, message: "This visit is no longer in the nurse triage queue or the requested transition is invalid" });
    }

    if (req.body?.labOrders !== undefined && role !== "doctor") {
      return res.status(403).json({ success: false, message: "Only doctors can update laboratory requests" });
    }

    const labOrders = visitInput?.labOrders === undefined
      ? undefined
      : normalizeLabOrders(visitInput.labOrders);
    const diagnosis = visitInput?.diagnosis ?? existingVisit.diagnosis;
    const visitForLabCheck = {
      ...existingVisit.toObject(),
      labOrders: labOrders ?? existingVisit.labOrders,
    };
    const hasPendingLabOrders = role === "doctor" && !await areVisitLabOrdersComplete(visitForLabCheck);
    const nextStatus = hasPendingLabOrders
      ? "awaiting_results"
      : normalizeVisitStatus(visitInput?.status ?? existingVisit.status);
    if (role === "doctor" && !isAllowedDoctorVisitTransition(existingVisit.status, nextStatus)) {
      return res.status(409).json({ success: false, message: "This doctor handoff is not valid from the current visit state" });
    }
    if (!isVisitStatusAllowed(role, visitInput?.status, existingVisit.status)) {
      return res.status(403).json({ success: false, message: "This role cannot set that visit status" });
    }
    if (labOrders?.length && !String(diagnosis || "").trim()) {
      return res.status(400).json({ success: false, message: "A diagnosis is required before ordering laboratory tests" });
    }
    if (role === "doctor" && nextStatus === "awaiting_results" && !labOrders?.length && !existingVisit.labOrders?.length) {
      return res.status(400).json({ success: false, message: "Order at least one laboratory test before sending the visit to the lab" });
    }
    if (role === "doctor" && nextStatus === "awaiting_pharmacy" && !await Prescription.exists({
      visit: existingVisit._id,
      status: "prescribed",
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })) {
      return res.status(400).json({ success: false, message: "Create a prescription before sending the patient to Pharmacy" });
    }
    if (role === "doctor" && nextStatus === "awaiting_billing") {
      if (!(await areVisitLabOrdersComplete({ ...existingVisit.toObject(), labOrders: labOrders ?? existingVisit.labOrders }))) {
        return res.status(409).json({ success: false, message: "Wait for all ordered laboratory results before billing" });
      }
      if (await Prescription.exists({
        visit: existingVisit._id,
        status: "prescribed",
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })) {
        return res.status(409).json({ success: false, message: "Send prescribed medication through Pharmacy before billing" });
      }
    }

    const payload = role === "doctor"
      ? {
          ...visitInput,
          ...(labOrders === undefined ? {} : { labOrders }),
          status: nextStatus,
          ...normalizeConsultationSummary(visitInput),
        }
      : role === "nurse"
        ? {
            ...visitInput,
            status: normalizeVisitStatus(visitInput?.status ?? existingVisit.status),
            ...normalizeTriageAssessment(visitInput),
            triageCompletedAt: normalizeVisitStatus(visitInput?.status ?? existingVisit.status) === "waiting_for_doctor"
              ? new Date()
              : existingVisit.triageCompletedAt,
          }
        : {
            ...visitInput,
            status: normalizeVisitStatus(visitInput?.status ?? existingVisit.status),
          };

    const visit = await MedicalVisit.findByIdAndUpdate(
      req.params.id,
      payload,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("patient")
      .populate(
        "clinician",
        "name email role department"
      );

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "MedicalVisit",
      entityId: visit._id,
      before: existingVisit.toObject(),
      after: visit.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Medical visit updated successfully",
      data: role === "receptionist" ? projectReceptionVisit(visit) : visit,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMedicalVisit = async (
  req,
  res,
  next
) => {
  try {
    const visit = await MedicalVisit.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const softDeletedVisit = softDeleteRecord(visit.toObject(), {
      actor: req.user,
      reason: req.body?.reason || "Administrative void",
      metadata: { ip: req.ip },
    });

    const updatedVisit = await MedicalVisit.findByIdAndUpdate(
      req.params.id,
      softDeletedVisit,
      {
        new: true,
        runValidators: true,
      }
    );

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "MedicalVisit",
      entityId: visit._id,
      before: visit.toObject(),
      after: updatedVisit.toObject(),
      metadata: {
        reason: req.body?.reason || "Administrative void",
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Medical visit voided successfully",
      data: updatedVisit,
    });
  } catch (error) {
    next(error);
  }
};

export const admitMedicalVisit = async (req, res, next) => {
  try {
    const existingVisit = await MedicalVisit.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!existingVisit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const normalizedAdmission = normalizeAdmissionRequest({
      ...existingVisit.toObject(),
      ...req.body,
    });

    const visit = await MedicalVisit.findByIdAndUpdate(
      req.params.id,
      {
        ...existingVisit.toObject(),
        ...req.body,
        ...normalizedAdmission,
        disposition: req.body?.disposition || "admit",
        status: normalizedAdmission.status,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("patient")
      .populate("clinician", "name email role department");

    await logAudit({
      actor: req.user,
      action: "admit",
      entity: "MedicalVisit",
      entityId: visit._id,
      before: existingVisit.toObject(),
      after: visit.toObject(),
      metadata: {
        ward: normalizedAdmission.ward,
        bedNumber: normalizedAdmission.bedNumber,
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Patient admitted successfully",
      data: visit,
    });
  } catch (error) {
    next(error);
  }
};

export const dischargeMedicalVisit = async (req, res, next) => {
  try {
    const existingVisit = await MedicalVisit.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!existingVisit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const normalizedDischarge = normalizeDischargeSummary({
      ...existingVisit.toObject(),
      ...req.body,
    });

    const visit = await MedicalVisit.findByIdAndUpdate(
      req.params.id,
      {
        ...existingVisit.toObject(),
        ...req.body,
        ...normalizedDischarge,
        disposition: req.body?.disposition || "discharge",
        status: normalizedDischarge.status,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("patient")
      .populate("clinician", "name email role department");

    await logAudit({
      actor: req.user,
      action: "discharge",
      entity: "MedicalVisit",
      entityId: visit._id,
      before: existingVisit.toObject(),
      after: visit.toObject(),
      metadata: {
        dischargeSummary: normalizedDischarge.dischargeSummary,
        dischargePlan: normalizedDischarge.dischargePlan,
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Patient discharge summary saved successfully",
      data: visit,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// MEDICAL LAB RESULTS
// =====================================================

export const getMedicalLabWorklist = async (req, res, next) => {
  try {
    const visits = await MedicalVisit.find({
      diagnosis: { $exists: true, $nin: [null, ""] },
      labOrders: { $exists: true, $ne: [] },
      status: { $nin: ["cancelled", "voided", "deceased"] },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .populate({
        path: "patient",
        match: { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
        select: "firstName lastName patientNumber estimatedAge dateOfBirth sex",
      })
      .populate("clinician", "name role department")
      .sort({ visitDate: -1 })
      .lean();

    const completedResults = await MedicalLabResult.find({
      visit: { $in: visits.map((visit) => visit._id) },
      status: "completed",
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).select("visit testName").lean();
    const completedByVisit = new Map();
    completedResults.forEach((result) => {
      const key = String(result.visit);
      completedByVisit.set(key, new Set([...(completedByVisit.get(key) || []), String(result.testName).trim().toLowerCase()]));
    });

    const data = visits
      .filter((visit) => visit.patient)
      .map((visit) => {
        const completed = completedByVisit.get(String(visit._id)) || new Set();
        return {
          _id: visit._id,
          patient: visit.patient,
          clinician: visit.clinician,
          visitNumber: visit.visitNumber,
          visitDate: visit.visitDate,
          visitType: visit.visitType,
          diagnosis: visit.diagnosis,
          labOrders: getOutstandingLabOrders(visit.labOrders || [], [...completed]),
        };
      })
      .filter((visit) => visit.labOrders.length > 0);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const getMedicalLabPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find({
      status: { $ne: "voided" },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .select("firstName lastName patientNumber estimatedAge dateOfBirth sex")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    res.status(200).json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    next(error);
  }
};

const populateMedicalLabResult = (query) => query
  .populate("patient", "firstName lastName patientNumber estimatedAge dateOfBirth sex nationalId phone address status")
  .populate({
    path: "visit",
    select: "visitDate visitType visitNumber diagnosis labOrders clinician",
    populate: { path: "clinician", select: "name role department" },
  })
  .populate("performedBy", "name role department");

export const createMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
    if (req.user.role === "laboratory") {
      const visit = await MedicalVisit.findOne({
        _id: req.body.visit,
        patient: req.body.patient,
        diagnosis: { $exists: true, $nin: [null, ""] },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      });
      if (!visit || !hasRequestedLabOrder(visit, req.body.testName)) {
        return res.status(400).json({ success: false, message: "Select a patient visit and test ordered by a doctor" });
      }
    }

    const payload = {
      ...req.body,
      status: normalizeLabStatus(req.body?.status, req.body),
    };

    // Automatically assign logged-in user as lab performer
    if (!payload.performedBy && req.user?._id) {
      payload.performedBy = req.user._id;
    }

    // Automatically set performedAt when not provided
    if (!payload.performedAt) {
      payload.performedAt = new Date();
    }

    const labResult = await MedicalLabResult.create(
      payload
    );

    if (labResult.visit && labResult.status === "completed") {
      await returnVisitToDoctorWhenLabsComplete(labResult.visit, req.user);
    }

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "MedicalLabResult",
      entityId: labResult._id,
      before: null,
      after: labResult.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    const populatedLabResult = await populateMedicalLabResult(
      MedicalLabResult.findById(labResult._id)
    );

    res.status(201).json({
      success: true,
      message: "Medical lab result created successfully",
      data: populatedLabResult,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalLabResults = async (
  req,
  res,
  next
) => {
  try {
    const labResults = await populateMedicalLabResult(MedicalLabResult.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: labResults.length,
      data: labResults,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalLabResultById = async (
  req,
  res,
  next
) => {
  try {
    const labResult = await populateMedicalLabResult(MedicalLabResult.findOne({
        _id: req.params.id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      }));

    if (!labResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    res.status(200).json({
      success: true,
      data: labResult,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
    const existingLabResult = await MedicalLabResult.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!existingLabResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    if (req.user.role === "laboratory") {
      const visitId = req.body.visit || existingLabResult.visit;
      const patientId = req.body.patient || existingLabResult.patient;
      const testName = req.body.testName || existingLabResult.testName;
      const visit = await MedicalVisit.findOne({ _id: visitId, patient: patientId });
      if (!visit || !hasRequestedLabOrder(visit, testName)) {
        return res.status(400).json({ success: false, message: "Laboratory results must match a doctor-ordered test" });
      }
    }

    const normalizedPayload = {
      ...existingLabResult.toObject(),
      ...req.body,
      status: normalizeLabStatus(req.body?.status ?? existingLabResult.status, {
        ...existingLabResult.toObject(),
        ...req.body,
      }),
    };

    const labResult = await populateMedicalLabResult(MedicalLabResult.findByIdAndUpdate(
        req.params.id,
        normalizedPayload,
        {
          new: true,
          runValidators: true,
        }
      ));

    if (labResult.visit && labResult.status === "completed") {
      await returnVisitToDoctorWhenLabsComplete(labResult.visit._id || labResult.visit, req.user);
    }

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "MedicalLabResult",
      entityId: labResult._id,
      before: existingLabResult.toObject(),
      after: labResult.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Medical lab result updated successfully",
      data: labResult,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
    const labResult = await MedicalLabResult.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!labResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    const softDeletedLabResult = softDeleteRecord(labResult.toObject(), {
      actor: req.user,
      reason: req.body?.reason || "Administrative void",
      metadata: { ip: req.ip },
    });

    const updatedLabResult = await MedicalLabResult.findByIdAndUpdate(
      req.params.id,
      softDeletedLabResult,
      {
        new: true,
        runValidators: true,
      }
    );

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "MedicalLabResult",
      entityId: labResult._id,
      before: labResult.toObject(),
      after: updatedLabResult.toObject(),
      metadata: {
        reason: req.body?.reason || "Administrative void",
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Medical lab result voided successfully",
      data: updatedLabResult,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// PRESCRIPTIONS
// =====================================================

const populatePrescription = (query) => query
  .populate("patient", "firstName lastName patientNumber estimatedAge dateOfBirth sex nationalId phone address status")
  .populate("visit", "visitNumber visitDate visitType diagnosis treatmentPlan")
  .populate("prescribedBy", "name role department");

export const createPrescription = async (
  req,
  res,
  next
) => {
  try {
    let consultationVisit = null;
    if (req.user.role === "doctor") {
      if (!req.body.visit) {
        return res.status(400).json({ success: false, message: "Link the prescription to the active medical visit" });
      }
      consultationVisit = await MedicalVisit.findOne({
        _id: req.body.visit,
        patient: req.body.patient,
        status: "in_consultation",
        diagnosis: { $exists: true, $nin: [null, ""] },
      });
      if (!consultationVisit) {
        return res.status(409).json({ success: false, message: "Prescriptions require a diagnosed visit in consultation" });
      }
      if (!(await areVisitLabOrdersComplete(consultationVisit))) {
        return res.status(409).json({ success: false, message: "Review all ordered laboratory results before prescribing" });
      }
    }

    const payload = {
      ...req.body,
      status: req.user.role === "doctor" ? "prescribed" : normalizePrescriptionStatus(req.body?.status, req.body),
    };

    // Automatically assign logged-in user as prescriber
    if (req.user.role === "doctor") {
      payload.prescribedBy = req.user._id;
    } else if (!payload.prescribedBy && req.user?._id) {
      payload.prescribedBy = req.user._id;
    }

    const prescription =
      await Prescription.create(payload);

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "Prescription",
      entityId: prescription._id,
      before: null,
      after: prescription.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    if (consultationVisit) {
      const beforeVisit = consultationVisit.toObject();
      consultationVisit.status = "awaiting_pharmacy";
      await consultationVisit.save();
      await logAudit({
        actor: req.user,
        action: "prescription_sent_to_pharmacy",
        entity: "MedicalVisit",
        entityId: consultationVisit._id,
        before: beforeVisit,
        after: consultationVisit.toObject(),
        metadata: { prescription: prescription._id, ip: req.ip },
      });
    }

    const populatedPrescription = await populatePrescription(
      Prescription.findById(prescription._id)
    );

    res.status(201).json({
      success: true,
      message: "Prescription created successfully",
      data: populatedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

export const getPrescriptions = async (
  req,
  res,
  next
) => {
  try {
    const prescriptions = await populatePrescription(Prescription.find({
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions,
    });
  } catch (error) {
    next(error);
  }
};

export const getPrescriptionById = async (
  req,
  res,
  next
) => {
  try {
    const prescription = await populatePrescription(Prescription.findOne({
        _id: req.params.id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      }));

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    res.status(200).json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePrescription = async (
  req,
  res,
  next
) => {
  try {
    const existingPrescription = await Prescription.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!existingPrescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    if (["pharmacist", "pharmacy"].includes(req.user.role)) {
      const submittedFields = Object.keys(req.body || {});
      if (submittedFields.some((field) => field !== "status") || req.body.status !== "dispensed") {
        return res.status(403).json({
          success: false,
          message: "Pharmacy staff may only mark a prescribed medication as dispensed",
        });
      }
      if (existingPrescription.status !== "prescribed") {
        return res.status(409).json({ success: false, message: "Only prescribed medication can be dispensed" });
      }
    }

    const normalizedPayload = {
      ...existingPrescription.toObject(),
      ...req.body,
      status: normalizePrescriptionStatus(req.body?.status ?? existingPrescription.status, {
        ...existingPrescription.toObject(),
        ...req.body,
      }),
    };

    const prescription = await populatePrescription(Prescription.findByIdAndUpdate(
        req.params.id,
        normalizedPayload,
        {
          new: true,
          runValidators: true,
        }
      ));

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "Prescription",
      entityId: prescription._id,
      before: existingPrescription.toObject(),
      after: prescription.toObject(),
      metadata: {
        ip: req.ip,
      },
    });

    if (["pharmacist", "pharmacy"].includes(req.user.role) && prescription.status === "dispensed" && prescription.visit) {
      const visitId = prescription.visit._id || prescription.visit;
      const remainingPrescriptions = await Prescription.countDocuments({
        visit: visitId,
        status: "prescribed",
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      });
      const visit = await MedicalVisit.findOne({ _id: visitId, status: "awaiting_pharmacy" });
      if (visit && remainingPrescriptions === 0) {
        const beforeVisit = visit.toObject();
        visit.status = "awaiting_billing";
        await visit.save();
        await logAudit({
          actor: req.user,
          action: "pharmacy_handoff_completed",
          entity: "MedicalVisit",
          entityId: visit._id,
          before: beforeVisit,
          after: visit.toObject(),
          metadata: { prescription: prescription._id, ip: req.ip },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Prescription updated successfully",
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePrescription = async (
  req,
  res,
  next
) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    const softDeletedPrescription = softDeleteRecord(prescription.toObject(), {
      actor: req.user,
      reason: req.body?.reason || "Administrative void",
      metadata: { ip: req.ip },
    });

    const updatedPrescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      softDeletedPrescription,
      {
        new: true,
        runValidators: true,
      }
    );

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "Prescription",
      entityId: prescription._id,
      before: prescription.toObject(),
      after: updatedPrescription.toObject(),
      metadata: {
        reason: req.body?.reason || "Administrative void",
        ip: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Prescription voided successfully",
      data: updatedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalExceptions = async (req, res, next) => {
  try {
    const visits = await MedicalVisit.find({
      status: {
        $in: [
          "left_without_being_seen",
          "referred",
          "cancelled",
          "voided",
          "deceased",
          "manual_back_entry",
          "downtime_entry",
        ],
      },
    })
      .populate("patient", "firstName lastName patientNumber")
      .sort({ updatedAt: -1 })
      .lean();

    const queue = buildExceptionQueue(visits);

    return res.status(200).json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalSummary = async (req, res, next) => {
  try {
    const role = req.user.role;
    const canRead = (roles) =>
      ["admin", "super_admin", "manager"].includes(role) ||
      roles.includes(role);
    const canReadPatients = canRead(["doctor", "nurse", "receptionist"]);
    const canReadVisits = canRead(["doctor", "nurse", "receptionist"]);
    const canReadLab = canRead(["doctor", "nurse", "laboratory"]);
    const canReadPrescriptions = canRead(["doctor", "pharmacist", "pharmacy"]);

    const nairobiParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const dateParts = Object.fromEntries(
      nairobiParts.map(({ type, value }) => [type, value])
    );
    const startOfToday = new Date(
      Date.UTC(
        Number(dateParts.year),
        Number(dateParts.month) - 1,
        Number(dateParts.day)
      ) - 3 * 60 * 60 * 1000
    );
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const [patients, todaysVisits, pendingLab, prescriptions, exceptions] = await Promise.all([
      canReadPatients ? Patient.countDocuments() : null,
      canReadVisits
        ? MedicalVisit.countDocuments({
            visitDate: { $gte: startOfToday, $lt: startOfTomorrow },
            status: { $ne: "cancelled" },
          })
        : null,
      canReadLab
        ? MedicalLabResult.countDocuments({ status: "pending" })
        : null,
      canReadPrescriptions ? Prescription.countDocuments() : null,
      canReadVisits
        ? MedicalVisit.countDocuments({
            status: {
              $in: [
                "left_without_being_seen",
                "referred",
                "cancelled",
                "voided",
                "deceased",
                "manual_back_entry",
                "downtime_entry",
              ],
            },
          })
        : null,
    ]);

    return res.status(200).json({
      success: true,
      data: {
        patients,
        todaysVisits,
        pendingLab,
        prescriptions,
        exceptions,
      },
    });
  } catch (error) {
    return next(error);
  }
};
