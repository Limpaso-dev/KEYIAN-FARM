import { useState } from "react";
import {
  ClipboardList,
  Factory,
  Milk,
  TestTube2,
} from "lucide-react";

import MilkCollectionPage from "./MilkCollectionPage";
import MilkTestPage from "./MilkTestPage";
import MilkValueAdditionPage from "./MilkValueAdditionPage";

const DairyPage = () => {
  const [activeArea, setActiveArea] =
    useState("collection");

  const renderActiveArea = () => {
    switch (activeArea) {
      case "testing":
        return <MilkTestPage />;

      case "value-addition":
        return <MilkValueAdditionPage />;

      case "collection":
      default:
        return <MilkCollectionPage />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dairy Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Milk size={25} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dairy Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage milk collection, testing,
              processing and value addition.
            </p>
          </div>
        </div>

        {/* Dairy Areas */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <DairyAreaCard
            icon={ClipboardList}
            title="Milk Collection"
            description="Record and manage milk received from farmers."
            active={activeArea === "collection"}
            onClick={() =>
              setActiveArea("collection")
            }
          />

          <DairyAreaCard
            icon={TestTube2}
            title="Milk Testing"
            description="Manage milk quality and laboratory testing."
            active={activeArea === "testing"}
            onClick={() =>
              setActiveArea("testing")
            }
          />

          <DairyAreaCard
            icon={Factory}
            title="Milk Value Addition"
            description="Manage processing and dairy products."
            active={
              activeArea === "value-addition"
            }
            onClick={() =>
              setActiveArea("value-addition")
            }
          />
        </div>
      </div>

      {/* Active Dairy Area */}
      <div>{renderActiveArea()}</div>
    </div>
  );
};

const DairyAreaCard = ({
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
      className={`w-full rounded-xl border p-4 text-left transition ${
        active
          ? "border-primary-300 bg-primary-50 shadow-sm"
          : "border-slate-200 bg-slate-50 hover:border-primary-200 hover:bg-primary-50/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`rounded-lg p-2 ${
            active
              ? "bg-primary-100 text-primary-700"
              : "bg-white text-slate-500"
          }`}
        >
          <Icon size={19} />
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

export default DairyPage;