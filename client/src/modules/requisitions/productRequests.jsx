import { Ban, PackageCheck, Send, XCircle } from "lucide-react";
import { get } from "../../lib/api";
import { number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { ProductRequestDetails } from "./ProductRequestDetails";

// Product requests. Sales asks MVA for products and MVA sends them (Sales
// then receives them under From MVA). The administration asks Sales for
// products, and Sales gives them out as office use: off Sales stock, not paid for.

const lines = (items, field = "quantity") => items.map((i) => `${i.product?.name} ${number(i[field])}`).join(", ");

/** The quantities form for answering a request, beside what the department has in stock. */
const answerForm = async (row, location) => {
  const stock = await get(`/stock/${location}`).catch(() => []);
  const onHand = (productId) => stock.find((p) => p.productId === productId)?.onHand;
  return {
    date: today(),
    items: row.items.map((i) => ({
      itemId: i.id,
      product: `${i.product?.name} (${i.product?.unit})`,
      asked: number(i.quantity),
      onHand: onHand(i.productId) == null ? "-" : number(onHand(i.productId)),
      quantity: i.quantity,
    })),
  };
};

export const productRequestsConfig = (to, permissions) => {
  const mva = to === "mva";
  const asks = Boolean(permissions?.productRequests?.raiseTo?.includes(to));
  const handles = Boolean(permissions?.productRequests?.handles?.includes(to));
  const given = mva ? "Send" : "Give out";
  return {
    resource: "productRequests",
    endpoint: "/product-requests",
    params: { to },
    title: mva ? "Products Sales asked MVA for" : "Products asked of Sales for office use",
    description: mva
      ? "Sales asks for products here. MVA sends them, and they reach Sales stock once Sales receives them under From MVA."
      : "The administration asks for products here. Sales gives them out as office use: they come off Sales stock and are not paid for.",
    singular: "Request",
    createLabel: mva ? "Ask MVA for products" : "Ask Sales for products",
    formSize: "lg",
    canCreate: () => asks,
    canEdit: () => false,
    canDelete: () => false,
    editFields: false,
    createFields: [
      { name: "date", label: "Date", type: "date", required: true },
      {
        name: "items", label: "Products", type: "items", addLabel: "Add product",
        columns: [
          { name: "productId", label: "Product", type: "select", ref: mva ? refs.processedProducts : refs.products, required: true },
          { name: "quantity", label: "Quantity", type: "number", required: true, width: 140 },
        ],
      },
      { name: "purpose", label: mva ? "Notes" : "What it is for", type: "textarea" },
    ],
    createInitial: () => ({ date: today(), items: [{ productId: "", quantity: "" }] }),
    toPayload: (v) => ({ to, date: v.date, purpose: v.purpose, items: (v.items || []).filter((i) => i.productId && i.quantity !== "").map((i) => ({ productId: i.productId, quantity: i.quantity })) }),
    created: (r) => `${r.requestNumber} sent to ${mva ? "MVA" : "Sales"}`,
    filters: [{ name: "status", label: "Status", options: "productRequestStatus" }, { type: "dateRange" }],
    defaultQuery: handles ? { status: "pending" } : {},
    columns: [
      { key: "requestNumber", label: "Number" },
      { key: "date", label: "Date", type: "date" },
      ...(mva ? [] : [{ key: "requestedBy", label: "Asked by", render: (r) => r.requestedBy?.name }]),
      { key: "items", label: "Products", render: (r) => lines(r.items) },
      { key: "purpose", label: mva ? "Notes" : "For" },
      { key: "status", label: "Status", type: "status:productRequestStatus" },
    ],
    expand: (row) => <ProductRequestDetails row={row} to={to} />,
    actions: [
      {
        key: "answer", label: given, icon: mva ? Send : PackageCheck, variant: "primary",
        when: (r) => r.canSend || r.canIssue,
        path: (r) => `/product-requests/${r.id}/${mva ? "send" : "issue"}`,
        title: (r) => (mva ? `Send ${r.requestNumber} to Sales` : `Give out ${r.requestNumber} as office use`),
        intro: (r) => <p className="text-sm text-slate-600">{mva ? "This sends the products to Sales; they reach Sales stock once Sales receives them." : "These come off Sales stock as office use and are not paid for."}{r.purpose ? ` ${mva ? "Notes" : "For"}: ${r.purpose}` : ""}</p>,
        size: "lg",
        fields: [
          { name: "date", label: "Date", type: "date", required: true },
          {
            name: "items", label: mva ? "Quantities to send" : "Quantities to give out", type: "items", fixedRows: true,
            columns: [
              { name: "product", label: "Product", type: "display" },
              { name: "asked", label: "Asked for", type: "display", width: 100 },
              { name: "onHand", label: mva ? "At MVA" : "In store", type: "display", width: 100 },
              { name: "quantity", label: given, type: "number", width: 130 },
            ],
          },
          ...(mva ? [{ name: "notes", label: "Notes", type: "textarea" }] : []),
        ],
        initial: (r) => answerForm(r, to),
        toPayload: (v) => ({ date: v.date, notes: v.notes, items: v.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity === "" ? 0 : i.quantity })) }),
        submitLabel: given,
        success: () => (mva ? "Sent to Sales" : "Given out as office use"),
      },
      {
        key: "decline", label: "Decline", icon: XCircle, variant: "ghost",
        when: (r) => r.canDecline,
        path: (r) => `/product-requests/${r.id}/decline`,
        title: (r) => `Decline ${r.requestNumber}`,
        fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }],
        submitLabel: "Decline", tone: "danger",
        success: () => "Request declined",
      },
      {
        key: "cancel", label: "Cancel", icon: Ban, variant: "ghost",
        when: (r) => r.canCancel,
        path: (r) => `/product-requests/${r.id}/cancel`,
        confirm: (r) => `Cancel ${r.requestNumber}?`, submitLabel: "Cancel request",
        success: () => "Request cancelled",
      },
    ],
  };
};

