import { Truck } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { StockPanel } from "../../components/resource/StockPanel";
import { Alert, Badge } from "../../components/ui/ui";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { get } from "../../lib/api";
import { date, money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { productLines, productTransfers } from "../mva/productTransfers";

const blankToZero = (value) => (value === "" || value == null ? 0 : Number(value));
const leftOnVehicle = (item) => item.quantityDispatched - item.quantityReturned - item.quantityDamaged - item.quantityReplaced;
const priceCell = (value) => (value > 0 ? money(value) : <span className="text-amber-700">Not set</span>);

const received = {
  ...productTransfers,
  title: "Products received from MVA",
  description: "Deliveries from MVA. Stock is added to Sales only when you receive it.",
  defaultQuery: { status: "received" },
  toolbar: undefined,
  deletable: false,
};

/** Deliveries still to be received, which the Received list does not show. */
const WaitingFromMva = ({ onShow }) => {
  const { data } = useFetch("/mva/product-transfers", { status: "sent" });
  const count = data?.length || 0;
  if (!count) return null;
  return (
    <Alert tone="info">
      {count === 1 ? "1 delivery" : `${count} deliveries`} from MVA waiting to be received.{" "}
      <button type="button" onClick={onShow} className="font-semibold underline">Show {count === 1 ? "it" : "them"}</button>
    </Alert>
  );
};

// ---------------------------------------------------------------------
const SalesSummary = () => {
  const { data } = useFetch("/sales/summary");
  const { data: todaySales } = useFetch("/sales/sales", { from: today(), to: today() });
  const rows = todaySales || [];
  return (
    <KeyFigures
      items={[
        { label: "Local sales today", value: money(rows.reduce((s, r) => s + r.totalAmount, 0)) },
        { label: "Collected today", value: money(rows.reduce((s, r) => s + r.amountPaid, 0)) },
        { label: "Credit outstanding", value: money(data?.creditOutstanding), hint: `${data?.creditSales ?? 0} sale(s)`, tone: data?.creditOutstanding ? "warn" : undefined },
        { label: "Vehicles on the road", value: data?.openDispatches ?? 0 },
      ]}
    />
  );
};

const saleFields = [
  { name: "date", label: "Date", type: "date", required: true },
  { name: "reference", label: "Ref. number", help: "Receipt number or M-Pesa code" },
  {
    name: "items", label: "Quantities sold", type: "items", fixedRows: true,
    columns: [
      { name: "product", label: "Product", type: "display" },
      { name: "onHand", label: "In store", type: "display", width: 100 },
      { name: "quantity", label: "Quantity", type: "number", width: 120 },
      { name: "price", label: "Local price", type: "display", width: 120, render: (r) => money(r.unitPrice) },
      { name: "total", label: "Amount", type: "display", width: 130, render: (r) => money(blankToZero(r.quantity) * r.unitPrice) },
    ],
    total: (r) => blankToZero(r.quantity) * r.unitPrice,
    formatTotal: money,
  },
  { name: "paymentMethod", label: "Payment", type: "select", options: "paymentMethods", required: true },
  { name: "customerName", label: "Customer name", required: true, showIf: (v) => v.paymentMethod === "credit" },
  { name: "amountPaid", label: "Amount paid now (KES)", type: "number", help: "Leave blank if paid in full", showIf: (v) => v.paymentMethod !== "credit" },
  { name: "amountPaidCredit", label: "Deposit paid now (KES)", type: "number", showIf: (v) => v.paymentMethod === "credit" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const sales = {
  resource: "sales",
  endpoint: "/sales/sales",
  title: "Local sales",
  singular: "Sale",
  createLabel: "New sale",
  formSize: "lg",
  editFields: false,
  defaultQuery: { from: today(), to: today() },
  filters: [{ type: "search", placeholder: "Sale no., ref. or name" }, { name: "status", label: "Payment", options: "saleStatus" }, { type: "dateRange" }],
  columns: [
    { key: "saleNumber", label: "Sale" },
    { key: "date", label: "Date", type: "date" },
    { key: "reference", label: "Ref. number" },
    { key: "items", label: "Products", render: (r) => productLines(r.items) },
    { key: "paymentMethod", label: "Payment", type: "option:paymentMethods" },
    { key: "totalAmount", label: "Amount", type: "money" },
    { key: "amountPaid", label: "Paid", type: "money" },
    { key: "status", label: "Status", render: (r, ctx) => <span className="inline-flex items-center gap-2 whitespace-nowrap"><Badge value={r.status}>{ctx.label("saleStatus", r.status)}</Badge>{r.customerName}</span> },
  ],
  createFields: saleFields,
  // One line per product sold locally, at the local price.
  createInitial: async () => {
    const stock = await get("/stock/sales");
    return {
      date: today(),
      paymentMethod: "cash",
      items: stock.filter((p) => p.isActive && p.localPrice > 0).map((p) => ({ productId: p.productId, product: `${p.name} (${p.unit})`, onHand: number(p.onHand), unitPrice: p.localPrice, quantity: "" })),
    };
  },
  toPayload: (v) => ({
    date: v.date,
    reference: v.reference,
    paymentMethod: v.paymentMethod,
    customerName: v.paymentMethod === "credit" ? v.customerName : undefined,
    amountPaid: v.paymentMethod === "credit" ? v.amountPaidCredit || 0 : v.amountPaid === "" ? undefined : v.amountPaid,
    notes: v.notes,
    items: (v.items || []).filter((i) => Number(i.quantity) > 0).map((i) => ({ productId: i.productId, quantity: i.quantity })),
  }),
  actions: [{
    key: "pay", label: "Receive payment", allowed: (c) => c.can("sales", "write"), when: (r) => r.status !== "paid",
    path: (r) => `/sales/sales/${r.id}/payments`, title: (r) => `Payment for ${r.saleNumber} (balance ${money(r.totalAmount - r.amountPaid)})`,
    fields: [
      { name: "amount", label: "Amount (KES)", type: "number", required: true },
      { name: "paymentMethod", label: "Paid by", type: "select", options: "paymentMethods", optionFilter: (o) => o.value !== "credit", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "reference", label: "Reference (e.g. M-Pesa code)" },
    ],
    initial: (r) => ({ amount: r.totalAmount - r.amountPaid, paymentMethod: "mpesa", date: today() }),
  }],
  footer: (rows) => rows.length > 0 && (
    <div className="flex justify-end gap-6 border-t border-slate-100 px-4 py-3 text-sm">
      <span>Total: <strong>{money(rows.reduce((s, r) => s + r.totalAmount, 0))}</strong></span>
      <span>Paid: <strong>{money(rows.reduce((s, r) => s + r.amountPaid, 0))}</strong></span>
    </div>
  ),
};

// ---------------------------------------------------------------------
const vehicles = {
  resource: "vehicles",
  endpoint: "/sales/vehicles",
  title: "Vehicles and crew",
  description: "Each vehicle has a driver and a sales person who report back every evening.",
  singular: "Vehicle",
  createLabel: "Register vehicle",
  filters: [{ type: "search", placeholder: "Registration or crew" }, { name: "status", label: "Status", options: "vehicleStatus" }],
  columns: [
    { key: "registrationNumber", label: "Registration" },
    { key: "description", label: "Description" },
    { key: "driver", label: "Driver", render: (r) => `${r.driverName}${r.driverPhone ? ` (${r.driverPhone})` : ""}` },
    { key: "sales", label: "Sales person", render: (r) => `${r.salesPersonName}${r.salesPersonPhone ? ` (${r.salesPersonPhone})` : ""}` },
    { key: "status", label: "Status", type: "status:vehicleStatus" },
  ],
  createFields: [
    { name: "registrationNumber", label: "Registration number", required: true },
    { name: "description", label: "Description", placeholder: "e.g. Toyota Probox, white" },
    { name: "driverName", label: "Driver", required: true },
    { name: "driverPhone", label: "Driver phone", type: "tel" },
    { name: "salesPersonName", label: "Sales person", required: true },
    { name: "salesPersonPhone", label: "Sales person phone", type: "tel" },
    { name: "status", label: "Status", type: "select", options: "vehicleStatus" },
  ],
  createInitial: () => ({ status: "active" }),
};

const DispatchDetails = ({ row }) => (
  <table className="w-full max-w-3xl text-sm">
    <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Product</th><th className="text-right">Loaded</th><th className="text-right">Replaced</th><th className="text-right">Returned</th><th className="text-right">Damaged</th><th className="text-right">Sold</th><th className="text-right">Price</th><th className="text-right">Value sold</th></tr></thead>
    <tbody className="divide-y divide-slate-200">
      {row.items.map((i) => (
        <tr key={i.id}><td className="py-1.5">{i.product?.name}</td><td className="text-right">{number(i.quantityDispatched)}</td><td className="text-right">{number(i.quantityReplaced)}</td><td className="text-right">{number(i.quantityReturned)}</td><td className="text-right">{number(i.quantityDamaged)}</td><td className="text-right">{number(i.quantitySold)}</td><td className="text-right">{money(i.unitPrice)}</td><td className="text-right">{money(i.quantitySold * i.unitPrice)}</td></tr>
      ))}
    </tbody>
    {row.status === "reconciled" && (
      <tfoot className="font-medium"><tr><td className="pt-2" colSpan={8}>Cash {money(row.cashReturned)} + M-Pesa {money(row.mpesaReturned)} against {money(row.expectedAmount)} expected: {row.variance < 0 ? <Badge tone="red">Short {money(-row.variance)}</Badge> : row.variance > 0 ? <Badge tone="blue">Over {money(row.variance)}</Badge> : <Badge tone="green">Balanced</Badge>}</td></tr></tfoot>
    )}
  </table>
);

const soldOnTrip = (r) => r.loaded - blankToZero(r.quantityReturned) - blankToZero(r.quantityReplaced) - blankToZero(r.quantityDamaged);

/** What the crew owes, what they handed in, and any difference. */
const TripMoney = ({ row }) => (
  <>
    <span className="block">Expected {money(row.expectedAmount)}</span>
    {row.status === "reconciled" && <span className="block text-slate-500">Handed in {money(row.cashReturned + row.mpesaReturned)}</span>}
    {row.status === "reconciled" && row.variance !== 0 && <span className={`block font-medium ${row.variance < 0 ? "text-rose-700" : "text-sky-700"}`}>{row.variance < 0 ? "Short" : "Over"} {money(Math.abs(row.variance))}</span>}
  </>
);

const quantities = (items, field) => items.map((i) => `${i.product?.name} ${number(i[field])}`).join(", ");

const dispatches = {
  resource: "dispatches",
  endpoint: "/sales/dispatches",
  // Today's trips, plus any still on the road or closed today, whatever their date.
  params: { includeActive: "true" },
  title: "Vehicle trips",
  description: "Load the vehicle in the morning. Record returns, damages and replacements as they happen. In the evening press Reconcile: whatever was not returned, replaced or damaged counts as sold, and you enter the money handed in.",
  singular: "Dispatch",
  editFields: false,
  deletableWhen: (r) => r.status === "dispatched",
  defaultQuery: { from: today(), to: today() },
  filters: [{ name: "status", label: "Status", options: "dispatchStatus" }, { type: "dateRange" }],
  columns: [
    { key: "dispatchNumber", label: "Trip", className: "whitespace-nowrap", render: (r) => <><span className="block font-medium text-slate-900">{r.dispatchNumber}</span><span className="text-xs text-slate-500">{date(r.date)}</span></> },
    { key: "vehicle", label: "Vehicle", render: (r) => <><span className="block whitespace-nowrap font-medium text-slate-900">{r.vehicle?.registrationNumber}</span><span className="text-xs text-slate-500">{r.driverName} / {r.salesPersonName}</span></> },
    { key: "items", label: "Products", render: (r) => <><span className="block">Loaded: {quantities(r.items, "quantityDispatched")}</span>{r.status === "reconciled" && <span className="block text-slate-500">Sold: {quantities(r.items, "quantitySold")}</span>}</> },
    { key: "expectedAmount", label: "Money", align: "right", render: (r) => <TripMoney row={r} /> },
    { key: "status", label: "Status", type: "status:dispatchStatus" },
  ],
  expand: (row) => <DispatchDetails row={row} />,
  actions: [{
    key: "event", label: "Return / damage",
    allowed: (c) => c.can("damages", "write"), when: (r) => r.status === "dispatched",
    path: () => "/sales/damages", title: (r) => `Record on ${r.vehicle?.registrationNumber} (${r.dispatchNumber})`,
    intro: () => <p className="text-sm text-slate-600">A return goes back into store stock as soon as you save. A damage or replacement comes off what is on the vehicle.</p>,
    fields: (r) => [
      { name: "recordType", label: "What happened", type: "select", options: "damageTypes", optionFilter: (o) => o.value !== "office", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "productId", label: "Product", type: "select", required: true, options: r.items.map((i) => ({ value: i.productId, label: `${i.product?.name} (${number(leftOnVehicle(i))} on vehicle)` })) },
      { name: "quantity", label: "Quantity", type: "number", required: true },
      { name: "customerName", label: "Customer name (optional)", showIf: (v) => v.recordType === "replacement" },
      { name: "reason", label: "Reason", type: "textarea", required: true, showIf: (v) => v.recordType !== "vehicle_return" },
    ],
    initial: () => ({ date: today(), recordType: "vehicle_return" }),
    toPayload: (v, r) => ({ ...v, dispatchId: r.id }),
    submitLabel: "Save",
    success: (d) => `${d.recordNumber} saved`,
  }, {
    key: "reconcile", label: "Reconcile", variant: "primary",
    allowed: (c) => c.can("dispatches", "reconcile"), when: (r) => r.status === "dispatched",
    path: (r) => `/sales/dispatches/${r.id}/reconcile`, title: (r) => `Reconcile ${r.vehicle?.registrationNumber} (${r.driverName} / ${r.salesPersonName}), loaded ${date(r.date)}`,
    size: "lg",
    fields: [
      {
        name: "items", label: "What came back", type: "items", fixedRows: true,
        columns: [
          { name: "product", label: "Product", type: "display" },
          { name: "loaded", label: "Loaded", type: "display", width: 90 },
          { name: "quantityReturned", label: "Returned unsold", type: "number", width: 120 },
          { name: "quantityReplaced", label: "Replaced", type: "number", width: 110 },
          { name: "quantityDamaged", label: "Damaged", type: "number", width: 110 },
          { name: "sold", label: "Day sales", type: "display", width: 90, render: (r) => number(soldOnTrip(r)) },
          { name: "value", label: "Value sold", type: "display", width: 120, render: (r) => money(soldOnTrip(r) * r.unitPrice) },
        ],
        total: (r) => soldOnTrip(r) * r.unitPrice,
        formatTotal: (t) => `Expected: ${money(t)}`,
      },
      { name: "cashReturned", label: "Cash handed in (KES)", type: "number", required: true },
      { name: "mpesaReturned", label: "M-Pesa received (KES)", type: "number" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    intro: () => <p className="text-sm text-slate-600">Anything already recorded during the day is filled in. Add what is left. Whatever was not returned, replaced or damaged counts as sold.</p>,
    initial: (r) => ({ items: r.items.map((i) => ({ itemId: i.id, product: i.product?.name, loaded: i.quantityDispatched, unitPrice: i.unitPrice, quantityReturned: i.quantityReturned || "", quantityReplaced: i.quantityReplaced || "", quantityDamaged: i.quantityDamaged || "" })) }),
    toPayload: (v) => ({ cashReturned: v.cashReturned, mpesaReturned: v.mpesaReturned || 0, notes: v.notes, items: v.items.map((i) => ({ itemId: i.itemId, quantityReturned: blankToZero(i.quantityReturned), quantityReplaced: blankToZero(i.quantityReplaced), quantityDamaged: blankToZero(i.quantityDamaged) })) }),
    success: (d) => (d.variance < 0 ? `Reconciled. The crew is short by ${money(-d.variance)}.` : "Reconciled and returned stock added back"),
  }],
  toolbar: (ctx) => ctx.can("dispatches", "write") && (
    <ActionButton label="Load vehicle" icon={Truck} variant="primary" path="/sales/dispatches" modalSize="lg" onDone={(r) => ctx.notify(r?.message)}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "vehicleId", label: "Vehicle", type: "select", ref: refs.vehicles, required: true, onSelect: (v) => (v ? { driverName: v.driverName, salesPersonName: v.salesPersonName } : {}) },
        { name: "driverName", label: "Driver today", help: "Change if a different person is driving today" },
        { name: "salesPersonName", label: "Sales person today" },
        {
          name: "items", label: "Products loaded", type: "items", fixedRows: true,
          columns: [{ name: "product", label: "Product", type: "display" }, { name: "onHand", label: "In store", type: "display", width: 110 }, { name: "price", label: "Vehicle price", type: "display", width: 130 }, { name: "quantityDispatched", label: "Load", type: "number", width: 140 }],
        },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      initial={async () => {
        const stock = await get("/stock/sales");
        return { date: today(), items: stock.filter((p) => p.isActive && p.vehiclePrice > 0).map((p) => ({ productId: p.productId, product: `${p.name} (${p.unit})`, onHand: number(p.onHand), price: money(p.vehiclePrice), quantityDispatched: "" })) };
      }}
      toPayload={(v) => ({ ...v, items: v.items.filter((i) => i.quantityDispatched !== "" && Number(i.quantityDispatched) > 0).map((i) => ({ productId: i.productId, quantityDispatched: i.quantityDispatched })) })} />
  ),
};

const damages = {
  resource: "damages",
  endpoint: "/sales/damages",
  title: "Damages, replacements, returns and office use",
  description: "Stock changes the moment each one is saved. In the store it comes off store stock. On a vehicle it comes off the load, and a return goes back into the store.",
  singular: "Record",
  createLabel: "New record",
  editFields: false,
  deletable: false,
  created: (r) => `${r.recordNumber} saved and stock updated`,
  toPayload: (v) => (v.recordType === "office" ? { ...v, dispatchId: undefined } : v),
  filters: [{ name: "recordType", label: "Type", options: "damageTypes" }, { type: "dateRange" }],
  columns: [
    { key: "recordNumber", label: "Record" },
    { key: "date", label: "Date", type: "date" },
    { key: "recordType", label: "Type", type: "option:damageTypes" },
    { key: "where", label: "Where", render: (r) => r.dispatch?.vehicle?.registrationNumber || "Store" },
    { key: "product", label: "Product", render: (r) => r.product?.name },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "customerName", label: "Customer" },
    { key: "reason", label: "Reason" },
    { key: "value", label: "Value", render: (r) => (["damage", "replacement"].includes(r.recordType) ? money(r.value) : ""), align: "right" },
  ],
  createFields: [
    { name: "recordType", label: "Type", type: "select", options: "damageTypes", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "dispatchId", label: "Vehicle it came back from", type: "select", ref: refs.openTrips, required: true, showIf: (v) => v.recordType === "vehicle_return" },
    { name: "dispatchId", label: "Where it happened", type: "select", ref: refs.openTrips, placeholder: "In the store", showIf: (v) => ["damage", "replacement"].includes(v.recordType) },
    { name: "productId", label: "Product", type: "select", ref: refs.products, required: true },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "customerName", label: "Customer name (optional)", showIf: (v) => v.recordType === "replacement" },
    { name: "reason", label: "Reason", type: "textarea", required: true, showIf: (v) => v.recordType !== "vehicle_return" },
  ],
  createInitial: () => ({ date: today(), recordType: "damage" }),
};

const products = {
  resource: "products",
  endpoint: "/sales/products",
  title: "Products and prices",
  description: "Local sales and vehicles to towns have separate prices. Leave a price blank if the product is not sold that way; it will not appear on that form.",
  singular: "Product",
  createLabel: "Add product",
  labelRowButtons: true,
  deletableWhen: (r) => r.code !== "RAW_MILK",
  columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Product" },
    { key: "unit", label: "Unit" },
    { key: "localPrice", label: "Local price", align: "right", render: (r) => priceCell(r.localPrice) },
    { key: "vehiclePrice", label: "Vehicle price", align: "right", render: (r) => priceCell(r.vehiclePrice) },
    { key: "isActive", label: "On sale", type: "bool" },
  ],
  createFields: [
    { name: "code", label: "Code", required: true, help: "Short code, e.g. GHEE" },
    { name: "name", label: "Name", required: true },
    { name: "unit", label: "Unit", required: true, placeholder: "litres" },
    { name: "localPrice", label: "Local sales price (KES)", type: "number" },
    { name: "vehiclePrice", label: "Vehicle price (KES)", type: "number" },
  ],
  editFields: [
    { name: "name", label: "Name", required: true },
    { name: "unit", label: "Unit", required: true },
    { name: "localPrice", label: "Local sales price (KES)", type: "number" },
    { name: "vehiclePrice", label: "Vehicle price (KES)", type: "number" },
    { name: "isActive", label: "On sale", type: "checkbox", checkboxLabel: "Available for sale" },
  ],
  createInitial: () => ({ unit: "litres" }),
  toForm: (r) => ({ ...r, localPrice: r.localPrice || "", vehiclePrice: r.vehiclePrice || "" }),
};

const SalesPage = () => (
  <ModulePage
    sections={{
      sales: () => <ResourcePage config={sales} header={() => <SalesSummary />} />,
      "vehicles-out": () => <ResourcePage config={dispatches} />,
      received: () => <ResourcePage config={received} header={({ query, setQuery }) => query.status !== "sent" && <WaitingFromMva onShow={() => setQuery({ status: "sent" })} />} />,
      damages: () => <ResourcePage config={damages} />,
      stock: () => <StockPanel location="sales" />,
      vehicles: () => <ResourcePage config={vehicles} />,
      products: () => <ResourcePage config={products} />,
    }}
  />
);

export default SalesPage;
