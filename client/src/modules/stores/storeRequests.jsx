import { Ban, PackageCheck, XCircle } from "lucide-react";
import { Badge, NewTag } from "../../components/ui/ui";
import { get } from "../../lib/api";
import { number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { answeredSince } from "../../lib/useNavCounts";
import { requestLines } from "./requestLines";
import { StoreRequestDetails } from "./StoreRequestDetails";

// Store requests. A department asks Stores for items, each with what it is
// for; Stores dispatches them, which records the stock out to that
// department and takes the items off stock. Stores sees them under Stores >
// Requests; the departments under Requisitions > To Stores.

/** The dispatch form: each line asked for, what it is for, beside what the store holds. */
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
        purpose: i.purpose || row.purpose || "",
        asked: number(i.quantity),
        onHand: held == null ? "-" : number(held),
        // Offer what was asked for, or what the store has if that is less.
        quantity: held == null ? i.quantity : Math.max(0, Math.min(Number(i.quantity), Number(held))),
      };
    }),
  };
};

/**
 * auth: from useAuth() - user, permissions, and label() for option names.
 * answers: what Stores answered since the user last looked (useAnswersSeen), marked New in the list.
 */
export const storeRequestsConfig = (auth, answers = null) => {
  const rules = auth.permissions?.storeRequests || {};
  const handles = Boolean(rules.handle);
  const department = (r) => auth.label("departments", r.department);
  const isNew = (r) => ["issued", "declined"].includes(r.status) && r.department === auth.user?.department && r.handledBy?.id !== auth.user?.id && answeredSince(answers, r.handledAt);
  return {
    resource: "storeRequests",
    endpoint: "/store-requests",
    title: handles ? "Requests from departments" : rules.seeAll ? "Requests to Stores" : "Items asked of Stores",
    description: handles
      ? "Departments ask for items here, each with what it is for. Dispatch hands them over: it records the stock out to the department and takes the items off stock."
      : "Ask Stores for the items you need, saying what each is for. Stores dispatches them, and each request shows what was handed over.",
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
          { name: "purpose", label: "What it is for", required: true, full: true, placeholder: "e.g. Spraying the tea farm" },
        ],
      },
    ],
    createInitial: () => ({ date: today(), items: [{ itemId: "", quantity: "", unit: "", purpose: "" }] }),
    toPayload: (v) => ({ date: v.date, items: (v.items || []).filter((i) => i.itemId && i.quantity !== "").map((i) => ({ itemId: i.itemId, quantity: i.quantity, purpose: i.purpose })) }),
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
      { key: "items", label: "Items", render: (r) => requestLines(r) },
      {
        // A declined request says why, under the status.
        key: "status", label: "Status",
        render: (r, c) => (
          <span className="flex flex-col items-start gap-1">
            <span className="flex items-center gap-1.5">
              <Badge value={r.status}>{c.label("storeRequestStatus", r.status)}</Badge>
              {isNew(r) && <NewTag />}
            </span>
            {r.status === "declined" && r.declineReason && <span className="max-w-[16rem] text-xs text-slate-500">{r.declineReason}</span>}
          </span>
        ),
      },
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
              { name: "purpose", label: "For:", type: "display", full: true, render: (row) => row.purpose || <span className="text-slate-400">Not given</span> },
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
