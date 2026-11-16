import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Badge, Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { cx } from "../../lib/cx";
import { date, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { deliveries } from "./deliveries";
import { storeRequestsConfig } from "./storeRequests";

// Stores keeps quantities only: no costs, prices or item codes (items are
// known by name). Departments ask for items under Requests (or by word of
// mouth); what is handed to them is recorded as stock out. Goods received
// add to an item's stock and stock out takes from it. Accounts' purchase
// orders arrive under Deliveries as goods to expect.

const quantityOf = (r) => `${number(r.quantity)} ${r.item?.unit || ""}`;

const stockBadge = (row) => {
  const onHand = Number(row.quantityOnHand);
  if (onHand <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (onHand <= Number(row.reorderLevel)) return <Badge tone="amber">Reorder</Badge>;
  return null;
};

/** Picking an item shows its unit beside the quantity (the list itself shows names only). */
const itemField = { name: "itemId", label: "Item", type: "select", ref: refs.storeItems, required: true, span: 2, onSelect: (item) => ({ unit: item?.unit || "" }) };
const unitField = { name: "unit", label: "Unit", type: "display", span: "third", render: (v) => v || <span className="font-normal text-slate-400">Pick an item</span> };

/** An item's stock card: the opening count, then each delivery and stock out, with the balance after each. */
const StockCard = ({ row }) => {
  const { label } = useAuth();
  const { data, loading, error } = useFetch(`/stores/items/${row.id}/card`);
  if (loading) return <Spinner />;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  const lines = data?.lines || [];
  return (
    <div className="max-w-3xl text-sm">
      <p className="mb-2 font-medium text-slate-700">Stock card: {data?.name}</p>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1 pr-3">Date</th>
              <th className="pr-3">Entry</th>
              <th className="pr-3">Details</th>
              <th className="pr-3 text-right">In</th>
              <th className="pr-3 text-right">Out</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lines.map((line, index) => (
              <tr key={`${line.reference}-${index}`}>
                <td className="whitespace-nowrap py-1.5 pr-3">{date(line.date)}</td>
                <td className="whitespace-nowrap pr-3">
                  {line.kind === "opening" ? "Opening count" : line.kind === "received" ? `Received ${line.reference}` : `Stock out ${line.reference}`}
                </td>
                <td className="pr-3 text-slate-600">{line.kind === "out" ? [label("departments", line.department), line.detail].filter(Boolean).join(" · ") : line.detail}</td>
                <td className="pr-3 text-right tabular-nums">{line.quantity > 0 || line.kind === "opening" ? number(line.quantity) : ""}</td>
                <td className="pr-3 text-right tabular-nums">{line.quantity < 0 ? number(-line.quantity) : ""}</td>
                <td className={cx("text-right font-medium tabular-nums", line.balance <= 0 ? "text-rose-700" : "text-slate-900")}>{number(line.balance)} {data?.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const stock = {
  resource: "storeItems",
  endpoint: "/stores/stock",
  title: "Stock in the store",
  description: "What the store holds now. Goods received add to an item's stock and stock out takes from it. Open an item for its stock card.",
  singular: "Item",
  canCreate: () => false,
  canEdit: () => false,
  canDelete: () => false,
  editFields: false,
  filters: [
    { type: "search", placeholder: "Item name" },
    { name: "category", label: "Category", options: "storeCategories" },
    { name: "state", label: "Stock", options: "stockStates" },
  ],
  columns: [
    { key: "name", label: "Item" },
    { key: "category", label: "Category", type: "option:storeCategories" },
    { key: "quantityOnHand", label: "In stock", align: "right", render: (r) => (
      <span className="inline-flex items-center gap-2">{stockBadge(r)}<span className="font-medium text-slate-900">{number(r.quantityOnHand)} {r.unit}</span></span>
    ) },
    { key: "reorderLevel", label: "Reorder at", align: "right", render: (r) => (Number(r.reorderLevel) > 0 ? `${number(r.reorderLevel)} ${r.unit}` : "") },
  ],
  expand: (row) => <StockCard row={row} />,
  emptyText: "No items in the store",
  toolbar: () => (
    <Link to="/reports?department=stores&part=stock" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
      <Printer size={15} aria-hidden /> Stock remaining report
    </Link>
  ),
};

const items = {
  resource: "storeItems",
  endpoint: "/stores/items",
  title: "Store items",
  description: "The items the store keeps, by category. Add an item once, with what is in the store when you add it; after that its stock changes only with goods received and stock out.",
  singular: "Item",
  createLabel: "Add item",
  defaultQuery: { isActive: "true" },
  filters: [{ type: "search", placeholder: "Item name" }, { name: "category", label: "Category", options: "storeCategories" }],
  columns: [
    { key: "name", label: "Item" },
    { key: "category", label: "Category", type: "option:storeCategories" },
    { key: "unit", label: "Unit" },
    { key: "openingQuantity", label: "Opening count", align: "right", render: (r) => `${number(r.openingQuantity)} ${r.unit}` },
    { key: "openingDate", label: "Counted on", type: "date" },
    { key: "reorderLevel", label: "Reorder at", type: "number" },
  ],
  createFields: [
    { name: "name", label: "Item name", required: true },
    { name: "category", label: "Category", type: "select", options: "storeCategories", required: true },
    { name: "unit", label: "Unit", required: true, placeholder: "bags, kg, pieces, litres" },
    { name: "reorderLevel", label: "Reorder level", type: "number", help: "Flag the item when stock falls to this" },
    { name: "openingQuantity", label: "Opening quantity", type: "number", help: "What is in the store now" },
    { name: "openingDate", label: "Counted on", type: "date" },
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
    { key: "item", label: "Item", render: (r) => r.item?.name },
    { key: "quantity", label: "Quantity", render: quantityOf, align: "right" },
    { key: "source", label: "Source", type: "option:receiptSources" },
    { key: "notes", label: "Notes" },
  ],
  createFields: [
    itemField,
    { name: "quantity", label: "Quantity", type: "number", required: true, span: "third" },
    unitField,
    { name: "date", label: "Date", type: "date", required: true, span: "third" },
    { name: "source", label: "Source", type: "select", options: "receiptSources", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), source: "purchase" }),
};

const issues = {
  resource: "storeIssues",
  endpoint: "/stores/issues",
  title: "Stock out",
  description: "Items handed to departments. Dispatching a request records its stock out here; record one directly when a department asks by word of mouth. Each stock out takes from the item's stock.",
  singular: "Stock out",
  createLabel: "Record stock out",
  editFields: false,
  deletable: false,
  filters: [{ name: "department", label: "Department", options: "departments" }, { type: "dateRange" }],
  columns: [
    { key: "issueNumber", label: "No." },
    { key: "date", label: "Date", type: "date" },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "item", label: "Item", render: (r) => r.item?.name },
    { key: "quantity", label: "Quantity", render: quantityOf, align: "right" },
    { key: "issuedTo", label: "Received by" },
    { key: "request", label: "Request", render: (r) => r.request?.requestNumber || "" },
    { key: "purpose", label: "Purpose" },
  ],
  createFields: [
    { name: "department", label: "Department", type: "select", options: "departments", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    itemField,
    { name: "quantity", label: "Quantity", type: "number", required: true, span: "third" },
    unitField,
    { name: "issuedTo", label: "Received by (name)", required: true, span: "third" },
    { name: "purpose", label: "Purpose", type: "textarea" },
  ],
  createInitial: () => ({ date: today() }),
};

const StoresPage = () => {
  const auth = useAuth();
  return (
    <ModulePage
      sections={{
        stock: () => <ResourcePage config={stock} />,
        requests: () => <ResourcePage config={storeRequestsConfig(auth)} />,
        deliveries: () => <ResourcePage config={deliveries} />,
        receipts: () => <ResourcePage config={receipts} />,
        issues: () => <ResourcePage config={issues} />,
        items: () => <ResourcePage config={items} />,
      }}
    />
  );
};

export default StoresPage;
