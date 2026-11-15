import { Ban, PackageCheck, XCircle } from "lucide-react";
import { get } from "../../lib/api";
import { number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { StoreRequestDetails } from "./StoreRequestDetails";

// Store requests. A department asks Stores for items; Stores dispatches them,
// which records the stock out to that department and takes the items off
// stock. Stores sees them under Stores > Requests; the departments under
// Requisitions > To Stores.

const lines = (items) => items.map((i) => `${i.item?.name} ${number(i.quantity)} ${i.item?.unit || ""}`.trim()).join(", ");

/** The dispatch form: each line asked for, beside what the store holds. */
const dispatchForm = async (row) => {
  const stock = await get("/stores/stock").catch(() => []);
  const onHand = (itemId) => stock.find((s) => s.id === itemId)?.quantityOnHand;
  return {
    date: today(),
    issuedTo: row.requestedBy?.name || "",
    items: row.items.map((i) => {
      const held = onHand(i.itemId);
      return {
        itemId: i.id,
        item: `${i.item?.name} (${i.item?.unit})`,
        asked: number(i.quantity),
        onHand: held == null ? "-" : number(held),
        // Offer what was asked for, or what the store has if that is less.
        quantity: held == null ? i.quantity : Math.max(0, Math.min(Number(i.quantity), Number(held))),
      };
    }),
  };
};

/** auth: from useAuth() - permissions, and label() for option names. */
export const storeRequestsConfig = (auth) => {
  const rules = auth.permissions?.storeRequests || {};
  const handles = Boolean(rules.handle);
  const department = (r) => auth.label("departments", r.department);
  return {
    resource: "storeRequests",
    endpoint: "/store-requests",
    title: handles ? "Requests from departments" : rules.seeAll ? "Requests to Stores" : "Items asked of Stores",
    description: handles
      ? "Departments ask for items here. Dispatch hands them over: it records the stock out to the department and takes the items off stock."
      : "Ask Stores for the items you need. Stores dispatches them, and each request shows what was handed over.",
    singular: "Request",
    createLabel: "Ask Stores for items",
    formSize: "lg",
    canCreate: () => Boolean(rules.raise),
    canEdit: () => false,
    canDelete: () => false,
    editFields: false,
    createFields: [
      { name: "date", label: "Date", type: "date", required: true },
      {
        name: "items", label: "Items", type: "items", addLabel: "Add item",
        columns: [
          { name: "itemId", label: "Item", type: "select", ref: refs.requestableStoreItems, required: true, onSelect: (i) => ({ unit: i?.unit || "" }) },
          { name: "quantity", label: "Quantity", type: "number", required: true, width: 130 },
          { name: "unit", label: "Unit", type: "display", width: 110 },
        ],
      },
      { name: "purpose", label: "What it is for", type: "textarea" },
    ],
    createInitial: () => ({ date: today(), items: [{ itemId: "", quantity: "", unit: "" }] }),
    toPayload: (v) => ({ date: v.date, purpose: v.purpose, items: (v.items || []).filter((i) => i.itemId && i.quantity !== "").map((i) => ({ itemId: i.itemId, quantity: i.quantity })) }),
    created: (r) => `${r.requestNumber} sent to Stores`,
    filters: [
      { name: "status", label: "Status", options: "storeRequestStatus" },
      ...(rules.seeAll ? [{ name: "department", label: "Department", options: "departments" }] : []),
      { type: "dateRange" },
    ],
    defaultQuery: handles ? { status: "pending" } : {},
    columns: [
      { key: "requestNumber", label: "Number" },
      { key: "date", label: "Date", type: "date" },
      ...(rules.seeAll ? [{ key: "department", label: "Department", type: "option:departments" }] : []),
      { key: "requestedBy", label: "Asked by", render: (r) => r.requestedBy?.name },
      { key: "items", label: "Items", render: (r) => lines(r.items) },
      { key: "purpose", label: "For" },
      { key: "status", label: "Status", type: "status:storeRequestStatus" },
    ],
    expand: (row) => <StoreRequestDetails row={row} />,
    actions: [
      {
        key: "dispatch", label: "Dispatch", icon: PackageCheck, variant: "primary",
        when: (r) => r.canDispatch,
        path: (r) => `/store-requests/${r.id}/dispatch`,
        title: (r) => `Dispatch ${r.requestNumber} to ${department(r)}`,
        intro: (r) => (
          <p className="text-sm text-slate-600">
            This records the stock out to {department(r)} and takes the items off stock. You can give less than was asked for, never more.
            {r.purpose ? ` For: ${r.purpose}` : ""}
          </p>
        ),
        size: "lg",
        fields: [
          { name: "date", label: "Date", type: "date", required: true },
          { name: "issuedTo", label: "Received by (name)", required: true },
          {
            name: "items", label: "Quantities to dispatch", type: "items", fixedRows: true,
            columns: [
              { name: "item", label: "Item", type: "display" },
              { name: "asked", label: "Asked for", type: "display", width: 100 },
              { name: "onHand", label: "In store", type: "display", width: 100 },
              { name: "quantity", label: "Dispatch", type: "number", width: 130 },
            ],
          },
        ],
        initial: (r) => dispatchForm(r),
        toPayload: (v) => ({ date: v.date, issuedTo: v.issuedTo, items: v.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity === "" ? 0 : i.quantity })) }),
        submitLabel: "Dispatch",
        success: (r) => `${r.requestNumber} dispatched to ${department(r)}`,
      },
      {
        key: "decline", label: "Decline", icon: XCircle, variant: "ghost",
        when: (r) => r.canDecline,
        path: (r) => `/store-requests/${r.id}/decline`,
        title: (r) => `Decline ${r.requestNumber}`,
        fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }],
        submitLabel: "Decline", tone: "danger",
        success: () => "Request declined",
      },
      {
        key: "cancel", label: "Cancel", icon: Ban, variant: "ghost",
        when: (r) => r.canCancel,
        path: (r) => `/store-requests/${r.id}/cancel`,
        confirm: (r) => `Cancel ${r.requestNumber}?`, submitLabel: "Cancel request",
        success: () => "Request cancelled",
      },
    ],
  };
};
