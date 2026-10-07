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
  normalizeVisitStatus,
} from "../utils/visitLifecycle.js";
import {
  normalizeTriageAssessment,
} from "../utils/triage.js";
import {
  normalizeConsultationSummary,
} from "../utils/consultation.js";
import {
  normalizeLabStatus,
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
    next(error);
  }
};

export const getPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      )
      .sort({ createdAt: -1 });

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
    const patient = await Patient.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      data: patient,
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

export const createMedicalVisit = async (
  req,
  res,
  next
) => {
  try {
    const payload = {
      ...req.body,
      status: normalizeVisitStatus(req.body?.status),
      visitNumber: req.body?.visitNumber || generateVisitNumber(),
      ...normalizeTriageAssessment(req.body),
      ...normalizeConsultationSummary(req.body),
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
      data: populatedVisit,
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
    const visits = await MedicalVisit.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .populate("patient")
      .populate(
        "clinician",
        "name email role department"
      )
      .sort({ visitDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: visits.length,
      data: visits,
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
    const visit = await MedicalVisit.findOne({
      _id: req.params.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
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

    res.status(200).json({
      success: true,
      data: visit,
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

    const payload = {
      ...req.body,
      status: normalizeVisitStatus(req.body?.status),
      ...normalizeTriageAssessment(req.body),
      ...normalizeConsultationSummary(req.body),
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
      data: visit,
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

// =====================================================
// MEDICAL LAB RESULTS
// =====================================================

export const createMedicalLabResult = async (
  req,
  res,
  next
) => {
  try {
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

    const populatedLabResult =
      await MedicalLabResult.findById(
        labResult._id
      )
        .populate("patient")
        .populate("visit")
        .populate(
          "performedBy",
          "name email role department"
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
    const labResults = await MedicalLabResult.find({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .populate("patient")
      .populate("visit")
      .populate(
        "performedBy",
        "name email role department"
      )
      .sort({ createdAt: -1 });

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
    const labResult =
      await MedicalLabResult.findOne({
        _id: req.params.id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("patient")
        .populate("visit")
        .populate(
          "performedBy",
          "name email role department"
        );

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

    const normalizedPayload = {
      ...existingLabResult.toObject(),
      ...req.body,
      status: normalizeLabStatus(req.body?.status ?? existingLabResult.status, {
        ...existingLabResult.toObject(),
        ...req.body,
      }),
    };

    const labResult =
      await MedicalLabResult.findByIdAndUpdate(
        req.params.id,
        normalizedPayload,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("patient")
        .populate("visit")
        .populate(
          "performedBy",
          "name email role department"
        );

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

export const createPrescription = async (
  req,
  res,
  next
) => {
  try {
    const payload = {
      ...req.body,
      status: normalizePrescriptionStatus(req.body?.status, req.body),
    };

    // Automatically assign logged-in user as prescriber
    if (!payload.prescribedBy && req.user?._id) {
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

    const populatedPrescription =
      await Prescription.findById(
        prescription._id
      )
        .populate("patient")
        .populate("visit")
        .populate(
          "prescribedBy",
          "name email role department"
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
    const prescriptions =
      await Prescription.find({
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("patient")
        .populate("visit")
        .populate(
          "prescribedBy",
          "name email role department"
        )
        .sort({ createdAt: -1 });

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
    const prescription =
      await Prescription.findOne({
        _id: req.params.id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("patient")
        .populate("visit")
        .populate(
          "prescribedBy",
          "name email role department"
        );

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

    const normalizedPayload = {
      ...existingPrescription.toObject(),
      ...req.body,
      status: normalizePrescriptionStatus(req.body?.status ?? existingPrescription.status, {
        ...existingPrescription.toObject(),
        ...req.body,
      }),
    };

    const prescription =
      await Prescription.findByIdAndUpdate(
        req.params.id,
        normalizedPayload,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("patient")
        .populate("visit")
        .populate(
          "prescribedBy",
          "name email role department"
        );

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

export const getMedicalSummary = async (req, res, next) => {
  try {
    const role = req.user.role;
    const canRead = (roles) =>
      ["admin", "super_admin", "manager"].includes(role) ||
      roles.includes(role);
    const canReadPatients = canRead(["doctor", "nurse"]);
    const canReadVisits = canRead(["doctor", "nurse"]);
    const canReadLab = canRead(["doctor", "nurse", "laboratory"]);
    const canReadPrescriptions = canRead(["doctor", "pharmacist"]);

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

    const [patients, todaysVisits, pendingLab, prescriptions] = await Promise.all([
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
    ]);

    return res.status(200).json({
      success: true,
      data: {
        patients,
        todaysVisits,
        pendingLab,
        prescriptions,
      },
    });
  } catch (error) {
    return next(error);
  }
};