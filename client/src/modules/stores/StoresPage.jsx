import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Badge } from "../../components/ui/ui";
import { number, today } from "../../lib/format";
import { refs } from "../../lib/refs";

// Stores keeps quantities only: no costs, suppliers, delivery notes or
// purchase orders. Departments ask for items by word of mouth, and what is
// handed to them is recorded as stock out.

const itemLine = (i) => (i ? `${i.code} - ${i.name}` : "");
const quantityOf = (r) => `${number(r.quantity)} ${r.item?.unit || ""}`;

const stockState = (r) => {
  if (r.quantityOnHand <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (r.quantityOnHand <= r.reorderLevel) return <Badge tone="amber">Reorder</Badge>;
  return null;
};

const items = {
  resource: "storeItems",
  endpoint: "/stores/items",
  title: "Store items",
  description: "Feeds, MVA tools, farm tools, fertilisers, transport and construction materials. Stock goes up with goods received and down with stock out.",
  singular: "Item",
  createLabel: "Add item",
  defaultQuery: { isActive: "true" },
  filters: [{ type: "search", placeholder: "Code or name" }, { name: "category", label: "Category", options: "storeCategories" }],
  columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Item" },
    { key: "category", label: "Category", type: "option:storeCategories" },
    { key: "quantityOnHand", label: "In stock", align: "right", render: (r) => (
      <span className="inline-flex items-center gap-2">{stockState(r)}{number(r.quantityOnHand)} {r.unit}</span>
    ) },
    { key: "reorderLevel", label: "Reorder at", type: "number" },
  ],
  createFields: [
    { name: "name", label: "Item name", required: true },
    { name: "category", label: "Category", type: "select", options: "storeCategories", required: true },
    { name: "unit", label: "Unit", required: true, placeholder: "bags, kg, pieces, litres" },
    { name: "code", label: "Code", help: "Leave blank to number automatically" },
    { name: "openingQuantity", label: "Opening quantity", type: "number", help: "What is in the store now" },
    { name: "openingDate", label: "Counted on", type: "date" },
    { name: "reorderLevel", label: "Reorder level", type: "number", help: "Flag the item when stock falls to this" },
  ],
  createInitial: () => ({ openingDate: today() }),
  editFields: [
    { name: "name", label: "Item name", required: true },
    { name: "category", label: "Category", type: "select", options: "storeCategories", required: true },
    { name: "unit", label: "Unit", required: true },
    { name: "reorderLevel", label: "Reorder level", type: "number" },
    { name: "isActive", label: "Active", type: "checkbox", checkboxLabel: "Item is in use" },
  ],
};

const receipts = {
  resource: "storeReceipts",
  endpoint: "/stores/receipts",
  title: "Goods received",
  description: "Everything brought into the store. Each delivery adds to the item's stock.",
  singular: "Delivery",
  createLabel: "Receive goods",
  editFields: false,
  deletable: false,
  filters: [{ name: "source", label: "Source", options: "receiptSources" }, { type: "dateRange" }],
  columns: [
    { key: "receiptNumber", label: "GRN" },
    { key: "date", label: "Date", type: "date" },
    { key: "item", label: "Item", render: (r) => itemLine(r.item) },
    { key: "quantity", label: "Quantity", render: quantityOf, align: "right" },
    { key: "source", label: "Source", type: "option:receiptSources" },
    { key: "notes", label: "Notes" },
  ],
  createFields: [
    { name: "itemId", label: "Item", type: "select", ref: refs.storeItems, required: true, span: 2 },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "source", label: "Source", type: "select", options: "receiptSources", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), source: "purchase" }),
};

const issues = {
  resource: "storeIssues",
  endpoint: "/stores/issues",
  title: "Stock out",
  description: "Items handed to departments when they ask. Each stock out takes from the item's stock.",
  singular: "Stock out",
  createLabel: "Record stock out",
  editFields: false,
  deletable: false,
  filters: [{ name: "department", label: "Department", options: "departments" }, { type: "dateRange" }],
  columns: [
    { key: "issueNumber", label: "No." },
    { key: "date", label: "Date", type: "date" },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "item", label: "Item", render: (r) => itemLine(r.item) },
    { key: "quantity", label: "Quantity", render: quantityOf, align: "right" },
    { key: "issuedTo", label: "Received by" },
    { key: "purpose", label: "Purpose" },
  ],
  createFields: [
    { name: "department", label: "Department", type: "select", options: "departments", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "itemId", label: "Item", type: "select", ref: refs.storeItems, required: true, span: 2 },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "issuedTo", label: "Received by (name)", required: true },
    { name: "purpose", label: "Purpose", type: "textarea" },
  ],
  createInitial: () => ({ date: today() }),
};

const StoresPage = () => (
  <ModulePage
    sections={{
      items: () => <ResourcePage config={items} />,
      receipts: () => <ResourcePage config={receipts} />,
      issues: () => <ResourcePage config={issues} />,
    }}
  />
);

export default StoresPage;
