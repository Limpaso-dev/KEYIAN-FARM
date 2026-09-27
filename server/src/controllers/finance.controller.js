import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

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
    const transaction = await Transaction.create(req.body);

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
    const transaction =
      await Transaction.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

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
    const transaction =
      await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      message: "Transaction deleted",
    });
  } catch (error) {
    next(error);
  }
};