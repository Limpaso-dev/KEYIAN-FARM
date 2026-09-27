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

const router = express.Router();

router.use(protect);

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

export default router;