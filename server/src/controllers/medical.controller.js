import Patient from "../models/Patient.js";
import MedicalVisit from "../models/MedicalVisit.js";
import MedicalLabResult from "../models/MedicalLabResult.js";
import Prescription from "../models/Prescription.js";

// =====================================================
// PATIENTS
// =====================================================

export const createPatient = async (req, res, next) => {
  try {
    const patient = await Patient.create(req.body);

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
    const patients = await Patient.find()
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
    const patient = await Patient.findById(req.params.id).populate(
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
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).populate(
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
      message: "Patient updated successfully",
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findByIdAndDelete(
      req.params.id
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Patient deleted successfully",
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
    };

    // Automatically assign logged-in user as clinician
    if (!payload.clinician && req.user?._id) {
      payload.clinician = req.user._id;
    }

    const visit = await MedicalVisit.create(payload);

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
    const visits = await MedicalVisit.find()
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
    const visit = await MedicalVisit.findById(
      req.params.id
    )
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
    const visit = await MedicalVisit.findByIdAndUpdate(
      req.params.id,
      req.body,
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

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

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
    const visit = await MedicalVisit.findByIdAndDelete(
      req.params.id
    );

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Medical visit not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Medical visit deleted successfully",
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
    const labResults = await MedicalLabResult.find()
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
      await MedicalLabResult.findById(
        req.params.id
      )
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
    const labResult =
      await MedicalLabResult.findByIdAndUpdate(
        req.params.id,
        req.body,
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

    if (!labResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

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
    const labResult =
      await MedicalLabResult.findByIdAndDelete(
        req.params.id
      );

    if (!labResult) {
      return res.status(404).json({
        success: false,
        message: "Medical lab result not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Medical lab result deleted successfully",
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
    };

    // Automatically assign logged-in user as prescriber
    if (!payload.prescribedBy && req.user?._id) {
      payload.prescribedBy = req.user._id;
    }

    const prescription =
      await Prescription.create(payload);

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
      await Prescription.find()
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
      await Prescription.findById(
        req.params.id
      )
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
    const prescription =
      await Prescription.findByIdAndUpdate(
        req.params.id,
        req.body,
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

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
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
    const prescription =
      await Prescription.findByIdAndDelete(
        req.params.id
      );

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Prescription deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};