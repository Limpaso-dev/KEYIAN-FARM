import { Wheat } from "lucide-react";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { inputDate, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";

const FarmHistory = ({ row }) => {
  const { label } = useAuth();
  const { data, loading } = useFetch(`/crops/farms/${row.id}/history`);
  if (loading) return <Spinner />;
  return (
    <div className="grid gap-6 text-sm md:grid-cols-2">
      <div>
        <p className="mb-1 font-medium text-slate-700">Status history</p>
        <ul className="space-y-1 text-slate-600">
          {(data?.statusLogs || []).map((s) => <li key={s.id}>{String(s.date).slice(0, 10)}: {label("farmStatus", s.status)}{s.note ? ` - ${s.note}` : ""}</li>)}
          {!data?.statusLogs?.length && <li>No status changes recorded</li>}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-medium text-slate-700">Harvests ({data?.harvests?.length || 0})</p>
        <ul className="space-y-1 text-slate-600">
          {(data?.harvests || []).map((h) => <li key={h.id}>{String(h.harvestDate).slice(0, 10)}: {number(h.quantity)} {h.unit}{h.buyer ? ` to ${h.buyer}` : ""}</li>)}
          {!data?.harvests?.length && <li>No harvests yet</li>}
        </ul>
      </div>
    </div>
  );
};

const farms = {
  resource: "cropFarms",
  endpoint: "/crops/farms",
  title: "Farms",
  description: "Sugarcane, tea and coffee farms. Each sugarcane harvest adds one to the ratoon count.",
  singular: "Farm",
  createLabel: "Add farm",
  filters: [{ type: "search", placeholder: "Farm no. or location" }, { name: "cropType", label: "Crop", options: "cropTypes" }, { name: "status", label: "Status", options: "farmStatus" }],
  columns: [
    { key: "farmNumber", label: "Farm no." },
    { key: "cropType", label: "Crop", type: "option:cropTypes" },
    { key: "acreage", label: "Acres", type: "number" },
    { key: "location", label: "Location" },
    { key: "plantingDate", label: "Planted", type: "date" },
    { key: "ratoonCount", label: "Ratoon", type: "number" },
    { key: "harvests", label: "Harvests", render: (r) => r._count?.harvests ?? 0, align: "right" },
    { key: "status", label: "Status", render: (r, c) => <span>{c.label("farmStatus", r.status)}{r.statusNote ? <span className="block text-xs text-slate-500">{r.statusNote}</span> : null}</span> },
  ],
  createFields: [
    { name: "farmNumber", label: "Farm number", required: true },
    { name: "cropType", label: "Crop", type: "select", options: "cropTypes", required: true },
    { name: "acreage", label: "Acreage", type: "number", required: true },
    { name: "location", label: "Location", required: true },
    { name: "plantingDate", label: "Planting date", type: "date" },
    { name: "ratoonCount", label: "Times harvested so far (ratoon)", type: "number", step: 1 },
    { name: "status", label: "Current status", type: "select", options: "farmStatus" },
    { name: "statusNote", label: "Status note" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  editFields: [
    { name: "farmNumber", label: "Farm number", required: true },
    { name: "cropType", label: "Crop", type: "select", options: "cropTypes", required: true },
    { name: "acreage", label: "Acreage", type: "number", required: true },
    { name: "location", label: "Location", required: true },
    { name: "plantingDate", label: "Planting date", type: "date" },
    { name: "ratoonCount", label: "Ratoon count", type: "number", step: 1 },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ status: "land_preparation", ratoonCount: 0 }),
  toForm: (row) => ({ ...row, plantingDate: inputDate(row.plantingDate) }),
  expand: (row) => <FarmHistory row={row} />,
  actions: [
    {
      key: "status", label: "Update status", allowed: (c) => c.can("cropFarms", "write"),
      path: (r) => `/crops/farms/${r.id}/status`, title: (r) => `Status of ${r.farmNumber}`,
      fields: [
        { name: "status", label: "New status", type: "select", options: "farmStatus", required: true },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "note", label: "Note", type: "textarea", placeholder: "e.g. Weeding done, waiting for CAN fertiliser" },
      ],
      initial: (r) => ({ status: r.status, date: today() }),
    },
    {
      key: "harvest", label: "Harvest", icon: Wheat, variant: "primary", allowed: (c) => c.can("cropHarvests", "write"),
      path: () => "/crops/harvests", title: (r) => `Harvest from ${r.farmNumber}`,
      fields: [
        { name: "harvestDate", label: "Date", type: "date", required: true },
        { name: "quantity", label: "Quantity", type: "number", required: true },
        { name: "unit", label: "Unit", type: "select", options: "harvestUnits", required: true },
        { name: "buyer", label: "Sold / delivered to" },
        { name: "amount", label: "Value (KES)", type: "number" },
        { name: "markHarvested", label: "Status", type: "checkbox", checkboxLabel: "Set farm status to Harvested" },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      initial: (r) => ({ harvestDate: today(), unit: r.cropType === "sugarcane" ? "tonnes" : "kg", markHarvested: true }),
      toPayload: (v, r) => ({ ...v, farmId: r.id, markHarvested: Boolean(v.markHarvested) }),
      success: () => "Harvest recorded",
    },
  ],
};

const harvests = {
  resource: "cropHarvests",
  endpoint: "/crops/harvests",
  title: "Harvests",
  singular: "Harvest",
  createLabel: "Record harvest",
  filters: [{ type: "dateRange" }],
  columns: [
    { key: "harvestDate", label: "Date", type: "date" },
    { key: "farm", label: "Farm", render: (r) => r.farm?.farmNumber },
    { key: "crop", label: "Crop", render: (r, c) => c.label("cropTypes", r.farm?.cropType) },
    { key: "quantity", label: "Quantity", render: (r) => `${number(r.quantity)} ${r.unit}`, align: "right" },
    { key: "buyer", label: "Buyer" },
    { key: "amount", label: "Value", type: "money" },
  ],
  createFields: [
    { name: "farmId", label: "Farm", type: "select", ref: refs.farms, required: true, span: 2 },
    { name: "harvestDate", label: "Date", type: "date", required: true },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "unit", label: "Unit", type: "select", options: "harvestUnits", required: true },
    { name: "buyer", label: "Sold / delivered to" },
    { name: "amount", label: "Value (KES)", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  editFields: [
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "unit", label: "Unit", type: "select", options: "harvestUnits", required: true },
    { name: "buyer", label: "Sold / delivered to" },
    { name: "amount", label: "Value (KES)", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ harvestDate: today(), unit: "tonnes" }),
};

const CropsPage = () => (
  <ModulePage
    title="Crops"
    description="Sugarcane, tea and coffee: farm numbers, acreage, location, ratoon count, status and harvests."
    tabs={[
      { key: "farms", label: "Farms", show: (c) => c.can("cropFarms"), render: () => <ResourcePage config={farms} /> },
      { key: "harvests", label: "Harvests", show: (c) => c.can("cropHarvests"), render: () => <ResourcePage config={harvests} /> },
    ]}
  />
);

export default CropsPage;
