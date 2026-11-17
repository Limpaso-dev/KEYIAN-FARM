import { CheckCircle2, CornerUpLeft, Download, ExternalLink, FileText, Paperclip, XCircle } from "lucide-react";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Alert, Badge, NewTag } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { download, errorMessage, openFile } from "../../lib/api";
import { dateTime, fileSize, money, number } from "../../lib/format";
import { showError } from "../../lib/toast";
import { answeredSince, useAnswersSeen } from "../../lib/useNavCounts";
import { StoreAnswer } from "../stores/StoreRequestDetails";
import { storeRequestsConfig } from "../stores/storeRequests";
import { AnswersNote } from "./AnswersNote";
import { productRequestsConfig } from "./productRequests";

const blank = (v) => (v === "" || v == null ? 0 : Number(v));

// Each item says why it is needed, on a line of its own under the item.
const itemsField = {
  name: "items", label: "What you need", type: "items", addLabel: "Add item",
  columns: [
    { name: "description", label: "Item / service", required: true },
    { name: "quantity", label: "Qty", type: "number", required: true, width: 90 },
    { name: "unit", label: "Unit", width: 100 },
    { name: "unitCost", label: "Estimated unit cost", type: "number", width: 150 },
    { name: "total", label: "Total", type: "display", width: 120, render: (r) => money(blank(r.quantity) * blank(r.unitCost)) },
    { name: "purpose", label: "Purpose / justification", required: true, full: true, placeholder: "Why this item is needed" },
  ],
  total: (r) => blank(r.quantity) * blank(r.unitCost),
  formatTotal: money,
};

const MAX_PROFORMA_BYTES = 5 * 1024 * 1024;

const formFields = [
  { name: "title", label: "Title", required: true, placeholder: "e.g. Dairy meal for November" },
  { name: "priority", label: "Priority", type: "select", options: "priorities" },
  itemsField,
  {
    name: "proforma", label: "Proforma invoice (PDF)", type: "file", accept: "application/pdf", maxBytes: MAX_PROFORMA_BYTES,
    placeholder: "Attach the supplier's proforma invoice", help: "Optional. A PDF of up to 5 MB; Accounts opens it from the requisition.",
  },
];

// The proforma: a new file is sent; one already saved is left as it is (not sent); removed, null.
const toPayload = (v) => ({
  title: v.title,
  priority: v.priority || "normal",
  items: (v.items || []).filter((i) => i.description),
  proforma: v.proforma?.existing ? undefined : v.proforma ? { name: v.proforma.name, data: v.proforma.data } : null,
});

const proformaPath = (row) => `/requisitions/${row.id}/proforma`;
const failed = (err) => showError(errorMessage(err, "The proforma invoice could not be opened. Please try again."), "Could not open the file");

/** The proforma invoice sent with a requisition: its name and size, to open or save. */
const Proforma = ({ row }) => (
  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <span className="font-medium text-slate-700">Proforma invoice:</span>
    <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-800"><FileText size={15} className="shrink-0 text-primary-700" aria-hidden /><span className="break-all">{row.proforma.fileName}</span></span>
    <span className="text-xs tabular-nums text-slate-500">{fileSize(row.proforma.size)}</span>
    <span className="flex gap-3">
      <button type="button" onClick={() => openFile(proformaPath(row), row.proforma.fileName).catch(failed)} className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"><ExternalLink size={13} aria-hidden />Open</button>
      <button type="button" onClick={() => download(proformaPath(row), {}, row.proforma.fileName).catch(failed)} className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"><Download size={13} aria-hidden />Download</button>
    </span>
  </p>
);

const Details = ({ row }) => {
  // Requisitions raised before each item had its own purpose carry one for the whole requisition.
  const perItem = row.items.some((i) => i.purpose);
  return (
    <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-semibold">Item</th>
              {perItem && <th className="py-1 pr-3 font-semibold">Purpose / justification</th>}
              <th className="py-1 pr-3 text-right font-semibold">Qty</th>
              <th className="py-1 text-right font-semibold">Estimate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {row.items.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="py-1.5 pr-3 font-medium text-slate-800">{i.description}</td>
                {perItem && <td className="py-1.5 pr-3 text-slate-600">{i.purpose}</td>}
                <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">{number(i.quantity)} {i.unit}</td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{money(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 text-slate-600">
        {row.purpose && <p><span className="font-medium text-slate-700">Purpose:</span> {row.purpose}</p>}
        {row.proforma ? <Proforma row={row} /> : <p><span className="font-medium text-slate-700">Proforma invoice:</span> None attached</p>}
        <p><span className="font-medium text-slate-700">Raised by:</span> {row.requestedBy?.name} on {dateTime(row.createdAt)}</p>
        {row.decidedBy && <p><span className="font-medium text-slate-700">Decided by:</span> {row.decidedBy.name} on {dateTime(row.decidedAt)}</p>}
        {row.decisionComment && <p><span className="font-medium text-slate-700">Comment:</span> {row.decisionComment}</p>}
        {row.storeIssues?.length > 0 && <p><span className="font-medium text-slate-700">Stock out from stores:</span> {row.storeIssues.map((s) => `${s.issueNumber} (${number(s.quantity)} ${s.item.unit} ${s.item.name})`).join(", ")}</p>}
        {row.purchaseOrders?.length > 0 && <p><span className="font-medium text-slate-700">Purchase orders:</span> {row.purchaseOrders.map((p) => p.poNumber).join(", ")}</p>}
      </div>
    </div>
  );
};

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

const ANSWERED = ["approved", "returned", "rejected", "fulfilled"];

/** answers: what was answered since the user last looked (useAnswersSeen), marked New in the list. */
const config = (user, permissions, answers) => {
  const isNew = (r) => ANSWERED.includes(r.status) && r.department === user?.department && r.decidedBy?.id !== user?.id && answeredSince(answers, r.decidedAt);
  return {
    resource: "requisitions",
    endpoint: "/requisitions",
    title: "Requisitions to Accounts",
    description: "Money and things to buy, such as dust coats, each item with its purpose, and the supplier's proforma invoice (PDF) where there is one. The head of Accounts or the General Manager approves, returns or rejects, and Accounts then fulfils it. (Ask Stores for its items under To Stores.)",
    singular: "Requisition",
    createLabel: "New requisition",
    createSubmit: "Send for approval",
    formSize: "lg",
    canCreate: () => permissions?.requisitions?.raise,
    canEdit: () => true,
    canDelete: () => false,
    editableWhen: (r) => r.canEdit,
    editFields: formFields,
    createFields: formFields,
    createInitial: () => ({ priority: "normal", items: [{ description: "", quantity: "", unit: "", unitCost: "", purpose: "" }] }),
    toForm: (r) => ({
      ...r,
      items: r.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit || "", unitCost: i.unitCost, purpose: i.purpose || "" })),
      proforma: r.proforma ? { name: r.proforma.fileName, size: r.proforma.size, existing: true } : null,
    }),
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
      {
        key: "title", label: "Title",
        render: (r) => (
          <span className="inline-flex items-center gap-1.5">
            {r.title}
            {r.proforma && <span title="Proforma invoice attached" className="text-slate-400"><Paperclip size={14} aria-hidden /><span className="sr-only">(proforma invoice attached)</span></span>}
          </span>
        ),
      },
      { key: "priority", label: "Priority", render: (r, c) => <span className={r.priority === "urgent" ? "font-medium text-rose-700" : ""}>{c.label("priorities", r.priority)}</span> },
      { key: "requestedBy", label: "Raised by", render: (r) => r.requestedBy?.name },
      { key: "totalAmount", label: "Estimate", type: "money" },
      {
        // Returned and rejected ones say why, under the status.
        key: "status", label: "Status",
        render: (r, c) => (
          <span className="flex flex-col items-start gap-1">
            <span className="flex items-center gap-1.5">
              <Badge value={r.status}>{c.label("requisitionStatus", r.status)}</Badge>
              {isNew(r) && <NewTag />}
            </span>
            {["returned", "rejected"].includes(r.status) && r.decisionComment && <span className="max-w-[16rem] text-xs text-slate-500">{r.decisionComment}</span>}
          </span>
        ),
      },
    ],
    expand: (row) => <Details row={row} />,
    actions: [
      decision("approve", "Approve", CheckCircle2, "primary", false),
      decision("return", "Return", CornerUpLeft, "secondary", true),
      decision("reject", "Reject", XCircle, "ghost", true),
      { key: "fulfil", label: "Mark fulfilled", when: (r) => r.canFulfil, path: (r) => `/requisitions/${r.id}/fulfil`, confirm: (r) => `Mark ${r.requisitionNumber} as fulfilled? Use this once the items have been bought or paid for.` },
      { key: "cancel", label: "Cancel", variant: "ghost", when: (r) => r.canCancel, path: (r) => `/requisitions/${r.id}/cancel`, confirm: (r) => `Cancel ${r.requisitionNumber}?`, submitLabel: "Cancel requisition" },
    ],
    user,
  };
};

/** Requisitions to Accounts. Opening them clears the count of answers in the sidebar. */
const ToAccounts = () => {
  const { user, permissions, label } = useAuth();
  const answers = useAnswersSeen("/requisitions", Boolean(permissions?.requisitions?.raise));
  return (
    <>
      {permissions?.requisitions?.decide && <Alert tone="info" className="mb-4">You can approve requisitions. You cannot decide on a requisition you raised yourself.</Alert>}
      <AnswersNote
        answers={answers}
        line={(r) => (
          <>
            <span className="font-medium tabular-nums text-slate-800">{r.requisitionNumber}</span>
            <span>{r.title}</span>
            <Badge value={r.status}>{label("requisitionStatus", r.status)}</Badge>
            {r.decisionComment && <span className="text-slate-500">{r.decisionComment}</span>}
          </>
        )}
      />
      <ResourcePage config={config(user, permissions, answers)} />
    </>
  );
};

/** Requests to Stores. Opening them clears the count of answers in the sidebar. */
const ToStores = () => {
  const auth = useAuth();
  const answers = useAnswersSeen("/store-requests", Boolean(auth.permissions?.storeRequests?.raise));
  return (
    <>
      <AnswersNote answers={answers} line={(r) => <StoreAnswer row={r} label={auth.label} />} />
      <ResourcePage config={storeRequestsConfig(auth, answers)} />
    </>
  );
};

/**
 * Requisitions, with a section for each kind of request (see navigation.js):
 * to Accounts; products Sales asks MVA for; products the administration asks
 * Sales for (office use); items the departments ask Stores for.
 */
const RequisitionsPage = () => {
  const { permissions } = useAuth();
  return (
    <ModulePage
      sections={{
        accounts: () => <ToAccounts />,
        mva: () => <ResourcePage config={productRequestsConfig("mva", permissions)} />,
        sales: () => <ResourcePage config={productRequestsConfig("sales", permissions)} />,
        stores: () => <ToStores />,
      }}
    />
  );
};

export default RequisitionsPage;
