import { money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";

const blank = (v) => (v === "" || v == null ? 0 : Number(v));

// Accounts raises and pays purchase orders. Stores does not use them, so
// deliveries are no longer received against an order.
export const purchaseOrdersConfig = {
  resource: "purchaseOrders",
  endpoint: "/accounts/purchase-orders",
  title: "Purchase orders (LPOs)",
  description: "Accounts raises orders and pays the supplier.",
  singular: "Purchase order",
  createLabel: "New purchase order",
  formSize: "lg",
  editFields: false,
  deletable: false,
  filters: [{ type: "search", placeholder: "LPO number" }, { name: "status", label: "Status", options: "purchaseOrderStatus" }, { type: "dateRange" }],
  columns: [
    { key: "poNumber", label: "LPO" },
    { key: "date", label: "Date", type: "date" },
    { key: "supplier", label: "Supplier", render: (r) => r.supplier?.name },
    { key: "requisition", label: "Requisition", render: (r) => (r.requisition ? `${r.requisition.requisitionNumber} (${r.requisition.department})` : "") },
    { key: "totalAmount", label: "Total", type: "money" },
    { key: "amountPaid", label: "Paid", type: "money" },
    { key: "status", label: "Status", type: "status:purchaseOrderStatus" },
  ],
  expand: (row) => (
    <table className="w-full max-w-3xl text-sm">
      <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Item</th><th className="text-right">Ordered</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
      <tbody className="divide-y divide-slate-200">
        {row.items.map((i) => <tr key={i.id}><td className="py-1.5">{i.description}{i.storeItem ? ` (${i.storeItem.code})` : ""}</td><td className="text-right">{number(i.quantity)}</td><td className="text-right">{money(i.unitPrice)}</td><td className="text-right">{money(i.total)}</td></tr>)}
      </tbody>
    </table>
  ),
  createFields: [
    { name: "supplierId", label: "Supplier", type: "select", ref: refs.suppliers, required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "requisitionId", label: "Approved requisition", type: "select", ref: refs.approvedRequisitions, placeholder: "None", span: 2 },
    {
      name: "items", label: "Order lines", type: "items", addLabel: "Add line",
      columns: [
        { name: "storeItemId", label: "Store item (optional)", type: "select", ref: refs.storeItems, placeholder: "Not a store item", onSelect: (i, row) => (i ? { description: row.description || i.name, unitPrice: row.unitPrice || i.unitCost || "" } : {}) },
        { name: "description", label: "Description", required: true },
        { name: "quantity", label: "Qty", type: "number", required: true, width: 90 },
        { name: "unitPrice", label: "Unit price", type: "number", required: true, width: 120 },
        { name: "total", label: "Total", type: "display", width: 120, render: (r) => money(blank(r.quantity) * blank(r.unitPrice)) },
      ],
      total: (r) => blank(r.quantity) * blank(r.unitPrice),
      formatTotal: money,
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), items: [{ storeItemId: "", description: "", quantity: "", unitPrice: "" }] }),
  toPayload: (v) => ({ ...v, requisitionId: v.requisitionId || undefined, items: v.items.map((i) => ({ ...i, storeItemId: i.storeItemId || undefined })) }),
  actions: [
    {
      key: "pay", label: "Pay supplier",
      allowed: (c) => c.can("purchaseOrders", "pay"), when: (r) => r.status !== "cancelled" && r.amountPaid < r.totalAmount,
      path: (r) => `/accounts/purchase-orders/${r.id}/pay`, title: (r) => `Pay ${r.supplier?.name} for ${r.poNumber}`,
      fields: [
        { name: "amount", label: "Amount (KES)", type: "number", required: true },
        { name: "accountId", label: "Pay from", type: "select", ref: refs.moneyAccounts, required: true },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "category", label: "Expense category", type: "select", options: "expenseCategories" },
      ],
      initial: (r) => ({ amount: r.totalAmount - r.amountPaid, date: today(), category: "purchases" }),
      success: () => "Payment recorded as an expense",
    },
    {
      key: "cancel", label: "Cancel", variant: "ghost",
      allowed: (c) => c.can("purchaseOrders", "write"), when: (r) => r.status === "ordered" && !r.amountPaid,
      path: (r) => `/accounts/purchase-orders/${r.id}/cancel`, confirm: (r) => `Cancel ${r.poNumber}? This cannot be undone.`, submitLabel: "Cancel order",
    },
  ],
};
