import { SlidersHorizontal } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { daysAgo, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";
import { ActionButton } from "./ActionButton";
import { ResourcePage } from "./ResourcePage";
import { Alert, Spinner } from "../ui/ui";
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
  office: "Office use",
  allocation: "Allocated",
  processing_reversal: "Output deleted",
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
    <div className="space-y-5">
      {/* Stock on hand: a ruled strip of figures on the page, no box. */}
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Stock on hand at {location === "mva" ? "MVA" : "Sales"}</h2>
          {can(resource, "adjust") && (
            <ActionButton label="Adjust after count" icon={SlidersHorizontal} path={`/stock/${location}/adjustments`} onDone={reload}
              intro={<Alert tone="warning">Use this only to correct stock after a physical count. Enter a negative number to reduce stock.</Alert>}
              fields={[
                { name: "productId", label: "Product", type: "select", ref: refs.allProducts, required: true, span: 2 },
                { name: "quantity", label: "Quantity to add (+) or remove (-)", type: "number", min: -1000000, required: true },
                { name: "date", label: "Date", type: "date", required: true },
                { name: "reason", label: "Reason", type: "textarea", required: true },
              ]}
              initial={{ date: today() }} />
          )}
        </div>
        <Alert tone="error">{error}</Alert>
        {loading && !data ? <Spinner /> : data?.length ? (
          <KeyFigures
            items={data.map((p) => ({
              label: p.name,
              value: `${number(p.onHand)} ${p.unit}`,
              hint: p.onVehicles > 0 ? `${number(p.onVehicles)} ${p.unit} out on vehicles` : undefined,
              tone: p.onHand < 0 ? "bad" : undefined,
            }))}
          />
        ) : (
          <p className="border-y border-slate-200 py-3 text-sm text-slate-500">No products yet.</p>
        )}
      </section>
      <ResourcePage config={movements} />
    </div>
  );
};
