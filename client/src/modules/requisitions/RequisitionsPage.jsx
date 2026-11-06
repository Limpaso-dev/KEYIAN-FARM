import { CheckCircle2, CornerUpLeft, XCircle } from "lucide-react";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Alert, PageHeader } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { dateTime, money, number } from "../../lib/format";

const blank = (v) => (v === "" || v == null ? 0 : Number(v));

const itemsField = {
  name: "items", label: "What you need", type: "items", addLabel: "Add item",
  columns: [
    { name: "description", label: "Item / service", required: true },
    { name: "quantity", label: "Qty", type: "number", required: true, width: 90 },
    { name: "unit", label: "Unit", width: 100 },
    { name: "unitCost", label: "Estimated unit cost", type: "number", width: 150 },
    { name: "total", label: "Total", type: "display", width: 120, render: (r) => money(blank(r.quantity) * blank(r.unitCost)) },
  ],
  total: (r) => blank(r.quantity) * blank(r.unitCost),
  formatTotal: money,
};

const formFields = [
  { name: "title", label: "Title", required: true, placeholder: "e.g. Dairy meal for November" },
  { name: "priority", label: "Priority", type: "select", options: "priorities" },
  { name: "purpose", label: "Purpose / justification", type: "textarea", required: true },
  itemsField,
];

const toPayload = (v) => ({ title: v.title, purpose: v.purpose, priority: v.priority || "normal", items: (v.items || []).filter((i) => i.description) });

const Details = ({ row }) => (
  <div className="grid gap-6 text-sm md:grid-cols-2">
    <div>
      <p className="mb-1 font-medium text-slate-700">Items</p>
      <table className="w-full">
        <tbody className="divide-y divide-slate-200">
          {row.items.map((i) => <tr key={i.id}><td className="py-1">{i.description}</td><td className="text-right">{number(i.quantity)} {i.unit}</td><td className="text-right">{money(i.total)}</td></tr>)}
        </tbody>
      </table>
    </div>
    <div className="space-y-1 text-slate-600">
      <p><span className="font-medium text-slate-700">Purpose:</span> {row.purpose}</p>
      <p><span className="font-medium text-slate-700">Raised by:</span> {row.requestedBy?.name} on {dateTime(row.createdAt)}</p>
      {row.decidedBy && <p><span className="font-medium text-slate-700">Decided by:</span> {row.decidedBy.name} on {dateTime(row.decidedAt)}</p>}
      {row.decisionComment && <p><span className="font-medium text-slate-700">Comment:</span> {row.decisionComment}</p>}
      {row.storeIssues?.length > 0 && <p><span className="font-medium text-slate-700">Issued from stores:</span> {row.storeIssues.map((s) => `${s.issueNumber} (${number(s.quantity)} ${s.item.unit} ${s.item.name})`).join(", ")}</p>}
      {row.purchaseOrders?.length > 0 && <p><span className="font-medium text-slate-700">Purchase orders:</span> {row.purchaseOrders.map((p) => p.poNumber).join(", ")}</p>}
    </div>
  </div>
);

const decision = (key, label, icon, variant, needsComment) => ({
  key, label, icon, variant,
  when: (r) => r.canDecide,
  path: (r) => `/requisitions/${r.id}/decision`,
  title: (r) => `${label}: ${r.requisitionNumber} - ${r.title} (${money(r.totalAmount)})`,
  intro: (r) => <Details row={r} />,
  size: "lg",
  fields: [{ name: "comment", label: needsComment ? "Reason (required)" : "Comment (optional)", type: "textarea", required: needsComment }],
  toPayload: (v) => ({ decision: key, comment: v.comment }),
  submitLabel: label,
  tone: key === "reject" ? "danger" : "primary",
  success: () => ({ approve: "Requisition approved", return: "Requisition returned to the department", reject: "Requisition rejected" })[key],
});

const config = (user, permissions) => ({
  resource: "requisitions",
  endpoint: "/requisitions",
  title: "Requisitions",
  singular: "Requisition",
  createLabel: "New requisition",
  formSize: "lg",
  canCreate: () => permissions?.requisitions?.raise,
  canEdit: () => true,
  canDelete: () => false,
  editableWhen: (r) => r.canEdit,
  editFields: formFields,
  createFields: formFields,
  createInitial: () => ({ priority: "normal", items: [{ description: "", quantity: "", unit: "", unitCost: "" }] }),
  toForm: (r) => ({ ...r, items: r.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit || "", unitCost: i.unitCost })) }),
  toPayload,
  created: (r) => `${r.requisitionNumber} sent for approval`,
  filters: [
    { name: "status", label: "Status", options: "requisitionStatus" },
    ...(permissions?.requisitions?.seeAll ? [{ name: "department", label: "Department", options: "departments" }] : []),
    { type: "dateRange" },
  ],
  defaultQuery: permissions?.requisitions?.decide ? { status: "pending" } : {},
  columns: [
    { key: "requisitionNumber", label: "Number" },
    { key: "createdAt", label: "Raised", render: (r) => dateTime(r.createdAt) },
    { key: "department", label: "Department", type: "option:departments" },
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority", render: (r, c) => <span className={r.priority === "urgent" ? "font-medium text-rose-700" : ""}>{c.label("priorities", r.priority)}</span> },
    { key: "requestedBy", label: "Raised by", render: (r) => r.requestedBy?.name },
    { key: "totalAmount", label: "Estimate", type: "money" },
    { key: "status", label: "Status", type: "status:requisitionStatus" },
  ],
  expand: (row) => <Details row={row} />,
  actions: [
    decision("approve", "Approve", CheckCircle2, "primary", false),
    decision("return", "Return", CornerUpLeft, "secondary", true),
    decision("reject", "Reject", XCircle, "ghost", true),
    { key: "fulfil", label: "Mark fulfilled", when: (r) => r.canFulfil, path: (r) => `/requisitions/${r.id}/fulfil`, confirm: (r) => `Mark ${r.requisitionNumber} as fulfilled? Use this once the items have been issued or bought.` },
    { key: "cancel", label: "Cancel", variant: "ghost", when: (r) => r.canCancel, path: (r) => `/requisitions/${r.id}/cancel`, confirm: (r) => `Cancel ${r.requisitionNumber}?`, submitLabel: "Cancel requisition" },
  ],
  user,
});

const RequisitionsPage = () => {
  const { user, permissions } = useAuth();
  return (
    <div>
      <PageHeader title="Requisitions" description="Departments request what they need. The head of Accounts or the General Manager approves, returns or rejects. Stores or Accounts then fulfils it." />
      {permissions?.requisitions?.decide && <Alert tone="info" className="mb-4">You can approve requisitions. You cannot decide on a requisition you raised yourself.</Alert>}
      <ResourcePage config={config(user, permissions)} />
    </div>
  );
};

export default RequisitionsPage;
