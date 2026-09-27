import { useState } from "react";
import {
  Leaf,
  Sprout,
  Wheat,
} from "lucide-react";

import TeaFarmPage from "./TeaFarmPage";
import SugarcaneFarmPage from "./SugarcaneFarmPage";

const AgriculturePage = () => {
  const [activeArea, setActiveArea] =
    useState("tea");

  const renderActiveArea = () => {
    switch (activeArea) {
      case "sugarcane":
        return <SugarcaneFarmPage />;

      case "tea":
      default:
        return <TeaFarmPage />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Leaf size={25} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Agriculture Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage crop farms, planting, production
              and harvesting activities.
            </p>
          </div>
        </div>

        {/* Agriculture Areas */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <AgricultureAreaCard
            icon={Sprout}
            title="Tea Farming"
            description="Manage tea farms, varieties, acreage and production records."
            active={activeArea === "tea"}
            onClick={() => setActiveArea("tea")}
          />

          <AgricultureAreaCard
            icon={Wheat}
            title="Sugarcane Farming"
            description="Manage sugarcane farms, planting and harvest records."
            active={
              activeArea === "sugarcane"
            }
            onClick={() =>
              setActiveArea("sugarcane")
            }
          />
        </div>
      </div>

      {/* Active Area */}
      <div>{renderActiveArea()}</div>
    </div>
  );
};

const AgricultureAreaCard = ({
  icon: Icon,
  title,
  description,
  active,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-5 text-left transition ${
        active
          ? "border-primary-300 bg-primary-50 shadow-sm"
          : "border-slate-200 bg-slate-50 hover:border-primary-200 hover:bg-primary-50/40"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`rounded-lg p-3 ${
            active
              ? "bg-primary-100 text-primary-700"
              : "bg-white text-slate-500"
          }`}
        >
          <Icon size={22} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
};

export default AgriculturePage;