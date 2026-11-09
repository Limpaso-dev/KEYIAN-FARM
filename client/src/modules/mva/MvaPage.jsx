import { FlaskConical, Milk } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { StockPanel } from "../../components/resource/StockPanel";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { get } from "../../lib/api";
import { date, daysAgo, fullName, money, number, nairobiHour, today } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";
import { milkTransfers } from "../livestock/milkTransfers";
import { productTransfers } from "./productTransfers";

const farmer = (s) => (s ? `${s.supplierNumber} - ${fullName(s)}` : "");

const suppliers = {
  resource: "milkSuppliers",
  endpoint: "/mva/milk-suppliers",
  title: "Farmers supplying milk",
  description: "Each farmer gets a number (130, 131, 132 ...). Leave the number blank to use the next one. Their ID and payment details are kept by Accounts.",
  singular: "Farmer",
  createLabel: "Register farmer",
  filters: [{ type: "search", placeholder: "Name" }, { name: "status", label: "Status", options: "supplierStatus" }],
  columns: [
    { key: "supplierNumber", label: "No." },
    { key: "name", label: "Farmer", render: fullName },
    { key: "status", label: "Status", type: "status:supplierStatus" },
  ],
  createFields: [
    { name: "supplierNumber", label: "Farmer number", type: "number", step: 1 },
    { name: "status", label: "Status", type: "select", options: "supplierStatus" },
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
  ],
  createInitial: async () => {
    const { next } = await get("/mva/milk-suppliers/next-number");
    return { supplierNumber: next, status: "active" };
  },
};

const prices = {
  resource: "milkPrices",
  endpoint: "/mva/milk-prices",
  title: "Milk price per litre",
  description: "The price on the delivery date is used to value farmer milk. Add a new row when the price changes.",
  singular: "Price",
  createLabel: "Set new price",
  columns: [
    { key: "effectiveDate", label: "From", type: "date" },
    { key: "pricePerLitre", label: "Price per litre", type: "money" },
    { key: "notes", label: "Notes" },
  ],
  createFields: [
    { name: "effectiveDate", label: "Effective from", type: "date", required: true },
    { name: "pricePerLitre", label: "Price per litre (KES)", type: "number", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  editFields: [{ name: "notes", label: "Notes", type: "textarea" }],
  createInitial: () => ({ effectiveDate: today() }),
};

const DeliveryTotals = () => {
  const { data } = useFetch("/mva/milk-deliveries", { from: today(), to: today() });
  const { data: price } = useFetch("/mva/milk-prices/current");
  const rows = data || [];
  return (
    <KeyFigures
      items={[
        { label: "Farmer milk today", value: `${number(rows.reduce((s, r) => s + r.litres, 0))} L` },
        { label: "Farmers delivered", value: new Set(rows.map((r) => r.supplierId)).size },
        { label: "Value today", value: money(rows.reduce((s, r) => s + r.amount, 0)) },
        { label: "Current price", value: price ? `${money(price.pricePerLitre)}/L` : "Not set", tone: price ? undefined : "warn" },
      ]}
    />
  );
};

const deliveries = {
  resource: "milkDeliveries",
  endpoint: "/mva/milk-deliveries",
  title: "Milk received from farmers",
  singular: "Delivery",
  defaultQuery: { from: today(), to: today() },
  filters: [{ name: "session", label: "Session", options: "milkSessions" }, { type: "dateRange" }],
  editFields: false,
  deletableWhen: (r) => !r.paymentRunId,
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "session", label: "Session", type: "option:milkSessions" },
    { key: "supplier", label: "Farmer", render: (r) => farmer(r.supplier) },
    { key: "litres", label: "Litres", type: "number" },
    { key: "pricePerLitre", label: "Price", type: "money" },
    { key: "amount", label: "Value", type: "money" },
    { key: "paid", label: "Paid", render: (r) => (r.paymentRunId ? "In payment run" : "Unpaid") },
  ],
  footer: (rows) => rows.length > 0 && (
    <div className="flex justify-end gap-6 border-t border-slate-100 px-4 py-3 text-sm">
      <span>Litres: <strong>{number(rows.reduce((s, r) => s + r.litres, 0))}</strong></span>
      <span>Value: <strong>{money(rows.reduce((s, r) => s + r.amount, 0))}</strong></span>
    </div>
  ),
  toolbar: (ctx) => ctx.can("milkDeliveries", "write") && (
    <ActionButton label="Record collection" icon={Milk} variant="primary" path="/mva/milk-deliveries" modalSize="lg" onDone={(r) => ctx.notify(r?.message)}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "session", label: "Session", type: "select", options: "milkSessions", required: true },
        {
          name: "deliveries", label: "Litres per farmer (leave blank if the farmer did not deliver)", type: "items", fixedRows: true,
          columns: [{ name: "farmer", label: "Farmer", type: "display" }, { name: "litres", label: "Litres", type: "number", width: 140 }],
          total: (r) => r.litres, formatTotal: (t) => `${number(t)} L`,
        },
      ]}
      initial={async () => {
        const list = await get("/mva/milk-suppliers", { status: "active" });
        return { date: today(), session: nairobiHour() < 12 ? "morning" : "evening", deliveries: list.map((s) => ({ supplierId: s.id, farmer: farmer(s), litres: "" })) };
      }}
      toPayload={(v) => ({ date: v.date, session: v.session, deliveries: v.deliveries.filter((d) => d.litres !== "" && Number(d.litres) > 0).map((d) => ({ supplierId: d.supplierId, litres: d.litres })) })} />
  ),
};

const fromLivestock = {
  ...milkTransfers,
  title: "Milk from Livestock",
  description: "Confirm what arrived from the Livestock department. Received milk is added to MVA raw milk stock.",
  defaultQuery: { status: "sent" },
};

const blankToZero = (value) => (value === "" || value == null ? 0 : Number(value));
const variance = (value) => <span className={value < 0 ? "text-rose-700" : ""}>{number(value, 1)}</span>;

const allocatedText = (row, ctx) => (ctx.meta?.allocationDestinations || []).filter((d) => row[d.value] > 0).map((d) => `${d.label} ${number(row[d.value])}`).join(", ");

const allocationAction = (key, label, when) => ({
  key,
  label,
  variant: key === "allocate" ? "primary" : undefined,
  when,
  allowed: (c) => c.can("milkAllocations", "write"),
  path: () => "/mva/milk-allocations",
  title: (r) => `Allocate milk for ${date(r.date)}`,
  intro: (r) => <p className="text-sm text-slate-600">Received: Dairy A {number(r.dairyA)}, Dairy C {number(r.dairyC)}, Farmers {number(r.farmers)}. <strong className="font-semibold text-slate-900">Total {number(r.total)}</strong></p>,
  fields: (r) => [
    {
      name: "lines", label: "Where the milk went", type: "items", fixedRows: true,
      columns: [{ name: "name", label: "Destination", type: "display" }, { name: "quantity", label: "Quantity", type: "number", width: 240 }],
      total: (line) => blankToZero(line.quantity),
      formatTotal: (t) => `${number(t, 1)} (variance ${number(r.total - t, 1)})`,
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  initial: (r, ctx) => ({ notes: r.notes || "", lines: (ctx.meta?.allocationDestinations || []).map((d) => ({ destination: d.value, name: d.label, quantity: r[d.value] || "" })) }),
  toPayload: (v, r) => ({ date: r.id, notes: v.notes, lines: v.lines.map((l) => ({ destination: l.destination, quantity: blankToZero(l.quantity) })) }),
  submitLabel: "Save allocation",
  success: () => "Allocation saved and raw milk stock updated",
});

const allocations = {
  resource: "milkAllocations",
  endpoint: "/mva/milk-allocations",
  title: "Milk allocation",
  description: "Every day with milk received is listed here. Say where it went. L.Sale goes to Sales as raw milk, to be received there.",
  singular: "Allocation",
  emptyText: "No milk received in these dates",
  canCreate: () => false,
  createFields: null,
  editFields: false,
  deletable: false,
  defaultQuery: { from: daysAgo(6), to: today() },
  filters: [{ type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date", className: "whitespace-nowrap" },
    { key: "dairyA", label: "Dairy A", type: "number" },
    { key: "dairyC", label: "Dairy C", type: "number" },
    { key: "farmers", label: "Farmers", type: "number" },
    { key: "total", label: "Total", align: "right", render: (r) => <strong className="font-semibold text-slate-900">{number(r.total)}</strong> },
    { key: "allocated", label: "Allocated to", render: (r, ctx) => (r.allocationId ? allocatedText(r, ctx) : <span className="text-amber-700">Not allocated yet</span>) },
    { key: "variance", label: "Variance", align: "right", render: (r) => (r.allocationId ? variance(r.variance) : "") },
  ],
  actions: [allocationAction("allocate", "Allocate", (r) => !r.allocationId), allocationAction("change", "Change", (r) => Boolean(r.allocationId))],
};

const batches = {
  resource: "processingBatches",
  endpoint: "/mva/processing-batches",
  title: "Product output",
  description: "The kilograms processed and the pieces made. Litres and variances are worked out for you, as on the production sheet.",
  singular: "Output",
  editFields: false,
  defaultQuery: { from: daysAgo(6), to: today() },
  filters: [{ type: "dateRange" }],
  columns: [
    { key: "batchNumber", label: "Batch", className: "whitespace-nowrap", render: (r) => <><span className="block font-medium text-slate-900">{r.batchNumber}</span><span className="text-xs text-slate-500">{date(r.date)}</span></> },
    { key: "mala", label: "Mala", render: (r) => (r.malaKg || r.malaPieces ? `${number(r.malaKg, 1)} kg = ${number(r.malaLitres, 1)} L, ${number(r.malaPieces, 0)} pieces` : "") },
    { key: "malaVariance", label: "Variance (L)", align: "right", render: (r) => (r.malaKg || r.malaPieces ? variance(r.malaVariance) : "") },
    { key: "yoghurt", label: "Yoghurt", render: (r) => (r.yoghurtKg || r.yoghurt500 || r.yoghurt250 || r.yoghurt150 ? `${number(r.yoghurtKg, 1)} kg = ${number(r.yoghurtLitres, 1)} L; 500 ml: ${number(r.yoghurt500, 0)}, 250 ml: ${number(r.yoghurt250, 0)}, 150 ml: ${number(r.yoghurt150, 0)}` : "") },
    { key: "yoghurtVariance", label: "Variance (L)", align: "right", render: (r) => (r.yoghurtKg || r.yoghurt500 || r.yoghurt250 || r.yoghurt150 ? variance(r.yoghurtVariance) : "") },
    { key: "fresh250", label: "Fresh 250", type: "number" },
  ],
  toolbar: (ctx) => ctx.can("processingBatches", "write") && (
    <ActionButton label="Record output" icon={FlaskConical} variant="primary" path="/mva/processing-batches" submitLabel="Save output" onDone={() => ctx.notify("Output saved and added to stock")}
      fields={[
        { name: "date", label: "Date", type: "date", required: true, span: 2 },
        { type: "section", label: "Mala" },
        { name: "malaKg", label: "Amount processed (kg)", type: "number" },
        { name: "malaPieces", label: "Output (500 ml pieces)", type: "number", step: 1 },
        { type: "section", label: "Yoghurt" },
        { name: "yoghurtKg", label: "Amount processed (kg)", type: "number", span: 2 },
        { name: "yoghurt500", label: "500 ml (pieces)", type: "number", step: 1 },
        { name: "yoghurt250", label: "250 ml (pieces)", type: "number", step: 1 },
        { name: "yoghurt150", label: "150 ml (pieces)", type: "number", step: 1 },
        { type: "section", label: "Fresh" },
        { name: "fresh250", label: "Fresh 250 ml (pieces)", type: "number", step: 1, help: "Made from the School allocation and sent to the schools" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      initial={() => ({ date: today() })} />
  ),
};

const MvaPage = () => (
  <ModulePage
    sections={{
      collection: () => <ResourcePage config={deliveries} header={() => <DeliveryTotals />} />,
      livestock: () => <ResourcePage config={fromLivestock} />,
      allocation: () => <ResourcePage config={allocations} />,
      processing: () => <ResourcePage config={batches} />,
      transfers: () => <ResourcePage config={productTransfers} />,
      stock: () => <StockPanel location="mva" />,
      farmers: () => <ResourcePage config={suppliers} />,
      prices: () => <ResourcePage config={prices} />,
    }}
  />
);

export default MvaPage;
