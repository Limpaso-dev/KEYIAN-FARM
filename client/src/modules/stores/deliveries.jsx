import { PackageCheck } from "lucide-react";
import { Badge } from "../../components/ui/ui";
import { dateTime, number, today } from "../../lib/format";
import { DeliveryLines } from "./DeliveryLines";
import { deliveryLines, stillExpected } from "./deliveryItems";

// Deliveries: each purchase order Accounts raises is goods the store should
// expect. Stores records what arrives - all of it, or part and then the
// rest. Store items come into stock as goods received, and Accounts is told.
// Quantities only: Stores does not see prices.

const WAITING = ["ordered", "partially_received"];
const STATUS = { ordered: "Expected", partially_received: "Partly delivered", received: "Delivered" };

export const deliveries = {
  resource: "storeReceipts",
  endpoint: "/stores/deliveries",
  title: "Deliveries",
  description: "Goods ordered by Accounts (purchase orders) that the store should expect. Record what arrives: store items come into stock as goods received, and Accounts is told.",
  singular: "Delivery",
  canCreate: () => false,
  createFields: null,
  editFields: false,
  deletable: false,
  defaultQuery: { status: "waiting" },
  filters: [{ name: "status", label: "Status", options: "deliveryStatus" }, { type: "dateRange" }],
  columns: [
    { key: "poNumber", label: "Order" },
    { key: "date", label: "Ordered", type: "date" },
    { key: "supplier", label: "From", render: (r) => r.supplier?.name },
    { key: "items", label: "Items", render: deliveryLines },
    {
      key: "status", label: "Status",
      render: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Badge value={r.status}>{STATUS[r.status] || r.status}</Badge>
          {r.deliveredAt && <span className="text-xs text-slate-500">{dateTime(r.deliveredAt)}</span>}
        </span>
      ),
    },
  ],
  expand: (row) => <DeliveryLines row={row} />,
  actions: [{
    key: "receive", label: "Record delivery", icon: PackageCheck, variant: "primary",
    allowed: (c) => c.can("storeReceipts", "write"),
    when: (r) => WAITING.includes(r.status),
    path: (r) => `/stores/deliveries/${r.id}/receive`,
    title: (r) => `Delivery for ${r.poNumber} from ${r.supplier?.name}`,
    intro: () => <p className="text-sm text-slate-600">Enter how much of each line arrived; the rest stays expected. Store items come into stock as goods received, and Accounts is told.</p>,
    size: "lg",
    fields: [
      { name: "date", label: "Date received", type: "date", required: true },
      { name: "deliveryNote", label: "Note", placeholder: "e.g. Delivery note 4471; 10 bags to follow" },
      {
        name: "items", label: "What arrived", type: "items", fixedRows: true,
        columns: [
          { name: "item", label: "Item", type: "display" },
          { name: "ordered", label: "Ordered", type: "display", width: 90 },
          { name: "received", label: "Received before", type: "display", width: 120 },
          { name: "quantity", label: "Arrived now", type: "number", width: 130 },
        ],
      },
    ],
    initial: (r) => ({
      date: today(),
      items: r.items.map((i) => ({
        itemId: i.id,
        item: i.storeItem ? `${i.storeItem.name} (${i.storeItem.unit})` : `${i.description} (not a store item)`,
        ordered: number(i.quantity),
        received: number(i.quantityReceived),
        quantity: stillExpected(i),
      })),
    }),
    toPayload: (v) => ({ date: v.date, deliveryNote: v.deliveryNote, items: v.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity === "" ? 0 : i.quantity })) }),
    submitLabel: "Record delivery",
    success: (r) => (r.status === "received" ? `${r.poNumber} delivered in full. Accounts has been told.` : `Part of ${r.poNumber} recorded; the rest is still expected. Accounts has been told.`),
  }],
};
