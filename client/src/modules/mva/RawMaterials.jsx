import { useState } from "react";
import { PackagePlus, SlidersHorizontal } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { MOVEMENT_LABELS } from "../../components/resource/movementLabels";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { Alert, Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { get } from "../../lib/api";
import { daysAgo, number, today } from "../../lib/format";
import { toast } from "../../lib/toast";
import { useFetch } from "../../lib/useFetch";

// MVA's raw materials: the raw milk it processes and the cups yoghurt is
// packed in. Cups come in when recorded here as received and go out as
// yoghurt is packed under Product output, one cup a piece.

const blankToZero = (value) => (value === "" || value == null ? 0 : Number(value));

/** Stock of raw milk and the cups, with receipts, corrections (heads) and history. */
export const RawMaterials = () => {
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch("/mva/raw-materials");
  // Bumped after a change, so the history below loads again.
  const [version, setVersion] = useState(0);
  const changed = (message) => {
    reload();
    setVersion((v) => v + 1);
    if (message) toast(message);
  };
  const materials = (data || []).filter((m) => m.kind === "material");

  const movements = {
    resource: "rawMaterials",
    endpoint: "/mva/raw-materials/movements",
    title: "Raw material movements",
    description: "Raw milk in and out of MVA, and the cups received and used in production.",
    deletable: false,
    editFields: false,
    canCreate: () => false,
    defaultQuery: { from: daysAgo(7), to: today() },
    filters: [{ type: "dateRange" }],
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "item", label: "Item" },
      { key: "movementType", label: "Movement", render: (r) => MOVEMENT_LABELS[r.movementType] || r.movementType },
      { key: "quantity", label: "Quantity", align: "right", render: (r) => <span className={r.quantity < 0 ? "text-rose-700" : "text-emerald-700"}>{r.quantity > 0 ? "+" : ""}{number(r.quantity)} {r.unit}</span> },
      { key: "notes", label: "Reference" },
    ],
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Raw materials at MVA</h2>
          <div className="flex flex-wrap gap-2">
            {can("rawMaterials", "write") && (
              <ActionButton label="Record cups received" icon={PackagePlus} variant="primary" path="/mva/raw-materials/receipts" submitLabel="Save receipt" onDone={(r) => changed(r?.message)}
                fields={[
                  { name: "date", label: "Date received", type: "date", required: true },
                  { name: "reference", label: "Reference", placeholder: "e.g. Delivery note 552, REQ-2026-0004", help: "Where they came from: a delivery note, the supplier, the requisition that bought them" },
                  {
                    name: "items", label: "Cups received (leave blank what did not come)", type: "items", fixedRows: true,
                    columns: [{ name: "name", label: "Cups", type: "display" }, { name: "onHand", label: "At MVA", type: "display", width: 120 }, { name: "quantity", label: "Received", type: "number", step: 1, width: 140 }],
                    total: (row) => blankToZero(row.quantity), formatTotal: (t) => `${number(t, 0)} cups`,
                  },
                ]}
                initial={async () => {
                  const list = await get("/mva/raw-materials");
                  return { date: today(), items: list.filter((m) => m.kind === "material").map((m) => ({ materialId: m.id, name: m.name, onHand: `${number(m.onHand, 0)} ${m.unit}`, quantity: "" })) };
                }}
                toPayload={(v) => ({ date: v.date, reference: v.reference, items: v.items.filter((i) => blankToZero(i.quantity) > 0).map((i) => ({ materialId: i.materialId, quantity: i.quantity })) })} />
            )}
            {can("rawMaterials", "adjust") && (
              <ActionButton label="Adjust after count" icon={SlidersHorizontal} path="/mva/raw-materials/adjustments" onDone={() => changed("Stock corrected")}
                intro={<Alert tone="warning">Use this only to correct stock after a physical count. Enter a negative number to reduce stock.</Alert>}
                fields={[
                  { name: "itemId", label: "Item", type: "select", options: (data || []).map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` })), required: true, span: 2 },
                  { name: "quantity", label: "Quantity to add (+) or remove (-)", type: "number", min: -1000000, required: true },
                  { name: "date", label: "Date", type: "date", required: true },
                  { name: "reason", label: "Reason", type: "textarea", required: true },
                ]}
                initial={{ date: today() }} />
            )}
          </div>
        </div>
        <Alert tone="error">{error}</Alert>
        {loading && !data ? <Spinner /> : (
          <KeyFigures
            items={(data || []).map((m) => ({
              label: m.name,
              value: `${number(m.onHand, m.kind === "material" ? 0 : 2)} ${m.unit}`,
              hint: m.kind === "milk" ? "Received less allocated" : "One a piece of yoghurt packed",
              tone: m.onHand < 0 ? "bad" : m.kind === "material" && m.onHand === 0 ? "warn" : undefined,
            }))}
            columns={5}
          />
        )}
        {data && materials.length > 0 && materials.every((m) => m.onHand === 0) && (
          <p className="mt-2 text-sm text-slate-600">No cups are in stock. Record the cups received before recording yoghurt output: each piece packed uses a cup of its size.</p>
        )}
      </section>
      <ResourcePage key={version} config={movements} />
    </div>
  );
};
