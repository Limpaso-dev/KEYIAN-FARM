import { Truck } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { StockPanel } from "../../components/resource/StockPanel";
import { Badge, Card } from "../../components/ui/ui";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { get } from "../../lib/api";
import { money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { productLines, productTransfers } from "../mva/productTransfers";

const blankToZero = (value) => (value === "" || value == null ? 0 : Number(value));

const received = {
  ...productTransfers,
  title: "Products received from MVA",
  description: "Confirm deliveries from MVA. Stock is added to Sales only when you receive it.",
  defaultQuery: { status: "sent" },
  toolbar: undefined,
  deletable: false,
};

// ---------------------------------------------------------------------
const SalesSummary = () => {
  const { data } = useFetch("/sales/summary");
  const { data: todaySales } = useFetch("/sales/sales", { from: today(), to: today() });
  const rows = todaySales || [];
  return (
    <Card className="overflow-hidden">
      <KeyFigures
        bare
        items={[
          { label: "Local sales today", value: money(rows.reduce((s, r) => s + r.totalAmount, 0)) },
          { label: "Collected today", value: money(rows.reduce((s, r) => s + r.amountPaid, 0)) },
          { label: "Credit outstanding", value: money(data?.creditOutstanding), hint: `${data?.creditSales ?? 0} sale(s)`, tone: data?.creditOutstanding ? "warn" : undefined },
          { label: "Vehicles on the road", value: data?.openDispatches ?? 0 },
        ]}
      />
    </Card>
  );
};

const saleFields = [
  { name: "date", label: "Date", type: "date", required: true },
  { name: "paymentMethod", label: "Payment", type: "select", options: "paymentMethods", required: true },
  { name: "customerId", label: "Registered customer", type: "select", ref: refs.customers, placeholder: "Walk-in customer" },
  { name: "customerName", label: "Or customer name", showIf: (v) => !v.customerId },
  {
    name: "items", label: "Products", type: "items", addLabel: "Add product",
    columns: [
      { name: "productId", label: "Product", type: "select", ref: refs.products, required: true, onSelect: (p) => ({ unitPrice: p.unitPrice }) },
      { name: "quantity", label: "Quantity", type: "number", required: true, width: 110 },
      { name: "unitPrice", label: "Price", type: "number", width: 120 },
      { name: "total", label: "Total", type: "display", width: 120, render: (r) => money(blankToZero(r.quantity) * blankToZero(r.unitPrice)) },
    ],
    total: (r) => blankToZero(r.quantity) * blankToZero(r.unitPrice),
    formatTotal: money,
  },
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
  filters: [{ type: "search", placeholder: "Sale no. or customer" }, { name: "status", label: "Payment", options: "saleStatus" }, { type: "dateRange" }],
  columns: [
    { key: "saleNumber", label: "Sale" },
    { key: "date", label: "Date", type: "date" },
    { key: "customer", label: "Customer", render: (r) => r.customer?.name || r.customerName || "Walk-in" },
    { key: "items", label: "Products", render: (r) => productLines(r.items) },
    { key: "paymentMethod", label: "Payment", type: "option:paymentMethods" },
    { key: "totalAmount", label: "Total", type: "money" },
    { key: "amountPaid", label: "Paid", type: "money" },
    { key: "status", label: "Status", type: "status:saleStatus" },
  ],
  createFields: saleFields,
  createInitial: () => ({ date: today(), paymentMethod: "cash", items: [{ productId: "", quantity: "", unitPrice: "" }] }),
  toPayload: (v) => ({
    date: v.date,
    paymentMethod: v.paymentMethod,
    customerId: v.customerId || undefined,
    customerName: v.customerId ? undefined : v.customerName,
    amountPaid: v.paymentMethod === "credit" ? v.amountPaidCredit || 0 : v.amountPaid === "" ? undefined : v.amountPaid,
    notes: v.notes,
    items: (v.items || []).filter((i) => i.productId).map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice === "" ? undefined : i.unitPrice })),
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
    <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Product</th><th className="text-right">Loaded</th><th className="text-right">Returned</th><th className="text-right">Damaged</th><th className="text-right">Sold</th><th className="text-right">Price</th><th className="text-right">Value sold</th></tr></thead>
    <tbody className="divide-y divide-slate-200">
      {row.items.map((i) => (
        <tr key={i.id}><td className="py-1.5">{i.product?.name}</td><td className="text-right">{number(i.quantityDispatched)}</td><td className="text-right">{number(i.quantityReturned)}</td><td className="text-right">{number(i.quantityDamaged)}</td><td className="text-right">{number(i.quantitySold)}</td><td className="text-right">{money(i.unitPrice)}</td><td className="text-right">{money(i.quantitySold * i.unitPrice)}</td></tr>
      ))}
    </tbody>
    {row.status === "reconciled" && (
      <tfoot className="font-medium"><tr><td className="pt-2" colSpan={7}>Cash {money(row.cashReturned)} + M-Pesa {money(row.mpesaReturned)} against {money(row.expectedAmount)} expected: {row.variance < 0 ? <Badge tone="red">Short {money(-row.variance)}</Badge> : row.variance > 0 ? <Badge tone="blue">Over {money(row.variance)}</Badge> : <Badge tone="green">Balanced</Badge>}</td></tr></tfoot>
    )}
  </table>
);

const dispatches = {
  resource: "dispatches",
  endpoint: "/sales/dispatches",
  title: "Vehicle dispatch and evening returns",
  description: "Load vehicles in the morning; in the evening record what came back, what was damaged and the money handed in.",
  singular: "Dispatch",
  editFields: false,
  deletableWhen: (r) => r.status === "dispatched",
  defaultQuery: { from: today(), to: today() },
  filters: [{ name: "status", label: "Status", options: "dispatchStatus" }, { type: "dateRange" }],
  columns: [
    { key: "dispatchNumber", label: "Dispatch" },
    { key: "date", label: "Date", type: "date" },
    { key: "vehicle", label: "Vehicle", render: (r) => r.vehicle?.registrationNumber },
    { key: "crew", label: "Crew", render: (r) => `${r.driverName} / ${r.salesPersonName}` },
    { key: "items", label: "Loaded", render: (r) => r.items.map((i) => `${i.product?.name} ${number(i.quantityDispatched)}`).join(", ") },
    { key: "expectedAmount", label: "Expected", type: "money" },
    { key: "handedIn", label: "Handed in", render: (r) => (r.status === "reconciled" ? money(r.cashReturned + r.mpesaReturned) : ""), align: "right" },
    { key: "variance", label: "Variance", render: (r) => (r.status === "reconciled" ? <span className={r.variance < 0 ? "font-medium text-rose-700" : ""}>{money(r.variance)}</span> : ""), align: "right" },
    { key: "status", label: "Status", type: "status:dispatchStatus" },
  ],
  expand: (row) => <DispatchDetails row={row} />,
  actions: [{
    key: "reconcile", label: "Evening return", variant: "primary",
    allowed: (c) => c.can("dispatches", "reconcile"), when: (r) => r.status === "dispatched",
    path: (r) => `/sales/dispatches/${r.id}/reconcile`, title: (r) => `Evening return - ${r.vehicle?.registrationNumber} (${r.driverName} / ${r.salesPersonName})`,
    size: "lg",
    fields: [
      {
        name: "items", label: "What came back", type: "items", fixedRows: true,
        columns: [
          { name: "product", label: "Product", type: "display" },
          { name: "loaded", label: "Loaded", type: "display", width: 90 },
          { name: "quantityReturned", label: "Returned unsold", type: "number", width: 130 },
          { name: "quantityDamaged", label: "Damaged", type: "number", width: 110 },
          { name: "sold", label: "Sold", type: "display", width: 90, render: (r) => number(r.loaded - blankToZero(r.quantityReturned) - blankToZero(r.quantityDamaged)) },
          { name: "value", label: "Value sold", type: "display", width: 120, render: (r) => money((r.loaded - blankToZero(r.quantityReturned) - blankToZero(r.quantityDamaged)) * r.unitPrice) },
        ],
        total: (r) => (r.loaded - blankToZero(r.quantityReturned) - blankToZero(r.quantityDamaged)) * r.unitPrice,
        formatTotal: (t) => `Expected: ${money(t)}`,
      },
      { name: "cashReturned", label: "Cash handed in (KES)", type: "number", required: true },
      { name: "mpesaReturned", label: "M-Pesa received (KES)", type: "number" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    initial: (r) => ({ items: r.items.map((i) => ({ itemId: i.id, product: i.product?.name, loaded: i.quantityDispatched, unitPrice: i.unitPrice, quantityReturned: "", quantityDamaged: "" })) }),
    toPayload: (v) => ({ cashReturned: v.cashReturned, mpesaReturned: v.mpesaReturned || 0, notes: v.notes, items: v.items.map((i) => ({ itemId: i.itemId, quantityReturned: blankToZero(i.quantityReturned), quantityDamaged: blankToZero(i.quantityDamaged) })) }),
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
          columns: [{ name: "product", label: "Product", type: "display" }, { name: "onHand", label: "In store", type: "display", width: 110 }, { name: "quantityDispatched", label: "Load", type: "number", width: 140 }],
        },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      initial={async () => {
        const stock = await get("/stock/sales");
        return { date: today(), items: stock.map((p) => ({ productId: p.productId, product: `${p.name} (${p.unit})`, onHand: number(p.onHand), quantityDispatched: "" })) };
      }}
      toPayload={(v) => ({ ...v, items: v.items.filter((i) => i.quantityDispatched !== "" && Number(i.quantityDispatched) > 0).map((i) => ({ productId: i.productId, quantityDispatched: i.quantityDispatched })) })} />
  ),
};

const damages = {
  resource: "damages",
  endpoint: "/sales/damages",
  title: "Damages and customer replacements",
  description: "Damaged stock is written off; replacements are products given to a customer in place of spoilt ones. Both reduce Sales stock.",
  singular: "Record",
  createLabel: "Record damage / replacement",
  editFields: false,
  deletable: false,
  filters: [{ name: "recordType", label: "Type", options: "damageTypes" }, { type: "dateRange" }],
  columns: [
    { key: "recordNumber", label: "Record" },
    { key: "date", label: "Date", type: "date" },
    { key: "recordType", label: "Type", type: "option:damageTypes" },
    { key: "product", label: "Product", render: (r) => r.product?.name },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "customer", label: "Customer", render: (r) => r.customer?.name || r.customerName || "" },
    { key: "reason", label: "Reason" },
    { key: "value", label: "Value", type: "money" },
  ],
  createFields: [
    { name: "recordType", label: "Type", type: "select", options: "damageTypes", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "productId", label: "Product", type: "select", ref: refs.products, required: true },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "customerId", label: "Customer", type: "select", ref: refs.customers, placeholder: "Not registered", showIf: (v) => v.recordType === "replacement" },
    { name: "customerName", label: "Or customer name", showIf: (v) => v.recordType === "replacement" && !v.customerId },
    { name: "reason", label: "Reason", type: "textarea", required: true },
  ],
  createInitial: () => ({ date: today(), recordType: "damage" }),
};

const customers = {
  resource: "customers",
  endpoint: "/sales/customers",
  title: "Customers",
  singular: "Customer",
  createLabel: "Add customer",
  filters: [{ type: "search", placeholder: "Name, phone, location" }, { name: "customerType", label: "Type", options: "customerTypes" }],
  columns: [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "customerType", label: "Type", type: "option:customerTypes" },
    { key: "location", label: "Location" },
  ],
  createFields: [
    { name: "name", label: "Name", required: true },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "customerType", label: "Type", type: "select", options: "customerTypes" },
    { name: "location", label: "Location" },
  ],
  createInitial: () => ({ customerType: "individual" }),
};

const products = {
  resource: "products",
  endpoint: "/sales/products",
  title: "Products and prices",
  description: "One selling price per product, used for local sales and vehicles.",
  singular: "Product",
  createLabel: "Add product",
  deletable: false,
  columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Product" },
    { key: "unit", label: "Unit" },
    { key: "unitPrice", label: "Price", type: "money" },
    { key: "isActive", label: "On sale", type: "bool" },
  ],
  createFields: [
    { name: "code", label: "Code", required: true, help: "Short code, e.g. GHEE" },
    { name: "name", label: "Name", required: true },
    { name: "unit", label: "Unit", required: true, placeholder: "litres" },
    { name: "unitPrice", label: "Price (KES)", type: "number", required: true },
  ],
  editFields: [
    { name: "name", label: "Name", required: true },
    { name: "unit", label: "Unit", required: true },
    { name: "unitPrice", label: "Price (KES)", type: "number", required: true },
    { name: "isActive", label: "On sale", type: "checkbox", checkboxLabel: "Available for sale" },
  ],
  createInitial: () => ({ unit: "litres" }),
};

const SalesPage = () => (
  <ModulePage
    title="Sales"
    description="Stock received from MVA, local sales, vehicles to town, evening returns, damages and replacements."
    actions={null}
    tabs={[
      { key: "sales", label: "Local sales", show: (c) => c.can("sales"), render: () => <ResourcePage config={sales} header={() => <SalesSummary />} /> },
      { key: "vehicles-out", label: "Vehicle dispatch", show: (c) => c.can("dispatches"), render: () => <ResourcePage config={dispatches} /> },
      { key: "received", label: "From MVA", show: (c) => c.can("productTransfers", "receive"), render: () => <ResourcePage config={received} /> },
      { key: "damages", label: "Damages & replacements", show: (c) => c.can("damages"), render: () => <ResourcePage config={damages} /> },
      { key: "stock", label: "Stock", show: (c) => c.can("salesStock"), render: () => <StockPanel location="sales" /> },
      { key: "vehicles", label: "Vehicles", show: (c) => c.can("vehicles"), render: () => <ResourcePage config={vehicles} /> },
      { key: "customers", label: "Customers", show: (c) => c.can("customers"), render: () => <ResourcePage config={customers} /> },
      { key: "products", label: "Prices", show: (c) => c.can("products"), render: () => <ResourcePage config={products} /> },
    ]}
  />
);

export default SalesPage;
