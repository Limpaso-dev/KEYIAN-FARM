import { Send } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { get } from "../../lib/api";
import { date, number, today } from "../../lib/format";

export const productLines = (items) => (items || []).map((i) => `${i.product?.name} ${number(i.quantity)}`).join(", ");

// Shared by MVA (send) and Sales (receive).
export const productTransfers = {
  resource: "productTransfers",
  endpoint: "/mva/product-transfers",
  title: "Products sent to Sales",
  description: "Raw milk can go straight to Sales without processing. Sales confirms receipt before it counts in Sales stock.",
  singular: "Transfer",
  editFields: false,
  deletableWhen: (r) => r.status === "sent",
  filters: [{ name: "status", label: "Status", options: "transferStatus" }, { type: "dateRange" }],
  columns: [
    { key: "transferNumber", label: "Transfer" },
    { key: "date", label: "Date", type: "date" },
    { key: "items", label: "Products", render: (r) => productLines(r.items) },
    { key: "status", label: "Status", type: "status:transferStatus" },
    { key: "receivedAt", label: "Received", render: (r) => (r.receivedAt ? date(r.receivedAt) : "") },
    { key: "notes", label: "Notes" },
  ],
  actions: [{
    key: "receive", label: "Receive", variant: "primary",
    allowed: (c) => c.can("productTransfers", "receive"), when: (r) => r.status === "sent",
    path: (r) => `/mva/product-transfers/${r.id}/receive`, title: (r) => `Receive ${r.transferNumber}`,
    intro: (r) => <p className="text-sm text-slate-600">Confirm you received: {productLines(r.items)}</p>,
    fields: [{ name: "notes", label: "Notes", type: "textarea" }],
    success: () => "Products added to Sales stock",
  }],
  toolbar: (ctx) => ctx.can("productTransfers", "write") && (
    <ActionButton label="Send to Sales" icon={Send} variant="primary" path="/mva/product-transfers" onDone={(r) => ctx.notify(r?.message)}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        {
          name: "items", label: "Quantities to send", type: "items", fixedRows: true,
          columns: [{ name: "product", label: "Product", type: "display" }, { name: "onHand", label: "At MVA", type: "display", width: 110 }, { name: "quantity", label: "Send", type: "number", width: 140 }],
        },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      initial={async () => {
        const stock = await get("/stock/mva");
        return { date: today(), items: stock.map((p) => ({ productId: p.productId, product: `${p.name} (${p.unit})`, onHand: number(p.onHand), quantity: "" })) };
      }}
      toPayload={(v) => ({ ...v, items: v.items.filter((i) => i.quantity !== "" && Number(i.quantity) > 0).map((i) => ({ productId: i.productId, quantity: i.quantity })) })} />
  ),
};
