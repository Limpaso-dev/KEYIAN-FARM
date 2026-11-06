import { randomInt } from "node:crypto";
import prisma from "../config/prisma.js";
import { logAudit } from "../utils/globalRules.js";
import { serializePrismaRecord } from "../utils/prismaRecords.js";
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

const farmerSummary = {
  id: true,
  firstName: true,
  lastName: true,
  membershipNumber: true,
  phone: true,
};
const isNationalIdConflict = (error) =>
  error.code === "P2002" && String(error.meta?.target || "").includes("nationalId");
const relationId = (value) => value && typeof value === "object"
  ? value.id || value._id
  : value;

const patientData = (payload, existing) => ({
  patientNumber: payload.patientNumber || existing?.patientNumber || generatePatientNumber(),
  farmerId: payload.farmer === undefined ? existing?.farmerId : payload.farmer,
  firstName: payload.firstName,
  lastName: payload.lastName,
  dateOfBirth: payload.dateOfBirth
    ? new Date(payload.dateOfBirth)
    : existing?.dateOfBirth || null,
  estimatedAge: payload.estimatedAge ?? existing?.estimatedAge ?? null,
  sex: payload.sex,
  phone: payload.phone,
  address: payload.address,
  nationalId: payload.nationalId === undefined
    ? existing?.nationalId || null
    : payload.nationalId || null,
  payer: payload.payer,
  payerDetails: payload.payerDetails,
  isTemporary: payload.isTemporary,
  temporaryId: payload.temporaryId || existing?.temporaryId || null,
  consentAcknowledged: payload.consentAcknowledged,
  consentDate: payload.consentAcknowledged ? new Date() : existing?.consentDate || null,
  nextOfKin: payload.nextOfKin,
});

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

    if (normalizedPayload.nationalId && await prisma.patient.findFirst({
      where: { nationalId: normalizedPayload.nationalId },
      select: { id: true },
    })) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to a patient" });
    }

    const existingPatients = serializePrismaRecord(await prisma.patient.findMany({
      where: { deletedAt: null },
    }));

    const duplicates = findPossibleDuplicates(existingPatients, normalizedPayload);

    if (duplicates.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Possible duplicate patient record detected.",
        duplicates,
      });
    }

    const patient = await prisma.patient.create({
      data: patientData(normalizedPayload),
    });

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "Patient",
      entityId: patient.id,
      before: null,
      after: serializePrismaRecord(patient),
      metadata: {
        ip: req.ip,
      },
    });

    const populatedPatient = await prisma.patient.findUnique({
      where: { id: patient.id },
      include: { farmer: { select: farmerSummary } },
    });

    return res.status(201).json({
      success: true,
      message: "Patient created successfully",
      data: serializePrismaRecord(populatedPatient),
    });
  } catch (error) {
    if (isNationalIdConflict(error)) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to a patient" });
    }
    return next(error);
  }
};

export const getPatients = async (req, res, next) => {
  try {
    const pharmacyRole = ["pharmacist", "pharmacy"].includes(req.user.role);
    const patients = await prisma.patient.findMany({
      where: { deletedAt: null },
      ...(pharmacyRole
        ? {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientNumber: true,
            estimatedAge: true,
            dateOfBirth: true,
            sex: true,
            status: true,
          },
        }
        : { include: { farmer: { select: farmerSummary } } }),
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: serializePrismaRecord(patients),
    });
  } catch (error) {
    return next(error);
  }
};

export const getPatientById = async (req, res, next) => {
  try {
    const isPharmacyRole = ["pharmacist", "pharmacy"].includes(req.user.role);
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, deletedAt: null },
      ...(isPharmacyRole ? {} : { include: { farmer: { select: farmerSummary } } }),
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    if (req.user.role === "receptionist") {
      return res.status(200).json({ success: true, data: serializePrismaRecord(patient) });
    }

    const [visits, labResults, prescriptions] = await Promise.all([
      prisma.medicalVisit.findMany({
        where: { patientId: patient.id, deletedAt: null },
        include: { clinician: { select: { id: true, name: true, role: true, department: true } } },
        orderBy: { visitDate: "desc" },
      }),
      isPharmacyRole ? Promise.resolve([]) : prisma.medicalLabResult.findMany({
        where: { patientId: patient.id, deletedAt: null },
        include: {
          visit: { select: { id: true, visitNumber: true, visitDate: true } },
          performedBy: { select: { id: true, name: true, role: true, department: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.prescription.findMany({
        where: { patientId: patient.id, deletedAt: null },
        include: {
          visit: { select: { id: true, visitNumber: true, visitDate: true } },
          prescribedBy: { select: { id: true, name: true, role: true, department: true } },
          medications: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const patientRecord = serializePrismaRecord(patient);
    const visitRecords = serializePrismaRecord(visits);
    const labRecords = serializePrismaRecord(labResults);
    const prescriptionRecords = serializePrismaRecord(prescriptions);

    if (isPharmacyRole) {
      const data = {
        _id: patientRecord.id,
        firstName: patientRecord.firstName,
        lastName: patientRecord.lastName,
        patientNumber: patientRecord.patientNumber,
        estimatedAge: patientRecord.estimatedAge,
        dateOfBirth: patientRecord.dateOfBirth,
        sex: patientRecord.sex,
        status: patientRecord.status,
        history: {
          visits: visitRecords.map((visit) => ({
            _id: visit.id,
            visitNumber: visit.visitNumber,
            visitDate: visit.visitDate,
            visitType: visit.visitType,
            diagnosis: visit.diagnosis,
            treatmentPlan: visit.treatmentPlan,
            clinician: visit.clinician,
          })),
          prescriptions: prescriptionRecords,
        },
      };

      return res.status(200).json({ success: true, data });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...patientRecord,
        history: { visits: visitRecords, labResults: labRecords, prescriptions: prescriptionRecords },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePatient = async (req, res, next) => {
  try {
    const existingPatient = await prisma.patient.findFirst({
      where: { id: req.params.id, deletedAt: null },
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

    if (normalizedPayload.nationalId && await prisma.patient.findFirst({
      where: { nationalId: normalizedPayload.nationalId, id: { not: existingPatient.id } },
      select: { id: true },
    })) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to another patient" });
    }

    const patientLookup = serializePrismaRecord(await prisma.patient.findMany({
      where: { deletedAt: null },
    }));

    const otherDuplicates = findPossibleDuplicates(
      patientLookup.filter((patient) => patient.id !== req.params.id),
      normalizedPayload
    );

    if (otherDuplicates.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This update would create a duplicate patient record.",
        duplicates: otherDuplicates,
      });
    }

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: patientData(normalizedPayload, existingPatient),
      include: { farmer: { select: farmerSummary } },
    });

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "Patient",
      entityId: patient.id,
      before: serializePrismaRecord(existingPatient),
      after: serializePrismaRecord(patient),
      metadata: {
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Patient updated successfully",
      data: serializePrismaRecord(patient),
    });
  } catch (error) {
    if (isNationalIdConflict(error)) {
      return res.status(409).json({ success: false, message: "This National ID / Birth Certificate number is already registered to another patient" });
    }
    return next(error);
  }
};

export const deletePatient = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const now = new Date();
    const reason = req.body?.reason || "Administrative void";
    const updatedPatient = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        status: patient.status === "cancelled" ? "cancelled" : "voided",
        deletedAt: now,
        deletedById: req.user.id,
        voidedAt: now,
        voidedById: req.user.id,
        voidReason: reason,
      },
    });

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "Patient",
      entityId: patient.id,
      before: serializePrismaRecord(patient),
      after: serializePrismaRecord(updatedPatient),
      metadata: {
        reason,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Patient voided successfully",
      data: serializePrismaRecord(updatedPatient),
    });
  } catch (error) {
    return next(error);
  }
};

// =====================================================
// MEDICAL VISITS
// =====================================================

const pickVisitFields = (source, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
);

const visitInclude = {
  patient: true,
  clinician: { select: { id: true, name: true, email: true, role: true, department: true } },
};

const visitFields = [
  "patientId", "clinicianId", "visitNumber", "visitDate", "visitType",
  "chiefComplaint", "clinicalNotes", "triagePriority", "temperature", "pulseRate",
  "respiratoryRate", "bloodPressure", "oxygenSaturation", "weightKg", "heightCm",
  "painScore", "triageNotes", "triageCompletedAt", "assessment", "diagnosis",
  "differentialDiagnosis", "labOrders", "treatmentPlan", "disposition", "ward",
  "bedNumber", "admissionReason", "admittedAt", "dischargeSummary", "dischargePlan",
  "dischargedAt", "transferTo", "followUpDate", "referredTo", "status",
];

const visitData = (payload) => {
  const data = {};
  const aliases = { patient: "patientId", clinician: "clinicianId" };
  for (const field of visitFields) {
    const alias = Object.entries(aliases).find(([, target]) => target === field)?.[0];
    const sourceField = alias && payload[alias] !== undefined
      ? alias
      : field;
    if (payload[sourceField] === undefined) continue;
    const value = payload[sourceField];
    data[field] = [
      "visitDate", "triageCompletedAt", "admittedAt", "dischargedAt", "followUpDate",
    ].includes(field) && value !== null && !(value instanceof Date)
      ? new Date(value)
      : value;
  }
  return data;
};

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
  const visitIds = visits.map((visit) => visit.id || visit._id);
  const results = await prisma.medicalLabResult.findMany({
    where: { visitId: { in: visitIds }, deletedAt: null },
    include: { performedBy: { select: { id: true, name: true, role: true, department: true } } },
    orderBy: { createdAt: "desc" },
  });
  const resultsByVisit = new Map();
  results.forEach((result) => {
    const key = String(result.visitId);
    resultsByVisit.set(key, [
      ...(resultsByVisit.get(key) || []),
      serializePrismaRecord(result),
    ]);
  });
  return visits.map((visit) => ({
    ...serializePrismaRecord(visit),
    labResults: resultsByVisit.get(String(visit.id || visit._id)) || [],
  }));
};

const areVisitLabOrdersComplete = async (visit) => {
  const orders = normalizeLabOrders(visit?.labOrders);
  if (!orders.length) return true;
  const visitId = visit.id || visit._id;
  const completedResults = await prisma.medicalLabResult.findMany({
    where: { visitId, status: "completed", deletedAt: null },
    select: { testName: true },
  });
  const completedNames = new Set(completedResults.map((result) => String(result.testName).trim().toLowerCase()));
  return orders.every((order) => completedNames.has(order.toLowerCase()));
};

const countOutstandingLabTests = async () => {
  const visits = await prisma.medicalVisit.findMany({
    where: {
      status: { notIn: ["cancelled", "voided", "deceased"] },
      deletedAt: null,
    },
    select: { id: true, labOrders: true },
  });
  const visitsWithOrders = visits.filter((visit) => normalizeLabOrders(visit.labOrders).length > 0);
  if (!visitsWithOrders.length) return 0;
  const completed = await prisma.medicalLabResult.findMany({
    where: { visitId: { in: visitsWithOrders.map((visit) => visit.id) }, status: "completed", deletedAt: null },
    select: { visitId: true, testName: true },
  });
  const completedByVisit = new Map();
  completed.forEach((result) => {
    const key = String(result.visitId);
    completedByVisit.set(key, [...(completedByVisit.get(key) || []), result.testName]);
  });
  return visitsWithOrders.reduce((total, visit) =>
    total + getOutstandingLabOrders(visit.labOrders, completedByVisit.get(String(visit.id)) || []).length, 0);
};

const returnVisitToDoctorWhenLabsComplete = async (visitId, actor) => {
  const visit = await prisma.medicalVisit.findUnique({ where: { id: visitId } });
  if (!visit || visit.status !== "awaiting_results" || !(await areVisitLabOrdersComplete(visit))) return;
  const before = serializePrismaRecord(visit);
  const updatedVisit = await prisma.medicalVisit.update({
    where: { id: visit.id },
    data: { status: "waiting_for_doctor" },
  });
  await logAudit({
    actor,
    action: "lab_results_completed",
    entity: "MedicalVisit",
    entityId: visit.id,
    before,
    after: serializePrismaRecord(updatedVisit),
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
    const consultationFee = Number(req.body?.consultationFee ?? 1500);
    if (role === "receptionist" && (!Number.isFinite(consultationFee) || consultationFee < 0)) return res.status(400).json({ success: false, message: "Consultation fee must be a valid amount" });

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

    if (!payload.clinician && req.user?.id) payload.clinician = req.user.id;
    const visit = await prisma.$transaction(async (transaction) => {
      const createdVisit = await transaction.medicalVisit.create({
        data: visitData(payload),
        include: visitInclude,
      });
      if (role === "receptionist" && consultationFee > 0) {
        await transaction.medicalBill.create({
          data: {
            billNumber: `HB-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
            patientId: createdVisit.patientId,
            visitId: createdVisit.id,
            department: "reception",
            createdById: req.user.id,
            items: {
              create: [{
                description: "Consultation fee",
                quantity: 1,
                unitPrice: consultationFee,
                total: consultationFee,
              }],
            },
            totalAmount: consultationFee,
            status: "approved",
            history: [{
              action: "sent_to_cashier",
              by: req.user.id,
              at: new Date().toISOString(),
              comment: "Reception consultation fee sent to cashier",
            }],
          },
        });
      }
      return createdVisit;
    }, { isolationLevel: "Serializable" });

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "MedicalVisit",
      entityId: visit.id,
      before: null,
      after: serializePrismaRecord(visit),
      metadata: {
        ip: req.ip,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Medical visit created successfully",
      data: role === "receptionist"
        ? projectReceptionVisit(serializePrismaRecord(visit))
        : serializePrismaRecord(visit),
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalVisits = async (
  req,
  res,
  next
) => {
  try {
    const where = { deletedAt: null };
    if (req.user.role === "nurse") where.status = { in: ["waiting_for_triage", "in_triage"] };
    if (req.user.role === "doctor") where.status = { in: ["waiting_for_doctor", "in_consultation"] };
    const visits = await prisma.medicalVisit.findMany({
      where,
      include: visitInclude,
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    });

    const serializedVisits = serializePrismaRecord(visits);
    const doctorVisits = req.user.role === "doctor"
      ? await attachLabResultsToVisits(serializedVisits)
      : serializedVisits;
    const data = req.user.role === "receptionist"
      ? serializedVisits.map(projectReceptionVisit)
      : req.user.role === "nurse"
        ? serializedVisits.map(projectNurseTriageVisit)
        : doctorVisits;

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalVisitById = async (
  req,
  res,
  next
) => {
  try {
    const where = { id: req.params.id, deletedAt: null };
    if (req.user.role === "nurse") where.status = { in: ["waiting_for_triage", "in_triage"] };
    if (req.user.role === "doctor") where.status = { in: ["waiting_for_doctor", "in_consultation"] };
    const visit = await prisma.medicalVisit.findFirst({ where, include: visitInclude });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const serializedVisit = serializePrismaRecord(visit);
    const data = req.user.role === "doctor"
      ? (await attachLabResultsToVisits([serializedVisit]))[0]
      : req.user.role === "receptionist"
        ? projectReceptionVisit(serializedVisit)
        : req.user.role === "nurse"
          ? projectNurseTriageVisit(serializedVisit)
          : serializedVisit;

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMedicalVisit = async (
  req,
  res,
  next
) => {
  try {
    const existingVisit = await prisma.medicalVisit.findFirst({
      where: { id: req.params.id, deletedAt: null },
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
      ...serializePrismaRecord(existingVisit),
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
    if (role === "doctor" && nextStatus === "awaiting_pharmacy" &&
        !await prisma.prescription.findFirst({
          where: { visitId: existingVisit.id, status: "prescribed", deletedAt: null },
          select: { id: true },
        })) {
      return res.status(400).json({ success: false, message: "Create a prescription before sending the patient to Pharmacy" });
    }
    if (role === "doctor" && nextStatus === "awaiting_billing") {
      if (!(await areVisitLabOrdersComplete({ ...serializePrismaRecord(existingVisit), labOrders: labOrders ?? existingVisit.labOrders }))) {
        return res.status(409).json({ success: false, message: "Wait for all ordered laboratory results before billing" });
      }
      if (await prisma.prescription.findFirst({
        where: { visitId: existingVisit.id, status: "prescribed", deletedAt: null },
        select: { id: true },
      })) {
        return res.status(409).json({ success: false, message: "Send prescribed medication through Pharmacy before billing" });
      }
    }

    const payload = role === "doctor"
      ? {
          ...visitInput,
          clinician: req.user.id,
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

    const visit = await prisma.medicalVisit.update({
      where: { id: req.params.id },
      data: visitData(payload),
      include: visitInclude,
    });

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "MedicalVisit",
      entityId: visit.id,
      before: serializePrismaRecord(existingVisit),
      after: serializePrismaRecord(visit),
      metadata: {
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Medical visit updated successfully",
      data: role === "receptionist"
        ? projectReceptionVisit(serializePrismaRecord(visit))
        : serializePrismaRecord(visit),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMedicalVisit = async (
  req,
  res,
  next
) => {
  try {
    const visit = await prisma.medicalVisit.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const reason = req.body?.reason || "Administrative void";
    const now = new Date();
    const updatedVisit = await prisma.medicalVisit.update({
      where: { id: visit.id },
      data: {
        status: visit.status === "cancelled" ? "cancelled" : "voided",
        deletedAt: now,
        deletedById: req.user.id,
        voidedAt: now,
        voidedById: req.user.id,
        voidReason: reason,
      },
    });

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "MedicalVisit",
      entityId: visit.id,
      before: serializePrismaRecord(visit),
      after: serializePrismaRecord(updatedVisit),
      metadata: {
        reason,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Medical visit voided successfully",
      data: serializePrismaRecord(updatedVisit),
    });
  } catch (error) {
    return next(error);
  }
};

export const admitMedicalVisit = async (req, res, next) => {
  try {
    const existingVisit = await prisma.medicalVisit.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!existingVisit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const normalizedAdmission = normalizeAdmissionRequest({
      ...existingVisit,
      ...req.body,
    });

    const visit = await prisma.medicalVisit.update({
      where: { id: req.params.id },
      data: visitData({
        ...existingVisit,
        ...req.body,
        ...normalizedAdmission,
        disposition: req.body?.disposition || "admit",
        status: normalizedAdmission.status,
      }),
      include: visitInclude,
    });

    await logAudit({
      actor: req.user,
      action: "admit",
      entity: "MedicalVisit",
      entityId: visit.id,
      before: serializePrismaRecord(existingVisit),
      after: serializePrismaRecord(visit),
      metadata: {
        ward: normalizedAdmission.ward,
        bedNumber: normalizedAdmission.bedNumber,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Patient admitted successfully",
      data: serializePrismaRecord(visit),
    });
  } catch (error) {
    return next(error);
  }
};

export const dischargeMedicalVisit = async (req, res, next) => {
  try {
    const existingVisit = await prisma.medicalVisit.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!existingVisit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    const normalizedDischarge = normalizeDischargeSummary({
      ...existingVisit,
      ...req.body,
    });

    const visit = await prisma.medicalVisit.update({
      where: { id: req.params.id },
      data: visitData({
        ...existingVisit,
        ...req.body,
        ...normalizedDischarge,
        disposition: req.body?.disposition || "discharge",
        status: normalizedDischarge.status,
      }),
      include: visitInclude,
    });

    await logAudit({
      actor: req.user,
      action: "discharge",
      entity: "MedicalVisit",
      entityId: visit.id,
      before: serializePrismaRecord(existingVisit),
      after: serializePrismaRecord(visit),
      metadata: {
        dischargeSummary: normalizedDischarge.dischargeSummary,
        dischargePlan: normalizedDischarge.dischargePlan,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Patient discharge summary saved successfully",
      data: serializePrismaRecord(visit),
    });
  } catch (error) {
    return next(error);
  }
};

// =====================================================
// MEDICAL LAB RESULTS
// =====================================================

export const getMedicalLabWorklist = async (req, res, next) => {
  try {
    const visitRows = await prisma.medicalVisit.findMany({
      where: {
        diagnosis: { not: null },
        status: { notIn: ["cancelled", "voided", "deceased"] },
        deletedAt: null,
      },
      include: {
        patient: {
          select: {
            id: true, firstName: true, lastName: true, patientNumber: true,
            estimatedAge: true, dateOfBirth: true, sex: true, deletedAt: true,
          },
        },
        clinician: { select: { id: true, name: true, role: true, department: true } },
      },
      orderBy: { visitDate: "desc" },
    });
    const visits = serializePrismaRecord(visitRows).filter((visit) =>
      visit.patient && String(visit.diagnosis || "").trim() &&
      normalizeLabOrders(visit.labOrders).length > 0 &&
      !visit.patient.deletedAt);
    const completedResults = visits.length ? await prisma.medicalLabResult.findMany({
      where: {
        visitId: { in: visits.map((visit) => visit.id) },
        status: "completed",
        deletedAt: null,
      },
      select: { visitId: true, testName: true },
    }) : [];
    const completedByVisit = new Map();
    completedResults.forEach((result) => {
      const key = String(result.visitId);
      completedByVisit.set(key, new Set([...(completedByVisit.get(key) || []), String(result.testName).trim().toLowerCase()]));
    });

    const data = visits
      .filter((visit) => visit.patient)
      .map((visit) => {
        const completed = completedByVisit.get(String(visit.id)) || new Set();
        return {
          _id: visit.id,
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

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalLabPatients = async (req, res, next) => {
  try {
    const patients = await prisma.patient.findMany({
      where: { status: { not: "voided" }, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, patientNumber: true,
        estimatedAge: true, dateOfBirth: true, sex: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return res.status(200).json({
      success: true,
      count: patients.length,
      data: serializePrismaRecord(patients),
    });
  } catch (error) {
    return next(error);
  }
};

const labResultInclude = {
  patient: {
    select: {
      id: true, firstName: true, lastName: true, patientNumber: true,
      estimatedAge: true, dateOfBirth: true, sex: true, nationalId: true,
      phone: true, address: true, status: true,
    },
  },
  visit: {
    select: {
      id: true, visitDate: true, visitType: true, visitNumber: true,
      diagnosis: true, labOrders: true, clinician: {
        select: { id: true, name: true, role: true, department: true },
      },
    },
  },
  performedBy: { select: { id: true, name: true, role: true, department: true } },
};

const labResultData = (payload) => {
  const data = {};
  const aliases = { patient: "patientId", visit: "visitId", performedBy: "performedById" };
  for (const field of [
    "patientId", "visitId", "testName", "unitPrice", "result", "referenceRange",
    "status", "performedById", "performedAt",
  ]) {
    const alias = Object.entries(aliases).find(([, target]) => target === field)?.[0];
    const sourceField = alias && payload[alias] !== undefined
      ? alias
      : field;
    if (payload[sourceField] === undefined) continue;
    let value = payload[sourceField];
    if (["patientId", "visitId", "performedById"].includes(field)) value = relationId(value);
    if (field === "performedAt" && value !== null && !(value instanceof Date)) value = new Date(value);
    data[field] = value;
  }
  return data;
};

export const createMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
    if (req.user.role === "laboratory") {
      const visit = await prisma.medicalVisit.findFirst({
        where: {
          id: relationId(req.body.visit),
          patientId: relationId(req.body.patient),
          diagnosis: { not: null },
          deletedAt: null,
        },
      });
      if (!visit || !String(visit.diagnosis || "").trim() ||
          !hasRequestedLabOrder(visit, req.body.testName)) {
        return res.status(400).json({ success: false, message: "Select a patient visit and test ordered by a doctor" });
      }
    }

    const payload = {
      ...req.body,
      status: normalizeLabStatus(req.body?.status, req.body),
    };

    // Automatically assign logged-in user as lab performer
    if (!payload.performedBy && req.user?.id) {
      payload.performedBy = req.user.id;
    }

    // Automatically set performedAt when not provided
    if (!payload.performedAt) {
      payload.performedAt = new Date();
    }

    const labResult = await prisma.medicalLabResult.create({
      data: labResultData(payload),
      include: labResultInclude,
    });

    if (labResult.visitId && labResult.status === "completed") {
      await returnVisitToDoctorWhenLabsComplete(labResult.visitId, req.user);
    }

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "MedicalLabResult",
      entityId: labResult.id,
      before: null,
      after: serializePrismaRecord(labResult),
      metadata: {
        ip: req.ip,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Medical lab result created successfully",
      data: serializePrismaRecord(labResult),
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalLabResults = async (
  req,
  res,
  next
) => {
  try {
    const where = { deletedAt: null };
    if (req.user.role === "doctor") {
      const doctorVisits = await prisma.medicalVisit.findMany({
        where: { clinicianId: req.user.id },
        select: { id: true },
      });
      where.visitId = { in: doctorVisits.map((visit) => visit.id) };
    }
    const labResults = await prisma.medicalLabResult.findMany({
      where,
      include: labResultInclude,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: labResults.length,
      data: serializePrismaRecord(labResults),
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalLabResultById = async (
  req,
  res,
  next
) => {
  try {
    const labResult = await prisma.medicalLabResult.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: labResultInclude,
    });

    if (!labResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: serializePrismaRecord(labResult),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
    const existingLabResult = await prisma.medicalLabResult.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!existingLabResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    if (req.user.role === "laboratory") {
      const visitId = relationId(req.body.visit) || existingLabResult.visitId;
      const patientId = relationId(req.body.patient) || existingLabResult.patientId;
      const testName = req.body.testName || existingLabResult.testName;
      const visit = await prisma.medicalVisit.findFirst({
        where: { id: visitId, patientId },
      });
      if (!visit || !hasRequestedLabOrder(visit, testName)) {
        return res.status(400).json({ success: false, message: "Laboratory results must match a doctor-ordered test" });
      }
    }

    const normalizedPayload = {
      ...existingLabResult,
      ...req.body,
      status: normalizeLabStatus(req.body?.status ?? existingLabResult.status, {
        ...existingLabResult,
        ...req.body,
      }),
    };

    const labResult = await prisma.medicalLabResult.update({
      where: { id: req.params.id },
      data: labResultData(normalizedPayload),
      include: labResultInclude,
    });

    if (labResult.visitId && labResult.status === "completed") {
      await returnVisitToDoctorWhenLabsComplete(labResult.visitId, req.user);
    }

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "MedicalLabResult",
      entityId: labResult.id,
      before: serializePrismaRecord(existingLabResult),
      after: serializePrismaRecord(labResult),
      metadata: {
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Medical lab result updated successfully",
      data: serializePrismaRecord(labResult),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
    const labResult = await prisma.medicalLabResult.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!labResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    const reason = req.body?.reason || "Administrative void";
    const now = new Date();
    const updatedLabResult = await prisma.medicalLabResult.update({
      where: { id: labResult.id },
      data: {
        status: labResult.status === "cancelled" ? "cancelled" : "voided",
        deletedAt: now,
        deletedById: req.user.id,
        voidedAt: now,
        voidedById: req.user.id,
        voidReason: reason,
      },
    });

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "MedicalLabResult",
      entityId: labResult.id,
      before: serializePrismaRecord(labResult),
      after: serializePrismaRecord(updatedLabResult),
      metadata: {
        reason,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Medical lab result voided successfully",
      data: serializePrismaRecord(updatedLabResult),
    });
  } catch (error) {
    return next(error);
  }
};

// =====================================================
// PRESCRIPTIONS
// =====================================================

const prescriptionInclude = {
  patient: {
    select: {
      id: true, firstName: true, lastName: true, patientNumber: true,
      estimatedAge: true, dateOfBirth: true, sex: true, nationalId: true,
      phone: true, address: true, status: true,
    },
  },
  visit: {
    select: {
      id: true, visitNumber: true, visitDate: true, visitType: true,
      diagnosis: true, treatmentPlan: true,
    },
  },
  prescribedBy: { select: { id: true, name: true, role: true, department: true } },
  medications: true,
};

const prescriptionData = (payload) => {
  const data = {};
  const aliases = { patient: "patientId", visit: "visitId", prescribedBy: "prescribedById" };
  for (const field of ["patientId", "visitId", "prescribedById", "status"]) {
    const alias = Object.entries(aliases).find(([, target]) => target === field)?.[0];
    const sourceField = alias && payload[alias] !== undefined ? alias : field;
    if (payload[sourceField] !== undefined) data[field] = relationId(payload[sourceField]);
  }
  if (Array.isArray(payload.medications)) {
    data.medications = {
      create: payload.medications.map((medication) => ({
        name: medication.name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        duration: medication.duration,
        quantity: medication.quantity,
        unitPrice: medication.unitPrice,
        instructions: medication.instructions,
      })),
    };
  }
  return data;
};

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
      consultationVisit = await prisma.medicalVisit.findFirst({
        where: {
          id: relationId(req.body.visit),
          patientId: relationId(req.body.patient),
          status: "in_consultation",
          diagnosis: { not: null },
        },
      });
      if (!consultationVisit || !String(consultationVisit.diagnosis || "").trim()) {
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
      payload.prescribedBy = req.user.id;
    } else if (!payload.prescribedBy && req.user?.id) {
      payload.prescribedBy = req.user.id;
    }

    const result = await prisma.$transaction(async (transaction) => {
      const prescription = await transaction.prescription.create({
        data: prescriptionData(payload),
        include: prescriptionInclude,
      });
      let updatedVisit = null;
      if (consultationVisit) {
        updatedVisit = await transaction.medicalVisit.update({
          where: { id: consultationVisit.id },
          data: { status: "awaiting_pharmacy" },
        });
      }
      return { prescription, updatedVisit };
    }, { isolationLevel: "Serializable" });
    const { prescription } = result;

    await logAudit({
      actor: req.user,
      action: "create",
      entity: "Prescription",
      entityId: prescription.id,
      before: null,
      after: serializePrismaRecord(prescription),
      metadata: {
        ip: req.ip,
      },
    });

    if (consultationVisit) {
      await logAudit({
        actor: req.user,
        action: "prescription_sent_to_pharmacy",
        entity: "MedicalVisit",
        entityId: consultationVisit.id,
        before: serializePrismaRecord(consultationVisit),
        after: serializePrismaRecord(result.updatedVisit),
        metadata: { prescription: prescription.id, ip: req.ip },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Prescription created successfully",
      data: serializePrismaRecord(prescription),
    });
  } catch (error) {
    return next(error);
  }
};

export const getPrescriptions = async (
  req,
  res,
  next
) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { deletedAt: null },
      include: prescriptionInclude,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: serializePrismaRecord(prescriptions),
    });
  } catch (error) {
    return next(error);
  }
};

export const getPrescriptionById = async (
  req,
  res,
  next
) => {
  try {
    const prescription = await prisma.prescription.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: prescriptionInclude,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: serializePrismaRecord(prescription),
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePrescription = async (
  req,
  res,
  next
) => {
  try {
    const existingPrescription = await prisma.prescription.findFirst({
      where: { id: req.params.id, deletedAt: null },
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
      ...existingPrescription,
      ...req.body,
      status: normalizePrescriptionStatus(req.body?.status ?? existingPrescription.status, {
        ...existingPrescription,
        ...req.body,
      }),
    };

    const updateData = prescriptionData(normalizedPayload);
    if (Array.isArray(req.body.medications)) {
      updateData.medications = {
        deleteMany: {},
        ...prescriptionData({ medications: req.body.medications }).medications,
      };
    }
    if (["pharmacist", "pharmacy"].includes(req.user.role)) {
      updateData.status = "dispensed";
    }
    const prescription = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.prescription.update({
        where: { id: req.params.id },
        data: updateData,
        include: prescriptionInclude,
      });
      let handoffVisit = null;
      if (["pharmacist", "pharmacy"].includes(req.user.role) &&
          updated.status === "dispensed" && updated.visitId) {
        const remainingPrescriptions = await transaction.prescription.count({
          where: {
            visitId: updated.visitId,
            status: "prescribed",
            deletedAt: null,
          },
        });
        const visit = await transaction.medicalVisit.findFirst({
          where: { id: updated.visitId, status: "awaiting_pharmacy" },
        });
        if (visit && remainingPrescriptions === 0) {
          handoffVisit = await transaction.medicalVisit.update({
            where: { id: visit.id },
            data: { status: "awaiting_billing" },
          });
        }
      }
      return { prescription: updated, handoffVisit };
    }, { isolationLevel: "Serializable" });

    await logAudit({
      actor: req.user,
      action: "update",
      entity: "Prescription",
      entityId: prescription.prescription.id,
      before: serializePrismaRecord(existingPrescription),
      after: serializePrismaRecord(prescription.prescription),
      metadata: {
        ip: req.ip,
      },
    });

    if (prescription.handoffVisit) {
      await logAudit({
        actor: req.user,
        action: "pharmacy_handoff_completed",
        entity: "MedicalVisit",
        entityId: prescription.handoffVisit.id,
        before: { ...serializePrismaRecord(prescription.handoffVisit), status: "awaiting_pharmacy" },
        after: serializePrismaRecord(prescription.handoffVisit),
        metadata: { prescription: prescription.prescription.id, ip: req.ip },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Prescription updated successfully",
      data: serializePrismaRecord(prescription.prescription),
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePrescription = async (
  req,
  res,
  next
) => {
  try {
    const prescription = await prisma.prescription.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    const reason = req.body?.reason || "Administrative void";
    const now = new Date();
    const updatedPrescription = await prisma.prescription.update({
      where: { id: prescription.id },
      data: {
        status: prescription.status === "cancelled" ? "cancelled" : "voided",
        deletedAt: now,
        deletedById: req.user.id,
        voidedAt: now,
        voidedById: req.user.id,
        voidReason: reason,
      },
    });

    await logAudit({
      actor: req.user,
      action: "void",
      entity: "Prescription",
      entityId: prescription.id,
      before: serializePrismaRecord(prescription),
      after: serializePrismaRecord(updatedPrescription),
      metadata: {
        reason,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Prescription voided successfully",
      data: serializePrismaRecord(updatedPrescription),
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicalExceptions = async (req, res, next) => {
  try {
    const visits = await prisma.medicalVisit.findMany({
      where: {
        status: {
          in: [
          "left_without_being_seen",
          "referred",
          "cancelled",
          "voided",
          "deceased",
          "manual_back_entry",
          "downtime_entry",
          ],
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const queue = buildExceptionQueue(serializePrismaRecord(visits));

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
      canReadPatients ? prisma.patient.count() : null,
      canReadVisits
        ? prisma.medicalVisit.count({
            where: {
              visitDate: { gte: startOfToday, lt: startOfTomorrow },
              status: { not: "cancelled" },
            },
          })
        : null,
      canReadLab
        ? countOutstandingLabTests()
        : null,
      canReadPrescriptions ? prisma.prescription.count() : null,
      canReadVisits
        ? prisma.medicalVisit.count({
            where: {
              status: {
                in: [
                "left_without_being_seen",
                "referred",
                "cancelled",
                "voided",
                "deceased",
                "manual_back_entry",
                "downtime_entry",
                ],
              },
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
