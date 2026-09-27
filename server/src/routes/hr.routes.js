import express from "express";

import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,

  createPayroll,
  getPayroll,
  getPayrollById,
  updatePayroll,
  deletePayroll,
} from "../controllers/hr.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// =====================================================
// EMPLOYEES
// =====================================================

router.post("/employees", createEmployee);

router.get("/employees", getEmployees);

router.get(
  "/employees/:id",
  getEmployeeById
);

router.put(
  "/employees/:id",
  updateEmployee
);

router.delete(
  "/employees/:id",
  deleteEmployee
);

// =====================================================
// PAYROLL
// =====================================================

router.post("/payroll", createPayroll);

router.get("/payroll", getPayroll);

router.get(
  "/payroll/:id",
  getPayrollById
);

router.put(
  "/payroll/:id",
  updatePayroll
);

router.delete(
  "/payroll/:id",
  deletePayroll
);

export default router;