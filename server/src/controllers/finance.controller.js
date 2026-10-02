import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { getApprovalSteps } from "../services/approvalWorkflow.service.js";

// ===============================
// ACCOUNTS
// ===============================

export const createAccount = async (req, res, next) => {
  try {
    const account = await Account.create(req.body);

    res.status(201).json({
      success: true,
      message: "Account created",
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

export const getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.json({
      success: true,
      message: "Account updated",
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findByIdAndDelete(
      req.params.id
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.json({
      success: true,
      message: "Account deleted",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// TRANSACTIONS
// ===============================

export const createTransaction = async (req, res, next) => {
  try {
    const { reference, transactionDate, type, account: accountId, amount, description } = req.body;
    const account = await Account.findOne({ _id: accountId, status: "active", accountType: "asset" });
    if (!account) return res.status(400).json({ success: false, message: "Select an active finance account" });
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ success: false, message: "Transaction amount must be greater than zero" });
    const { policyId, steps } = await getApprovalSteps({ workflowType: "finance_transaction", department: "finance", amount: numericAmount });
    const transaction = await Transaction.create({ reference, transactionDate, type, account: account._id, amount: numericAmount, description, createdBy: req.user._id, status: "pending", policy: policyId, approvalSteps: steps, history: [{ action: "submitted", by: req.user._id }] });

    res.status(201).json({
      success: true,
      message: "Transaction recorded",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find()
      .populate("account")
      .sort({ transactionDate: -1 });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const transaction =
      await Transaction.findById(req.params.id)
        .populate("account");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status === "posted") return res.status(409).json({ success: false, message: "Posted ledger transactions are immutable" });
    if (transaction.history?.length) return res.status(409).json({ success: false, message: "Submitted transactions must be revised through the workflow inbox" });
    if (["approved", "posted"].includes(req.body.status)) return res.status(403).json({ success: false, message: "Only an approval workflow can approve or post a financial transaction" });
    for (const field of ["reference", "transactionDate", "type", "account", "amount", "description"]) {
      if (req.body[field] !== undefined) transaction[field] = req.body[field];
    }
    await transaction.save();

    res.json({
      success: true,
      message: "Transaction updated",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status === "posted") return res.status(409).json({ success: false, message: "Posted ledger transactions cannot be deleted" });
    if (transaction.history?.length) return res.status(409).json({ success: false, message: "Submitted transactions are retained for audit" });
    await transaction.deleteOne();

    res.json({
      success: true,
      message: "Transaction deleted",
    });
  } catch (error) {
    next(error);
  }
};
