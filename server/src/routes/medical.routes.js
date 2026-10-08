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
  admitMedicalVisit,
  dischargeMedicalVisit,
  getMedicalExceptions,

  // Medical Lab Results
  getMedicalLabWorklist,
  getMedicalLabPatients,
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
  getMedicalSummary,
} from "../controllers/medical.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeHMIS } from "../middleware/role.middleware.js";
import { createMedicalBill, getBillableMedicalVisits, getMedicalPaymentAccounts, getPatientBillSummary, listMedicalBills } from "../controllers/medicalBilling.controller.js";
import { recordMedicalBillPayment } from "../controllers/invoice.controller.js";

const router = express.Router();

// =====================================================
// AUTHENTICATION
// =====================================================

// All HMIS routes require authentication
router.use(protect);

router.get("/summary", authorizeHMIS("summary"), getMedicalSummary);
router.get("/bills", authorizeHMIS("billsRead"), listMedicalBills);
router.get("/payment-accounts", authorizeHMIS("billsPay"), getMedicalPaymentAccounts);
router.get("/billable-visits", authorizeHMIS("billsRead"), getBillableMedicalVisits);
router.get("/visits/:id/billing-summary", authorizeHMIS("billsRead"), getPatientBillSummary);
router.post("/bills", authorizeHMIS("billsCreate"), createMedicalBill);
router.post("/bills/:id/payments", authorizeHMIS("billsPay"), recordMedicalBillPayment);

// =====================================================
// PATIENTS
// =====================================================

router.post("/patients", authorizeHMIS("patientsCreate"), createPatient);

router.get("/patients", authorizeHMIS("patientsRead"), getPatients);

router.get("/patients/:id", authorizeHMIS("patientsRead"), getPatientById);

router.put("/patients/:id", authorizeHMIS("patientsUpdate"), updatePatient);

router.delete("/patients/:id", authorizeHMIS("adminOnly"), deletePatient);

// =====================================================
// MEDICAL VISITS
// =====================================================

router.post("/visits", authorizeHMIS("visitsCreate"), createMedicalVisit);

router.get("/visits", authorizeHMIS("visitsRead"), getMedicalVisits);

router.get("/visits/:id", authorizeHMIS("visitsRead"), getMedicalVisitById);

router.put("/visits/:id", authorizeHMIS("visitsUpdate"), updateMedicalVisit);

router.get("/exceptions", authorizeHMIS("visitsClinicalActions"), getMedicalExceptions);

router.post("/visits/:id/admit", authorizeHMIS("visitsClinicalActions"), admitMedicalVisit);

router.post("/visits/:id/discharge", authorizeHMIS("visitsClinicalActions"), dischargeMedicalVisit);

router.delete("/visits/:id", authorizeHMIS("adminOnly"), deleteMedicalVisit);

// =====================================================
// MEDICAL LAB RESULTS
// =====================================================

router.get("/lab-worklist", authorizeHMIS("labRead"), getMedicalLabWorklist);

router.get("/lab-patients", authorizeHMIS("labRead"), getMedicalLabPatients);

router.post("/lab-results", authorizeHMIS("labWrite"), createMedicalLabResult);

router.get("/lab-results", authorizeHMIS("labRead"), getMedicalLabResults);

router.get("/lab-results/:id", authorizeHMIS("labRead"), getMedicalLabResultById);

router.put("/lab-results/:id", authorizeHMIS("labWrite"), updateMedicalLabResult);

router.delete("/lab-results/:id", authorizeHMIS("adminOnly"), deleteMedicalLabResult);

// =====================================================
// PRESCRIPTIONS
// =====================================================

router.post("/prescriptions", authorizeHMIS("prescriptionsCreate"), createPrescription);

router.get("/prescriptions", authorizeHMIS("prescriptionsRead"), getPrescriptions);

router.get("/prescriptions/:id", authorizeHMIS("prescriptionsRead"), getPrescriptionById);

router.put("/prescriptions/:id", authorizeHMIS("prescriptionsUpdate"), updatePrescription);

router.delete("/prescriptions/:id", authorizeHMIS("adminOnly"), deletePrescription);

export default router;
