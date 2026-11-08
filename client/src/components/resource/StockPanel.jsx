import { SlidersHorizontal } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { daysAgo, money, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { ActionButton } from "./ActionButton";
import { ResourcePage } from "./ResourcePage";
import { Alert, Card, Spinner } from "../ui/ui";
import { KeyFigures } from "../ui/KeyFigures";

const MOVEMENT_LABELS = {
  livestock_transfer: "From Livestock",
  farmer_delivery: "Farmer delivery",
  farmer_delivery_reversal: "Farmer delivery deleted",
  processing_input: "Used in processing",
  processing_output: "Made in processing",
  transfer_to_sales: "Sent to Sales",
  transfer_cancelled: "Transfer cancelled",
  received_from_mva: "Received from MVA",
  local_sale: "Local sale",
  sale_reversal: "Sale deleted",
  vehicle_dispatch: "Loaded on vehicle",
  vehicle_return: "Returned by vehicle",
  dispatch_cancelled: "Dispatch cancelled",
  damage: "Damage / write-off",
  replacement: "Customer replacement",
  adjustment: "Stock count adjustment",
};

/** Stock on hand at MVA or Sales, with adjustments (heads) and history. */
export const StockPanel = ({ location }) => {
  const { can } = useAuth();
  const resource = location === "mva" ? "mvaStock" : "salesStock";
  const { data, loading, error, reload } = useFetch(`/stock/${location}`);

  const movements = {
    resource,
    endpoint: `/stock/${location}/movements`,
    title: "Stock movements",
    deletable: false,
    editFields: false,
    canCreate: () => false,
    defaultQuery: { from: daysAgo(7), to: today() },
    filters: [{ type: "dateRange" }],
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "product", label: "Product", render: (r) => r.product?.name },
      { key: "movementType", label: "Movement", render: (r) => MOVEMENT_LABELS[r.movementType] || r.movementType },
      { key: "quantity", label: "Quantity", render: (r) => <span className={r.quantity < 0 ? "text-rose-700" : "text-emerald-700"}>{r.quantity > 0 ? "+" : ""}{number(r.quantity)}</span>, align: "right" },
      { key: "notes", label: "Reference" },
    ],
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Stock on hand at {location === "mva" ? "MVA" : "Sales"}</h2>
          {can(resource, "adjust") && (
            <ActionButton label="Adjust after count" icon={SlidersHorizontal} path={`/stock/${location}/adjustments`} onDone={reload}
              intro={<Alert tone="warning">Use this only to correct stock after a physical count. Enter a negative number to reduce stock.</Alert>}
              fields={[
                { name: "productId", label: "Product", type: "select", ref: refs.products, required: true, span: 2 },
                { name: "quantity", label: "Quantity to add (+) or remove (-)", type: "number", min: -1000000, required: true },
                { name: "date", label: "Date", type: "date", required: true },
                { name: "reason", label: "Reason", type: "textarea", required: true },
              ]}
              initial={{ date: today() }} />
          )}
        </div>
        <Alert tone="error">{error}</Alert>
        {loading && !data ? <Spinner /> : (
          <KeyFigures
            items={(data || []).map((p) => ({
              label: p.name,
              value: `${number(p.onHand)} ${p.unit}`,
              hint: location === "sales" ? `${money(p.unitPrice)} each` : undefined,
              tone: p.onHand < 0 ? "bad" : undefined,
            }))}
          />
        )}
      </Card>
      <ResourcePage config={movements} />
    </div>
  );
};
