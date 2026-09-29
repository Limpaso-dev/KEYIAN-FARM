import express from "express";

import {
  // Patients
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,

  // Medical Visits
  createMedicalVisit,
  getMedicalVisits,
  getMedicalVisitById,
  updateMedicalVisit,
  deleteMedicalVisit,

  // Medical Lab Results
  createMedicalLabResult,
  getMedicalLabResults,
  getMedicalLabResultById,
  updateMedicalLabResult,
  deleteMedicalLabResult,

  // Prescriptions
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  updatePrescription,
  deletePrescription,
} from "../controllers/medical.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

// =====================================================
// AUTHENTICATION
// =====================================================

// All HMIS routes require authentication
router.use(protect);

// =====================================================
// PATIENTS
// =====================================================

router.post("/patients", authorizeModule("hmisPatients"), createPatient);

router.get("/patients", authorizeModule("hmisPatients"), getPatients);

router.get("/patients/:id", authorizeModule("hmisPatients"), getPatientById);

router.put("/patients/:id", authorizeModule("hmisPatients"), updatePatient);

router.delete("/patients/:id", authorizeModule("hmisPatients"), deletePatient);

// =====================================================
// MEDICAL VISITS
// =====================================================

router.post("/visits", authorizeModule("hmisVisits"), createMedicalVisit);

router.get("/visits", authorizeModule("hmisVisits"), getMedicalVisits);

router.get("/visits/:id", authorizeModule("hmisVisits"), getMedicalVisitById);

router.put("/visits/:id", authorizeModule("hmisVisits"), updateMedicalVisit);

router.delete("/visits/:id", authorizeModule("hmisVisits"), deleteMedicalVisit);

// =====================================================
// MEDICAL LAB RESULTS
// =====================================================

router.post("/lab-results", authorizeModule("hmisLab"), createMedicalLabResult);

router.get("/lab-results", authorizeModule("hmisLab"), getMedicalLabResults);

router.get("/lab-results/:id", authorizeModule("hmisLab"), getMedicalLabResultById);

router.put("/lab-results/:id", authorizeModule("hmisLab"), updateMedicalLabResult);

router.delete("/lab-results/:id", authorizeModule("hmisLab"), deleteMedicalLabResult);

// =====================================================
// PRESCRIPTIONS
// =====================================================

router.post("/prescriptions", authorizeModule("hmisPrescriptions"), createPrescription);

router.get("/prescriptions", authorizeModule("hmisPrescriptions"), getPrescriptions);

router.get("/prescriptions/:id", authorizeModule("hmisPrescriptions"), getPrescriptionById);

router.put("/prescriptions/:id", authorizeModule("hmisPrescriptions"), updatePrescription);

router.delete("/prescriptions/:id", authorizeModule("hmisPrescriptions"), deletePrescription);

export default router;