import { Wheat } from "lucide-react";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { date, inputDate, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import CropReports from "./CropReports";

const isCane = (crop) => crop === "sugarcane";
const isPlucked = (crop) => crop === "tea" || crop === "coffee";
const unitFor = (crop) => (isCane(crop) ? "tonnes" : "kg");

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
/** Times harvested -> PC (plant crop), RI (first ratoon), RII ... */
const cycleName = (count) => (!count ? "PC" : `R${ROMAN[count - 1] || count}`);
const CYCLES = [
  { value: "0", label: "PC - plant crop" },
  ...ROMAN.map((r, i) => ({ value: String(i + 1), label: `R${r} - ${["1st", "2nd", "3rd", "4th", "5th", "6th"][i]} ratoon` })),
];
const hectares = (farm) => (farm.hectares != null ? Number(farm.hectares) : Number(farm.acreage) / 2.471);

const Detail = ({ label, children }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-800">{children || <span className="font-normal text-slate-400">Not recorded</span>}</dd>
  </div>
);

const FarmHistory = ({ row }) => {
  const { label } = useAuth();
  const { data, loading } = useFetch(`/crops/farms/${row.id}/history`);
  if (loading) return <Spinner />;
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Detail label="Long farm number">{row.longFarmNumber}</Detail>
        <Detail label={row.cropType === "fodder" ? "Fodder" : "Variety / clone"}>{row.variety}</Detail>
        <Detail label="Size">{`${number(row.acreage)} acres · ${number(hectares(row))} ha`}</Detail>
        <Detail label="Planted">{date(row.plantingDate)}</Detail>
        {isCane(row.cropType) && <Detail label="Current crop started">{date(row.cycleStartDate)}</Detail>}
        {isCane(row.cropType) && <Detail label="Expected TCH">{row.expectedTch != null ? `${number(row.expectedTch)} t/ha` : ""}</Detail>}
        {isPlucked(row.cropType) && <Detail label="Daily target">{row.dailyTarget != null ? `${number(row.dailyTarget)} kg` : ""}</Detail>}
        {row.notes && <Detail label="Notes">{row.notes}</Detail>}
      </dl>
      <div className="grid gap-6 border-t border-slate-100 pt-4 md:grid-cols-2">
        <div>
          <p className="mb-1 font-medium text-slate-700">Status history</p>
          <ul className="space-y-1 text-slate-600">
            {(data?.statusLogs || []).map((s) => <li key={s.id}>{date(s.date)}: {label("farmStatus", s.status)}{s.note ? ` - ${s.note}` : ""}</li>)}
            {!data?.statusLogs?.length && <li>No status changes recorded</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-slate-700">Harvests ({data?.harvests?.length || 0})</p>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-slate-600">
            {(data?.harvests || []).map((h) => <li key={h.id}>{date(h.harvestDate)}: {number(h.quantity)} {h.unit}{h.target != null ? ` (target ${number(h.target)})` : ""}{h.buyer ? ` to ${h.buyer}` : ""}</li>)}
            {!data?.harvests?.length && <li>No harvests yet</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Register fields. Crop-specific ones only appear for the crops they apply to.
const crop = (test) => (values) => test(values.cropType);
const registerFields = [
  { type: "section", label: "Farm", help: "Registered once. Status changes and harvests keep it up to date." },
  { name: "farmNumber", label: "Farm number (F.No.)", required: true, placeholder: "e.g. 397B" },
  { name: "cropType", label: "Crop", type: "select", options: "cropTypes", required: true },
  { name: "longFarmNumber", label: "Long farm number", placeholder: "e.g. 27130300", help: "The miller's or factory's registration number", showIf: crop((c) => c !== "fodder") },
  { name: "variety", label: "Variety / clone", placeholder: "Optional", showIf: crop((c) => c !== "fodder") },
  { name: "variety", label: "Fodder grown", placeholder: "e.g. Boma rhodes, sorghum", required: true, showIf: crop((c) => c === "fodder") },
  { name: "location", label: "Location", required: true },
  { type: "section", label: "Size" },
  { name: "acreage", label: "Acres", type: "number", required: true, min: 0.01 },
  { name: "hectares", label: "Hectares", type: "number", help: "As on the cane register. Leave blank to work it out from the acres.", showIf: crop(isCane) },
  { type: "section", label: "Crop cycle and targets", showIf: crop((c) => isCane(c) || isPlucked(c)) },
  { name: "ratoonCount", label: "Current cycle", type: "select", options: CYCLES, required: true, help: "Goes up by one each time a harvest is recorded", showIf: crop(isCane) },
  { name: "cycleStartDate", label: "Current crop started", type: "date", help: "Planting date, or the last cut for a ratoon. Crop age is counted from here.", showIf: crop(isCane) },
  { name: "expectedTch", label: "Expected TCH", type: "number", help: "Tonnes of cane per hectare expected at harvest", showIf: crop(isCane) },
  { name: "dailyTarget", label: "Daily plucking target (kg)", type: "number", help: "Each plucking day is measured against this", showIf: crop(isPlucked) },
  { name: "plantingDate", label: "Date first planted", type: "date" },
];

/** Leave out fields that don't apply to the chosen crop. */
const farmPayload = (values) => {
  const cane = isCane(values.cropType);
  const plucked = isPlucked(values.cropType);
  return {
    ...values,
    ratoonCount: cane ? Number(values.ratoonCount || 0) : 0,
    hectares: cane ? values.hectares : null,
    cycleStartDate: cane ? values.cycleStartDate : null,
    expectedTch: cane ? values.expectedTch : null,
    dailyTarget: plucked ? values.dailyTarget : null,
  };
};

const farms = {
  resource: "cropFarms",
  endpoint: "/crops/farms",
  title: "Farms",
  description: "The farm register: sugarcane, tea, coffee and fodder. Each sugarcane harvest moves the farm to its next ratoon.",
  singular: "Farm",
  createLabel: "Register farm",
  filters: [{ type: "search", placeholder: "Farm no., long no., location" }, { name: "cropType", label: "Crop", options: "cropTypes" }, { name: "status", label: "Status", options: "farmStatus" }],
  columns: [
    { key: "farmNumber", label: "Farm no.", render: (r) => <span className="font-medium text-slate-900">{r.farmNumber}{r.longFarmNumber ? <span className="block text-xs font-normal text-slate-500">{r.longFarmNumber}</span> : null}</span> },
    { key: "cropType", label: "Crop", render: (r, c) => <span>{c.label("cropTypes", r.cropType)}{r.variety ? <span className="block text-xs text-slate-500">{r.variety}</span> : null}</span> },
    { key: "acreage", label: "Size", align: "right", render: (r) => <span className="tabular-nums">{number(r.acreage)} ac<span className="block text-xs text-slate-500">{number(hectares(r))} ha</span></span> },
    { key: "location", label: "Location" },
    {
      key: "cycle", label: "Cycle / target",
      render: (r) => (isCane(r.cropType)
        ? <span>{cycleName(r.ratoonCount)}{r.expectedTch != null ? <span className="block text-xs text-slate-500">{number(r.expectedTch)} TCH expected</span> : null}</span>
        : isPlucked(r.cropType) && r.dailyTarget != null ? <span className="tabular-nums">{number(r.dailyTarget)} kg/day</span> : <span className="text-slate-400">-</span>),
    },
    { key: "harvests", label: "Harvests", render: (r) => r._count?.harvests ?? 0, align: "right" },
    { key: "status", label: "Status", render: (r, c) => <span>{c.label("farmStatus", r.status)}{r.statusNote ? <span className="block text-xs text-slate-500">{r.statusNote}</span> : null}</span> },
  ],
  createFields: [
    ...registerFields,
    { type: "section", label: "Where things stand" },
    { name: "status", label: "Current status", type: "select", options: "farmStatus" },
    { name: "statusNote", label: "Status note", placeholder: "e.g. Chemical weeding needed" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  editFields: [...registerFields, { name: "notes", label: "Notes", type: "textarea" }],
  createInitial: () => ({ status: "land_preparation", ratoonCount: "0", expectedTch: 150 }),
  toForm: (row) => ({ ...row, ratoonCount: String(row.ratoonCount ?? 0), plantingDate: inputDate(row.plantingDate), cycleStartDate: inputDate(row.cycleStartDate) }),
  toPayload: farmPayload,
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
      path: () => "/crops/harvests",
      title: (r) => (isPlucked(r.cropType) ? `Plucking on ${r.farmNumber}` : `Harvest from ${r.farmNumber}`),
      fields: [
        { name: "harvestDate", label: "Date", type: "date", required: true },
        { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.01 },
        { name: "unit", label: "Unit", type: "select", options: "harvestUnits", required: true },
        { name: "target", label: "Target for the day (kg)", type: "number", help: "From the farm's daily target", showIf: (v) => isPlucked(v._crop) },
        { name: "buyer", label: "Sold / delivered to" },
        { name: "amount", label: "Value (KES)", type: "number" },
        { name: "markHarvested", label: "Status", type: "checkbox", checkboxLabel: "Set farm status to Harvested", showIf: (v) => !isPlucked(v._crop) },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      initial: (r) => ({
        harvestDate: today(),
        unit: unitFor(r.cropType),
        target: isPlucked(r.cropType) ? r.dailyTarget ?? "" : "",
        markHarvested: isCane(r.cropType),
        _crop: r.cropType,
      }),
      toPayload: (v, r) => ({ ...v, farmId: r.id, markHarvested: Boolean(v.markHarvested) && !isPlucked(r.cropType) }),
      success: (_, r) => (isPlucked(r.cropType) ? "Plucking recorded" : "Harvest recorded"),
    },
  ],
};

const harvests = {
  resource: "cropHarvests",
  endpoint: "/crops/harvests",
  title: "Harvests",
  description: "Every harvest and tea or coffee plucking day. These feed the period reports.",
  singular: "Harvest",
  createLabel: "Record harvest",
  filters: [{ type: "dateRange" }],
  columns: [
    { key: "harvestDate", label: "Date", type: "date" },
    { key: "farm", label: "Farm", render: (r) => r.farm?.farmNumber },
    { key: "crop", label: "Crop", render: (r, c) => c.label("cropTypes", r.farm?.cropType) },
    { key: "quantity", label: "Quantity", render: (r) => `${number(r.quantity)} ${r.unit}`, align: "right" },
    { key: "target", label: "Target", align: "right", render: (r) => (r.target != null ? number(r.target) : "") },
    { key: "buyer", label: "Buyer" },
    { key: "amount", label: "Value", type: "money" },
  ],
  createFields: [
    {
      name: "farmId", label: "Farm", type: "select", ref: refs.farms, required: true, span: 2,
      onSelect: (row) => ({ _crop: row?.cropType, unit: unitFor(row?.cropType), target: isPlucked(row?.cropType) ? row?.dailyTarget ?? "" : "" }),
    },
    { name: "harvestDate", label: "Date", type: "date", required: true },
    { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.01 },
    { name: "unit", label: "Unit", type: "select", options: "harvestUnits", required: true },
    { name: "target", label: "Target for the day (kg)", type: "number", showIf: (v) => isPlucked(v._crop) },
    { name: "buyer", label: "Sold / delivered to" },
    { name: "amount", label: "Value (KES)", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  editFields: [
    { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.01 },
    { name: "unit", label: "Unit", type: "select", options: "harvestUnits", required: true },
    { name: "target", label: "Target for the day (kg)", type: "number", showIf: (v) => isPlucked(v.farm?.cropType) },
    { name: "buyer", label: "Sold / delivered to" },
    { name: "amount", label: "Value (KES)", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ harvestDate: today(), unit: "tonnes" }),
};

const CropsPage = () => (
  <ModulePage
    title="Crops"
    description="Sugarcane, tea, coffee and fodder: the farm register, status, harvests and period reports."
    tabs={[
      { key: "farms", label: "Farms", show: (c) => c.can("cropFarms"), render: () => <ResourcePage config={farms} /> },
      { key: "harvests", label: "Harvests", show: (c) => c.can("cropHarvests"), render: () => <ResourcePage config={harvests} /> },
      { key: "reports", label: "Reports", show: (c) => c.can("cropFarms"), render: () => <CropReports /> },
    ]}
  />
);

export default CropsPage;
