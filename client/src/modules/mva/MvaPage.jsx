import { FlaskConical, Milk } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { StockPanel } from "../../components/resource/StockPanel";
import { Card, StatCard } from "../../components/ui/ui";
import { get } from "../../lib/api";
import { fullName, money, number, nairobiHour, today } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";
import { milkTransfers } from "../livestock/milkTransfers";
import { productLines, productTransfers } from "./productTransfers";

const farmer = (s) => (s ? `${s.supplierNumber} - ${fullName(s)}` : "");

const suppliers = {
  resource: "milkSuppliers",
  endpoint: "/mva/milk-suppliers",
  title: "Farmers supplying milk",
  description: "Each farmer gets a number (130, 131, 132 ...). Leave the number blank to use the next one.",
  singular: "Farmer",
  createLabel: "Register farmer",
  filters: [{ type: "search", placeholder: "Name, phone, location" }, { name: "status", label: "Status", options: "supplierStatus" }],
  columns: [
    { key: "supplierNumber", label: "No." },
    { key: "name", label: "Farmer", render: fullName },
    { key: "phone", label: "Phone" },
    { key: "location", label: "Location" },
    { key: "paymentMethod", label: "Paid by", type: "option:paymentMethods" },
    { key: "paymentDetails", label: "Payment details" },
    { key: "status", label: "Status", type: "status:supplierStatus" },
  ],
  createFields: [
    { name: "supplierNumber", label: "Farmer number", type: "number", step: 1 },
    { name: "status", label: "Status", type: "select", options: "supplierStatus" },
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    { name: "nationalId", label: "National ID" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "location", label: "Location", span: 2 },
    { name: "paymentMethod", label: "Paid by", type: "select", options: "paymentMethods", optionFilter: (o) => o.value !== "credit" },
    { name: "paymentDetails", label: "M-Pesa number / bank account" },
  ],
  createInitial: async () => {
    const { next } = await get("/mva/milk-suppliers/next-number");
    return { supplierNumber: next, status: "active", paymentMethod: "mpesa" };
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
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Farmer milk today" value={`${number(rows.reduce((s, r) => s + r.litres, 0))} L`} />
        <StatCard label="Farmers delivered" value={new Set(rows.map((r) => r.supplierId)).size} />
        <StatCard label="Value today" value={money(rows.reduce((s, r) => s + r.amount, 0))} />
        <StatCard label="Current price" value={price ? `${money(price.pricePerLitre)}/L` : "Not set"} tone={price ? "default" : "warn"} />
      </div>
    </Card>
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

const batches = {
  resource: "processingBatches",
  endpoint: "/mva/processing-batches",
  title: "Processing",
  description: "Raw milk used and the Fresh milk, Mala and Yoghurt made from it.",
  singular: "Batch",
  editFields: false,
  deletable: false,
  filters: [{ type: "dateRange" }],
  columns: [
    { key: "batchNumber", label: "Batch" },
    { key: "date", label: "Date", type: "date" },
    { key: "rawMilkInput", label: "Raw milk used (L)", type: "number" },
    { key: "outputs", label: "Products made", render: (r) => productLines(r.outputs) },
    { key: "notes", label: "Notes" },
  ],
  toolbar: (ctx) => ctx.can("processingBatches", "write") && (
    <ActionButton label="Record processing" icon={FlaskConical} variant="primary" path="/mva/processing-batches" onDone={(r) => ctx.notify(r?.message)}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "rawMilkInput", label: "Raw milk used (litres)", type: "number", required: true },
        {
          name: "outputs", label: "Products made", type: "items", fixedRows: true,
          columns: [{ name: "product", label: "Product", type: "display" }, { name: "quantity", label: "Quantity", type: "number", width: 140 }],
        },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      initial={async () => {
        const products = await get("/sales/products", { isActive: "true" });
        return { date: today(), outputs: products.filter((p) => p.code !== "RAW_MILK").map((p) => ({ productId: p.id, product: `${p.name} (${p.unit})`, quantity: "" })) };
      }}
      toPayload={(v) => ({ ...v, outputs: v.outputs.filter((o) => o.quantity !== "" && Number(o.quantity) > 0).map((o) => ({ productId: o.productId, quantity: o.quantity })) })} />
  ),
};

const MvaPage = () => (
  <ModulePage
    title="Milk Value Addition"
    description="Milk received from Livestock and farmers, processing into Fresh milk, Mala and Yoghurt, and products sent to Sales."
    tabs={[
      { key: "collection", label: "Farmer milk", show: (c) => c.can("milkDeliveries"), render: () => <ResourcePage config={deliveries} header={() => <DeliveryTotals />} /> },
      { key: "livestock", label: "From Livestock", show: (c) => c.can("milkTransfers", "receive") || c.user?.department === "mva", render: () => <ResourcePage config={fromLivestock} /> },
      { key: "processing", label: "Processing", show: (c) => c.can("processingBatches"), render: () => <ResourcePage config={batches} /> },
      { key: "transfers", label: "To Sales", show: (c) => c.can("productTransfers"), render: () => <ResourcePage config={productTransfers} /> },
      { key: "stock", label: "Stock", show: (c) => c.can("mvaStock"), render: () => <StockPanel location="mva" /> },
      { key: "farmers", label: "Farmers", show: (c) => c.can("milkSuppliers"), render: () => <ResourcePage config={suppliers} /> },
      { key: "prices", label: "Milk price", show: (c) => c.can("milkPrices"), render: () => <ResourcePage config={prices} /> },
    ]}
  />
);

export default MvaPage;
