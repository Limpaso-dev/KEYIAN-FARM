import { useState } from "react";
import {
  Building2,
  ClipboardList,
} from "lucide-react";

import SuppliersPage from "./SuppliersPage";
import PurchaseOrdersPage from "./PurchaseOrdersPage";

const ProcurementPage = () => {
  const [activeSection, setActiveSection] =
    useState("suppliers");

  const sections = [
    {
      id: "suppliers",
      label: "Suppliers",
      description: "Manage procurement suppliers",
      icon: Building2,
    },
    {
      id: "purchase-orders",
      label: "Purchase Orders",
      description: "Create and manage purchase orders",
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Procurement
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage suppliers and purchasing activities
          across Keiyian Farmers Cooperative Society.
        </p>
      </div>

      {/* Section Navigation */}
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          const active =
            activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                setActiveSection(section.id)
              }
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${
                active
                  ? "border-primary-300 bg-primary-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50"
              }`}
            >
              <div
                className={`rounded-xl p-3 ${
                  active
                    ? "bg-primary-100 text-primary-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon size={22} />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  {section.label}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  {section.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Section */}
      <div>
        {activeSection === "suppliers" && (
          <SuppliersPage />
        )}

        {activeSection === "purchase-orders" && (
          <PurchaseOrdersPage />
        )}
      </div>
    </div>
  );
};

export default ProcurementPage;