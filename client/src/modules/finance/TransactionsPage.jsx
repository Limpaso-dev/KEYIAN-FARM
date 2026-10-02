import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
} from "lucide-react";

import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../../services/transaction.service";

import { getAccounts } from "../../services/account.service";
import { Link } from "react-router-dom";

const initialForm = {
  reference: "",
  transactionDate: "",
  type: "income",
  account: "",
  amount: "",
  description: "",
  status: "pending",
};

const transactionTypes = [
  "income",
  "expense",
  "payment",
  "receipt",
  "transfer",
  "journal",
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
};

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getTypeClass = (type) => {
  switch (type) {
    case "income":
    case "receipt":
      return "bg-emerald-50 text-emerald-700";

    case "expense":
    case "payment":
      return "bg-red-50 text-red-700";

    case "transfer":
      return "bg-blue-50 text-blue-700";

    case "journal":
      return "bg-purple-50 text-purple-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
};

const getStatusClass = (status) => {
  switch (status) {
    case "posted":
      return "bg-emerald-50 text-emerald-700";

    case "approved":
      return "bg-blue-50 text-blue-700";

    case "pending":
      return "bg-amber-50 text-amber-700";

    case "cancelled":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
};

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [transactionResponse, accountResponse] =
        await Promise.all([
          getTransactions(),
          getAccounts(),
        ]);

      setTransactions(transactionResponse.data || []);
      setAccounts(accountResponse.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load financial transactions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return transactions;
    }

    return transactions.filter((transaction) => {
      const accountName =
        transaction.account?.accountName || "";

      const accountCode =
        transaction.account?.accountCode || "";

      return (
        transaction.reference
          ?.toLowerCase()
          .includes(keyword) ||
        transaction.type
          ?.toLowerCase()
          .includes(keyword) ||
        transaction.status
          ?.toLowerCase()
          .includes(keyword) ||
        transaction.description
          ?.toLowerCase()
          .includes(keyword) ||
        accountName
          .toLowerCase()
          .includes(keyword) ||
        accountCode
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [transactions, search]);

  const totalIncome = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.type === "income" ||
          transaction.type === "receipt"
      )
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0
      );
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" ||
          transaction.type === "payment"
      )
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0
      );
  }, [transactions]);

  const netMovement = totalIncome - totalExpenses;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingTransaction(null);

    setForm({
      ...initialForm,
      transactionDate: new Date()
        .toISOString()
        .split("T")[0],
    });

    setError("");
    setShowModal(true);
  };

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction);

    setForm({
      reference: transaction.reference || "",
      transactionDate: transaction.transactionDate
        ? new Date(transaction.transactionDate)
            .toISOString()
            .split("T")[0]
        : "",
      type: transaction.type || "income",
      account:
        transaction.account?._id ||
        transaction.account ||
        "",
      amount: transaction.amount ?? "",
      description: transaction.description || "",
      status: transaction.status || "pending",
    });

    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingTransaction(null);
    setForm(initialForm);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.reference.trim() ||
      !form.account ||
      !form.amount
    ) {
      setError(
        "Reference, account and amount are required."
      );
      return;
    }

    if (Number(form.amount) <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        reference: form.reference.trim(),
        transactionDate:
          form.transactionDate || undefined,
        type: form.type,
        account: form.account,
        amount: Number(form.amount),
        description: form.description.trim(),
      };

      if (editingTransaction) {
        await updateTransaction(
          editingTransaction._id,
          payload
        );
      } else {
        await createTransaction(payload);
      }

      await loadData();
      closeModal();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save transaction."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction) => {
    const confirmed = window.confirm(
      `Delete transaction "${transaction.reference}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteTransaction(transaction._id);

      setTransactions((previous) =>
        previous.filter(
          (item) => item._id !== transaction._id
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete transaction."
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Transactions
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Record and manage financial transactions.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            <Plus size={18} />
            Record Transaction
          </button>
        </div>
      </div>

      {/* Error */}
      {error && !showModal && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Income
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {formatCurrency(totalIncome)}
              </h2>
            </div>

            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
              <ArrowDownCircle size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Expenses
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {formatCurrency(totalExpenses)}
              </h2>
            </div>

            <div className="rounded-lg bg-red-50 p-3 text-red-600">
              <ArrowUpCircle size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Net Movement
              </p>

              <h2
                className={`mt-2 text-xl font-bold ${
                  netMovement >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(netMovement)}
              </h2>
            </div>

            <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
              <RefreshCw size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search transactions..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Reference
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Date
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Type
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Account
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Amount
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(
                  (transaction) => (
                    <tr
                      key={transaction._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {transaction.reference}
                        </div>

                        {transaction.description && (
                          <div className="mt-1 max-w-xs truncate text-xs text-slate-400">
                            {transaction.description}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          transaction.transactionDate
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getTypeClass(
                            transaction.type
                          )}`}
                        >
                          {transaction.type}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-800">
                          {transaction.account
                            ?.accountName || "—"}
                        </div>

                        {transaction.account
                          ?.accountCode && (
                          <div className="text-xs text-slate-400">
                            {
                              transaction.account
                                .accountCode
                            }
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          transaction.amount
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {transaction.history?.length > 0 ? <Link to="/workflows" className="rounded-lg px-2 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50">Workflow</Link> : <>
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(transaction)
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
                            title="Edit transaction"
                          >
                            <Pencil size={17} />
                          </button>
                          </>}

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(transaction)
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete transaction"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingTransaction
                    ? "Edit Transaction"
                    : "Record Transaction"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Enter the financial transaction details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Reference *
                  </label>

                  <input
                    type="text"
                    name="reference"
                    value={form.reference}
                    onChange={handleChange}
                    placeholder="e.g. TRX-0001"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Transaction Date
                  </label>

                  <input
                    type="date"
                    name="transactionDate"
                    value={form.transactionDate}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Transaction Type *
                  </label>

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    {transactionTypes.map((type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type.charAt(0).toUpperCase() +
                          type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Account *
                  </label>

                  <select
                    name="account"
                    value={form.account}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    <option value="">
                      Select account
                    </option>

                    {accounts.map((account) => (
                      <option
                        key={account._id}
                        value={account._id}
                      >
                        {account.accountCode} —{" "}
                        {account.accountName}
                      </option>
                    ))}
                  </select>

                  {accounts.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Create an account before recording
                      transactions.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Amount (KES) *
                  </label>

                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                    required
                  />
                </div>

                <div className="flex items-end text-sm text-slate-500">Submitting this transaction sends it through the configured Finance approval policy.</div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Enter transaction description..."
                  className="form-input resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingTransaction
                    ? "Update Transaction"
                    : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
