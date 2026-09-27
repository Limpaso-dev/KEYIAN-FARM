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

const router = express.Router();

// =====================================================
// AUTHENTICATION
// =====================================================

// All HMIS routes require authentication
router.use(protect);

// =====================================================
// PATIENTS
// =====================================================

router.post("/patients", createPatient);

router.get("/patients", getPatients);

router.get("/patients/:id", getPatientById);

router.put("/patients/:id", updatePatient);

router.delete("/patients/:id", deletePatient);

// =====================================================
// MEDICAL VISITS
// =====================================================

router.post("/visits", createMedicalVisit);

router.get("/visits", getMedicalVisits);

router.get("/visits/:id", getMedicalVisitById);

router.put("/visits/:id", updateMedicalVisit);

router.delete("/visits/:id", deleteMedicalVisit);

// =====================================================
// MEDICAL LAB RESULTS
// =====================================================

router.post("/lab-results", createMedicalLabResult);

router.get("/lab-results", getMedicalLabResults);

router.get("/lab-results/:id", getMedicalLabResultById);

router.put("/lab-results/:id", updateMedicalLabResult);

router.delete("/lab-results/:id", deleteMedicalLabResult);

// =====================================================
// PRESCRIPTIONS
// =====================================================

router.post("/prescriptions", createPrescription);

router.get("/prescriptions", getPrescriptions);

router.get("/prescriptions/:id", getPrescriptionById);

router.put("/prescriptions/:id", updatePrescription);

router.delete("/prescriptions/:id", deletePrescription);

export default router;