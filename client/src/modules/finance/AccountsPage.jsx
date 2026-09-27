import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Wallet,
} from "lucide-react";

import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../../services/account.service";

const initialForm = {
  accountCode: "",
  accountName: "",
  accountType: "asset",
  openingBalance: 0,
  status: "active",
};

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadAccounts = async () => {
    try {
      setLoading(true);

      const response = await getAccounts();

      setAccounts(response.data || []);
    } catch (error) {
      console.error(
        "Failed to load accounts:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to load accounts"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditForm = (account) => {
    setEditingId(account._id);

    setForm({
      accountCode: account.accountCode || "",
      accountName: account.accountName || "",
      accountType:
        account.accountType || "asset",
      openingBalance:
        account.openingBalance ?? 0,
      status: account.status || "active",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.accountCode ||
      !form.accountName ||
      !form.accountType
    ) {
      alert(
        "Account code, account name and account type are required."
      );

      return;
    }

    const payload = {
      accountCode: form.accountCode.trim(),
      accountName: form.accountName.trim(),
      accountType: form.accountType,
      openingBalance:
        Number(form.openingBalance) || 0,
      status: form.status,
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateAccount(
          editingId,
          payload
        );
      } else {
        await createAccount(payload);
      }

      await loadAccounts();

      closeForm();
    } catch (error) {
      console.error(
        "Failed to save account:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save account"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this account?"
    );

    if (!confirmed) return;

    try {
      await deleteAccount(id);

      await loadAccounts();
    } catch (error) {
      console.error(
        "Failed to delete account:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete account"
      );
    }
  };

  const filteredAccounts = accounts.filter(
    (account) => {
      const query = search.toLowerCase();

      return (
        account.accountCode
          ?.toLowerCase()
          .includes(query) ||
        account.accountName
          ?.toLowerCase()
          .includes(query) ||
        account.accountType
          ?.toLowerCase()
          .includes(query)
      );
    }
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);
  };

  const getTypeClasses = (type) => {
    const classes = {
      asset: "bg-blue-100 text-blue-700",
      liability: "bg-red-100 text-red-700",
      equity: "bg-purple-100 text-purple-700",
      revenue: "bg-emerald-100 text-emerald-700",
      expense: "bg-amber-100 text-amber-700",
    };

    return (
      classes[type] ||
      "bg-slate-100 text-slate-700"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
            <Wallet size={22} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Accounts
            </h1>

            <p className="text-sm text-slate-500">
              Manage the cooperative's chart of
              accounts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={18} />
          Add Account
        </button>
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
            placeholder="Search accounts..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading accounts...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet
              size={40}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-medium text-slate-700">
              No accounts found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Create your first financial account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Code
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Account Name
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Type
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Opening Balance
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((account) => (
                  <tr
                    key={account._id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {account.accountCode}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900">
                      {account.accountName}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getTypeClasses(
                          account.accountType
                        )}`}
                      >
                        {account.accountType}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatCurrency(
                        account.openingBalance
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          account.status ===
                          "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {account.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(account)
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-700"
                          title="Edit account"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              account._id
                            )
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete account"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? "Edit Account"
                    : "Add Account"}
                </h2>

                <p className="text-sm text-slate-500">
                  Enter account information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Account Code *
                </label>

                <input
                  name="accountCode"
                  value={form.accountCode}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="1000"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Account Name *
                </label>

                <input
                  name="accountName"
                  value={form.accountName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Cash Account"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Account Type *
                </label>

                <select
                  name="accountType"
                  value={form.accountType}
                  onChange={handleChange}
                  className="form-input"
                  required
                >
                  <option value="asset">
                    Asset
                  </option>

                  <option value="liability">
                    Liability
                  </option>

                  <option value="equity">
                    Equity
                  </option>

                  <option value="revenue">
                    Revenue
                  </option>

                  <option value="expense">
                    Expense
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Opening Balance
                </label>

                <input
                  type="number"
                  name="openingBalance"
                  min="0"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                    : editingId
                    ? "Update Account"
                    : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;