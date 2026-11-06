import prisma from "../config/prisma.js";
import { getApprovalSteps } from "../services/approvalWorkflow.service.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const accountFields = ["accountCode", "accountName", "accountType", "openingBalance", "status"];
const transactionFields = ["reference", "transactionDate", "type", "accountId", "amount", "description"];
const transactionRelations = { account: "accountId" };
const accountInclude = { account: true };

export const createAccount = async (req, res, next) => {
  try {
    const account = await prisma.account.create({ data: prismaData(req.body, accountFields) });
    res.status(201).json({
      success: true,
      message: "Account created",
      data: serializePrismaRecord(account),
    });
  } catch (error) {
    next(error);
  }
};

export const getAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: accounts.length,
      data: serializePrismaRecord(accounts),
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const account = await prisma.account.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });
    return res.json({ success: true, data: serializePrismaRecord(account) });
  } catch (error) {
    return next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: prismaData(req.body, accountFields),
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });
    return res.json({
      success: true,
      message: "Account updated",
      data: serializePrismaRecord(account),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const account = await prisma.account.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });
    return res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    return next(error);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const {
      reference,
      transactionDate,
      type,
      account: accountId,
      amount,
      description,
    } = req.body;
    const account = await prisma.account.findFirst({
      where: { id: accountId, status: "active", accountType: "asset" },
    });
    if (!account) {
      return res.status(400).json({ success: false, message: "Select an active finance account" });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Transaction amount must be greater than zero" });
    }
    const { policyId, steps } = await getApprovalSteps({
      workflowType: "finance_transaction",
      department: "finance",
      amount: numericAmount,
    });
    const transaction = await prisma.transaction.create({
      data: {
        reference,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        type,
        accountId: account.id,
        amount: numericAmount,
        description,
        createdById: req.user.id,
        status: "pending",
        policyId,
        approvalSteps: steps,
        history: [{ action: "submitted", by: req.user.id, at: new Date().toISOString() }],
      },
      include: accountInclude,
    });
    return res.status(201).json({
      success: true,
      message: "Transaction recorded",
      data: serializePrismaRecord(transaction),
    });
  } catch (error) {
    return next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: accountInclude,
      orderBy: { transactionDate: "desc" },
    });
    res.json({
      success: true,
      count: transactions.length,
      data: serializePrismaRecord(transactions),
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: accountInclude,
    });
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(transaction) });
  } catch (error) {
    return next(error);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Transaction not found" });
    if (existing.status === "posted") {
      return res.status(409).json({ success: false, message: "Posted ledger transactions are immutable" });
    }
    if (Array.isArray(existing.history) && existing.history.length) {
      return res.status(409).json({ success: false, message: "Submitted transactions must be revised through the workflow inbox" });
    }
    if (["approved", "posted"].includes(req.body.status)) {
      return res.status(403).json({ success: false, message: "Only an approval workflow can approve or post a financial transaction" });
    }

    const data = prismaData(req.body, transactionFields, transactionRelations, ["transactionDate"]);
    const transaction = await prisma.transaction.update({
      where: { id: existing.id },
      data,
      include: accountInclude,
    });
    return res.json({
      success: true,
      message: "Transaction updated",
      data: serializePrismaRecord(transaction),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found" });
    if (transaction.status === "posted") {
      return res.status(409).json({ success: false, message: "Posted ledger transactions cannot be deleted" });
    }
    if (Array.isArray(transaction.history) && transaction.history.length) {
      return res.status(409).json({ success: false, message: "Submitted transactions are retained for audit" });
    }
    await prisma.transaction.delete({ where: { id: transaction.id } });
    return res.json({ success: true, message: "Transaction deleted" });
  } catch (error) {
    return next(error);
  }
};
