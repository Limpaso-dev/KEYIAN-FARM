import { FlaskConical, Milk } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { StockPanel } from "../../components/resource/StockPanel";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { get } from "../../lib/api";
import { farmerNumberFilter, numberStartsWith } from "../../lib/farmers";
import { date, daysAgo, fullName, money, number, nairobiHour, today } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";
import { milkTransfers } from "../livestock/milkTransfers";
import { productTransfers } from "./productTransfers";
import { RawMaterials } from "./RawMaterials";

const farmer = (s) => (s ? `${s.supplierNumber} - ${fullName(s)}` : "");

// Finding one farmer on the collection sheet, by the farmer number that identifies them
// across the cooperative: 130 finds 130 (first), and 13 narrows the sheet to 130-139.
const farmerSearch = {
  label: "Find a farmer by number",
  placeholder: "Farmer number, e.g. 130",
  noun: "farmers",
  numeric: true,
  match: (row, term) => numberStartsWith(row.number, term),
  exact: (row, term) => String(row.number) === term,
  empty: (term) => `No active farmer number ${term}`,
};

const suppliers = {
  resource: "milkSuppliers",
  endpoint: "/mva/milk-suppliers",
  title: "Farmers supplying milk",
  description: "Each farmer gets a number (130, 131, 132 ...). Leave the number blank to use the next one. Their ID and payment details are kept by Accounts.",
  singular: "Farmer",
  createLabel: "Register farmer",
  filters: [farmerNumberFilter, { name: "status", label: "Status", options: "supplierStatus" }],
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
  // A line of 0 litres is milk that was all rejected; it carries the remarks.
  const rejected = rows.filter((r) => r.notes).length;
  return (
    <KeyFigures
      items={[
        { label: "Farmer milk today", value: `${number(rows.reduce((s, r) => s + r.litres, 0))} L` },
        { label: "Farmers delivered", value: new Set(rows.filter((r) => r.litres > 0).map((r) => r.supplierId)).size, hint: rejected ? `Milk rejected ${rejected === 1 ? "once" : `${rejected} times`}` : undefined },
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
  filters: [farmerNumberFilter, { name: "session", label: "Session", options: "milkSessions" }, { type: "dateRange" }],
  editFields: false,
  deletableWhen: (r) => !r.paymentRunId,
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "session", label: "Session", type: "option:milkSessions" },
    { key: "supplier", label: "Farmer", render: (r) => farmer(r.supplier) },
    { key: "litres", label: "Litres", type: "number" },
    { key: "pricePerLitre", label: "Price", type: "money" },
    { key: "amount", label: "Value", type: "money" },
    { key: "paid", label: "Paid", render: (r) => (r.paymentRunId ? "In payment run" : r.litres > 0 ? "Unpaid" : <span className="text-amber-700">All rejected</span>) },
    { key: "notes", label: "Rejected milk remarks", className: "min-w-[12rem]" },
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
          help: "Type a farmer number and press Enter to go to that farmer; Enter after the litres brings you back to the search. Where milk was rejected, say why under remarks; a farmer whose milk was all rejected gets remarks and no litres.",
          search: farmerSearch,
          columns: [
            { name: "farmer", label: "Farmer", type: "display" },
            { name: "litres", label: "Litres", type: "number", width: 120 },
            { name: "notes", label: "Rejected milk remarks", width: 260, placeholder: "e.g. 5 L rejected: added water" },
          ],
          total: (r) => r.litres, formatTotal: (t) => `${number(t)} L`,
        },
      ]}
      initial={async () => {
        const list = await get("/mva/milk-suppliers", { status: "active" });
        return { date: today(), session: nairobiHour() < 12 ? "morning" : "evening", deliveries: list.map((s) => ({ supplierId: s.id, number: s.supplierNumber, farmer: farmer(s), litres: "", notes: "" })) };
      }}
      toPayload={(v) => ({
        date: v.date,
        session: v.session,
        deliveries: v.deliveries
          .filter((d) => (d.litres !== "" && Number(d.litres) > 0) || d.notes.trim())
          .map((d) => ({ supplierId: d.supplierId, litres: d.litres === "" ? 0 : d.litres, notes: d.notes.trim() })),
      })} />
  ),
};

const fromLivestock = {
  ...milkTransfers,
  title: "Milk from the Keiyian Livestock Section",
  description: "Confirm what arrived from the Keiyian Livestock Section, in litres. Received milk is added to MVA's raw milk (under Raw materials).",
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
      columns: [{ name: "name", label: "Destination", type: "display" }, { name: "quantity", label: "Litres", type: "number", width: 240 }],
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
  description: "Every day with milk received is listed here, in litres. Say where it went. Local sale goes to Sales as raw milk, to be received there.",
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

// Yoghurt pack sizes, largest first: the field and the cups it uses (config/catalog.js RAW_MATERIALS).
const YOGHURT_PACKS = [["yoghurt1000", "1 litre", "YOGHURT_1000"], ["yoghurt500", "500 ml", "YOGHURT_500"], ["yoghurt250", "250 ml", "YOGHURT_250"], ["yoghurt150", "150 ml", "YOGHURT_150"]];
const madeYoghurt = (r) => r.yoghurtLitres || r.bulkYoghurt || YOGHURT_PACKS.some(([key]) => r[key]);
const madeMala = (r) => r.malaLitres || r.malaPieces || r.bulkMala;

/** In the output form: the cups at MVA for each yoghurt size, and a warning where more pieces are entered than there are cups. */
const CupsNote = ({ values }) => {
  const { data } = useFetch("/mva/raw-materials");
  if (!data) return null;
  const cups = YOGHURT_PACKS.map(([key, size, code]) => ({ key, size, onHand: data.find((m) => m.usedFor === code)?.onHand ?? 0, wanted: blankToZero(values[key]) }));
  const short = cups.filter((c) => c.wanted > c.onHand);
  return (
    <div role="status" className={short.length ? "border-l-2 border-rose-500 pl-3 text-sm" : "border-l-2 border-slate-200 pl-3 text-sm"}>
      <p className="text-slate-600">Cups at MVA: {cups.map((c) => `${c.size} ${number(c.onHand, 0)}`).join(" · ")}. Each piece packed uses a cup of its size.</p>
      {short.length > 0 && <p className="mt-1 font-medium text-rose-700">Not enough cups for {short.map((c) => `${c.size} (${number(c.onHand, 0)} at MVA, ${number(c.wanted, 0)} entered)`).join(", ")}. Record the cups received under Raw materials first.</p>}
    </div>
  );
};

const batches = {
  resource: "processingBatches",
  endpoint: "/mva/processing-batches",
  title: "Product output",
  description: "The litres of milk processed and what was made from them: packs, and Mala and Yoghurt in bulk. Variances are worked out for you, as on the production sheet. Each piece of yoghurt packed uses a cup from Raw materials.",
  singular: "Output",
  editFields: false,
  defaultQuery: { from: daysAgo(6), to: today() },
  filters: [{ type: "dateRange" }],
  columns: [
    { key: "batchNumber", label: "Batch", className: "whitespace-nowrap", render: (r) => <><span className="block font-medium text-slate-900">{r.batchNumber}</span><span className="text-xs text-slate-500">{date(r.date)}</span></> },
    { key: "mala", label: "Mala", render: (r) => (madeMala(r) ? `${number(r.malaLitres, 1)} L processed: ${number(r.malaPieces, 0)} pieces${r.bulkMala ? `, ${number(r.bulkMala, 1)} L bulk` : ""}` : "") },
    { key: "malaVariance", label: "Variance (L)", align: "right", render: (r) => (madeMala(r) ? variance(r.malaVariance) : "") },
    { key: "yoghurt", label: "Yoghurt", render: (r) => (madeYoghurt(r) ? `${number(r.yoghurtLitres, 1)} L processed: ${YOGHURT_PACKS.map(([key, size]) => `${size}: ${number(r[key], 0)}`).join(", ")}${r.bulkYoghurt ? `; ${number(r.bulkYoghurt, 1)} L bulk` : ""}` : "") },
    { key: "yoghurtVariance", label: "Variance (L)", align: "right", render: (r) => (madeYoghurt(r) ? variance(r.yoghurtVariance) : "") },
    { key: "fresh250", label: "Fresh Pasteurised Milk (packets)", type: "number" },
  ],
  toolbar: (ctx) => ctx.can("processingBatches", "write") && (
    <ActionButton label="Record output" icon={FlaskConical} variant="primary" path="/mva/processing-batches" submitLabel="Save output" onDone={() => ctx.notify("Output saved and added to stock")}
      fields={[
        { name: "date", label: "Date", type: "date", required: true, span: 2 },
        { type: "section", label: "Mala" },
        { name: "malaLitres", label: "Milk processed (litres)", type: "number", span: "third" },
        { name: "malaPieces", label: "Mala 500 ml (pieces)", type: "number", step: 1, span: "third" },
        { name: "bulkMala", label: "Bulk Mala (litres)", type: "number", span: "third" },
        { type: "section", label: "Yoghurt", help: "Each piece packed uses a cup of its size from Raw materials." },
        { name: "yoghurtLitres", label: "Milk processed (litres)", type: "number" },
        { name: "bulkYoghurt", label: "Bulk Yoghurt (litres)", type: "number" },
        ...YOGHURT_PACKS.map(([key, size]) => ({ name: key, label: `Yoghurt ${size} (pieces)`, type: "number", step: 1 })),
        { type: "note", name: "cups", render: (values) => <CupsNote values={values} /> },
        { type: "section", label: "Fresh Pasteurised Milk" },
        { name: "fresh250", label: "Fresh Pasteurised Milk 250 ml (packets)", type: "number", step: 1, help: "Packets go into MVA stock, ready to send to Sales" },
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
      materials: () => <RawMaterials />,
      stock: () => <StockPanel location="mva" except={["RAW_MILK"]} title="Products at MVA" />,
      farmers: () => <ResourcePage config={suppliers} />,
      prices: () => <ResourcePage config={prices} />,
    }}
  />
);

export default MvaPage;
