import { useState } from "react";
import { Users, WalletCards } from "lucide-react";

import EmployeesPage from "./EmployeesPage.jsx";
import PayrollPage from "./PayrollPage.jsx";

const HRPage = () => {
  const [activeTab, setActiveTab] = useState("employees");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Human Resources
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage employees, payroll and human resource records.
        </p>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("employees")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "employees"
                ? "bg-primary-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users size={18} />
            Employees
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "payroll"
                ? "bg-primary-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <WalletCards size={18} />
            Payroll
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "employees" && <EmployeesPage />}
      {activeTab === "payroll" && <PayrollPage />}
    </div>
  );
};

export default HRPage;