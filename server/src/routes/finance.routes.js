import express from "express";

import {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,

  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from "../controllers/finance.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";
import { listSupplierInvoices, listSupplierPayments, requestSupplierPayment } from "../controllers/invoice.controller.js";

const router = express.Router();

router.use(protect, authorizeModule("finance"));

// =====================================================
// ACCOUNTS
// =====================================================

router.post("/accounts", createAccount);
router.get("/accounts", getAccounts);
router.get("/accounts/:id", getAccountById);
router.put("/accounts/:id", updateAccount);
router.delete("/accounts/:id", deleteAccount);

// =====================================================
// TRANSACTIONS
// =====================================================

router.post("/transactions", createTransaction);
router.get("/transactions", getTransactions);
router.get("/transactions/:id", getTransactionById);
router.put("/transactions/:id", updateTransaction);
router.delete("/transactions/:id", deleteTransaction);
router.get("/supplier-payments", listSupplierPayments);
router.post("/supplier-payments", requestSupplierPayment);
router.get("/supplier-invoices", listSupplierInvoices);

export default router;
