import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Badge } from "../../components/ui/ui";
import { money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { purchaseOrdersConfig } from "../accounts/purchaseOrders";

const itemLine = (i) => (i ? `${i.code} - ${i.name}` : "");

const items = {
  resource: "storeItems",
  endpoint: "/stores/items",
  title: "Store items",
  description: "Feeds, MVA tools, farm tools, fertilisers, transport and construction materials. Quantities change through receipts and issues.",
  singular: "Item",
  createLabel: "Add item",
  defaultQuery: { isActive: "true" },
  filters: [{ type: "search", placeholder: "Code or name" }, { name: "category", label: "Category", options: "storeCategories" }],
  columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Item" },
    { key: "category", label: "Category", type: "option:storeCategories" },
    { key: "quantityOnHand", label: "On hand", render: (r) => (
      <span className="inline-flex items-center gap-2">{number(r.quantityOnHand)} {r.unit}{r.quantityOnHand <= r.reorderLevel && <Badge tone="amber">Reorder</Badge>}</span>
    ), align: "right" },
    { key: "reorderLevel", label: "Reorder at", type: "number" },
    { key: "unitCost", label: "Unit cost", type: "money" },
    { key: "value", label: "Value", render: (r) => money(r.quantityOnHand * r.unitCost), align: "right" },
  ],
  createFields: [
    { name: "name", label: "Item name", required: true },
    { name: "category", label: "Category", type: "select", options: "storeCategories", required: true },
    { name: "unit", label: "Unit", required: true, placeholder: "bags, kg, pieces, litres" },
    { name: "code", label: "Code", help: "Leave blank to number automatically" },
    { name: "quantityOnHand", label: "Opening quantity", type: "number" },
    { name: "reorderLevel", label: "Reorder level", type: "number" },
    { name: "unitCost", label: "Unit cost (KES)", type: "number" },
  ],
  editFields: [
    { name: "name", label: "Item name", required: true },
    { name: "category", label: "Category", type: "select", options: "storeCategories", required: true },
    { name: "unit", label: "Unit", required: true },
    { name: "reorderLevel", label: "Reorder level", type: "number" },
    { name: "unitCost", label: "Unit cost (KES)", type: "number" },
    { name: "isActive", label: "Active", type: "checkbox", checkboxLabel: "Item is in use" },
  ],
  footer: (rows) => rows.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-right text-sm">Stock value: <strong>{money(rows.reduce((s, r) => s + r.quantityOnHand * r.unitCost, 0))}</strong></div>,
};

const receipts = {
  resource: "storeReceipts",
  endpoint: "/stores/receipts",
  title: "Goods received",
  description: "Deliveries against purchase orders are received from the Purchase orders tab.",
  singular: "Receipt",
  createLabel: "Receive goods",
  editFields: false,
  deletable: false,
  filters: [{ name: "source", label: "Source", options: "receiptSources" }, { type: "dateRange" }],
  columns: [
    { key: "receiptNumber", label: "GRN" },
    { key: "date", label: "Date", type: "date" },
    { key: "item", label: "Item", render: (r) => itemLine(r.item) },
    { key: "quantity", label: "Quantity", render: (r) => `${number(r.quantity)} ${r.item?.unit || ""}`, align: "right" },
    { key: "source", label: "Source", type: "option:receiptSources" },
    { key: "supplier", label: "Supplier / PO", render: (r) => [r.supplier?.name, r.purchaseOrder?.poNumber].filter(Boolean).join(" - ") },
    { key: "deliveryNote", label: "Delivery note" },
  ],
  createFields: [
    { name: "itemId", label: "Item", type: "select", ref: refs.storeItems, required: true, span: 2 },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "source", label: "Source", type: "select", options: "receiptSources", required: true },
    { name: "supplierId", label: "Supplier", type: "select", ref: refs.suppliers, placeholder: "None", showIf: (v) => v.source === "purchase" },
    { name: "unitCost", label: "Unit cost (KES)", type: "number" },
    { name: "deliveryNote", label: "Delivery note no." },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), source: "purchase" }),
};

const issues = {
  resource: "storeIssues",
  endpoint: "/stores/issues",
  title: "Issued to departments",
  singular: "Issue",
  createLabel: "Issue items",
  editFields: false,
  deletable: false,
  filters: [{ name: "department", label: "Department", options: "departments" }, { type: "dateRange" }],
  columns: [
    { key: "issueNumber", label: "Issue" },
    { key: "date", label: "Date", type: "date" },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "item", label: "Item", render: (r) => itemLine(r.item) },
    { key: "quantity", label: "Quantity", render: (r) => `${number(r.quantity)} ${r.item?.unit || ""}`, align: "right" },
    { key: "issuedTo", label: "Received by" },
    { key: "requisition", label: "Requisition", render: (r) => r.requisition?.requisitionNumber || "" },
    { key: "purpose", label: "Purpose" },
  ],
  createFields: [
    { name: "department", label: "Department", type: "select", options: "departments", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "itemId", label: "Item", type: "select", ref: refs.storeItems, required: true, span: 2 },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "issuedTo", label: "Received by (name)", required: true },
    { name: "requisitionId", label: "Approved requisition", type: "select", ref: refs.approvedRequisitions, placeholder: "None" },
    { name: "markRequisitionFulfilled", label: "Fulfilled", type: "checkbox", checkboxLabel: "This completes the requisition", showIf: (v) => v.requisitionId },
    { name: "purpose", label: "Purpose", type: "textarea" },
  ],
  createInitial: () => ({ date: today() }),
  toPayload: (v) => ({ ...v, markRequisitionFulfilled: Boolean(v.markRequisitionFulfilled) }),
};

const StoresPage = () => (
  <ModulePage
    sections={{
      items: () => <ResourcePage config={items} />,
      issues: () => <ResourcePage config={issues} />,
      receipts: () => <ResourcePage config={receipts} />,
      orders: () => <ResourcePage config={purchaseOrdersConfig} />,
    }}
  />
);

export default StoresPage;
