import { useState } from "react";
import {
  WalletCards,
  Receipt,
  BadgeDollarSign,
} from "lucide-react";

import AccountsPage from "./AccountsPage";
import TransactionsPage from "./TransactionsPage";
import SupplierPaymentsPage from "./SupplierPaymentsPage";

const FinancePage = () => {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Finance & Accounts
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage accounts, transactions and financial
          records across the cooperative.
        </p>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("accounts")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "accounts"
                ? "bg-primary-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <WalletCards size={18} />
            Accounts
          </button>

          <button type="button" onClick={() => setActiveTab("supplier-payments")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "supplier-payments" ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><BadgeDollarSign size={18}/>Supplier Payments</button>

          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "transactions"
                ? "bg-primary-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Receipt size={18} />
            Transactions
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "accounts" && <AccountsPage />}

      {activeTab === "transactions" && (
        <TransactionsPage />
      )}
      {activeTab === "supplier-payments" && <SupplierPaymentsPage />}
    </div>
  );
};

export default FinancePage;
