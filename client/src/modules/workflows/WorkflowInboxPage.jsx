import { useCallback, useEffect, useState } from "react";
import { Check, CircleDollarSign, ClipboardCheck, Inbox, Plus, RotateCcw, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import {
  createWorkflowPolicy,
  decideLifecycleTask,
  decidePurchaseRequest,
  deleteWorkflowPolicy,
  getPurchaseRequests,
  getLifecycleTasks,
  getWorkflowPolicies,
  resubmitLifecycleTask,
  resubmitPurchaseRequest,
  submitPurchaseRequest,
  updateWorkflowPolicy,
} from "../../services/workflow.service";

const blankForm = { title: "", reason: "", priority: "normal", description: "", quantity: 1, unitPrice: 0 };
const approvalRoles = ["manager", "finance", "procurement", "doctor", "nurse", "admin", "super_admin"];
const workflowTypes = [
  ["purchase_request", "Purchase request"], ["purchase_order", "Purchase order"],
  ["supplier_invoice", "Supplier invoice"], ["supplier_payment", "Supplier payment"],
  ["hmis_bill", "HMIS bill"], ["finance_transaction", "Finance transaction"],
];
const formatMoney = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(amount) || 0);

const TaskLineItems = ({ task }) => {
  if (task.documentUrl && !task.items?.length) return <p className="mt-3 text-sm"><a className="font-medium text-primary-700 hover:underline" href={task.documentUrl} target="_blank" rel="noreferrer">Open supporting document</a></p>;
  if (!task.items?.length) return null;
  return <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100"><table className="min-w-full text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Line</th><th className="p-2">Quantity</th>{task.workflowType === "supplier_invoice" && <th className="p-2">Accepted GRN</th>}<th className="p-2">Unit rate</th><th className="p-2">Line total</th></tr></thead><tbody>{task.items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-t"><td className="p-2">{item.description}</td><td className="p-2">{item.quantity}</td>{task.workflowType === "supplier_invoice" && <td className="p-2">{task.receiptItems?.[index]?.acceptedQuantity ?? "—"}</td>}<td className="p-2">{formatMoney(item.unitPrice)}</td><td className="p-2">{formatMoney(item.total)}</td></tr>)}</tbody></table>{task.workflowType === "supplier_invoice" && <p className="border-t bg-slate-50 px-2 py-1 text-slate-500">Compared against {task.poReference} and {task.grnReference}</p>}</div>;
};

const WorkflowInboxPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [lifecycleTasks, setLifecycleTasks] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [policyForm, setPolicyForm] = useState({ workflowType: "purchase_request", name: "", department: user?.department || "", minAmount: 0, maxAmount: "", roleChain: "manager,finance,procurement" });
  const [resubmitId, setResubmitId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskDraft, setTaskDraft] = useState({});
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [commentById, setCommentById] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, tasks] = await Promise.all([getPurchaseRequests(), getLifecycleTasks()]);
      setRequests(list.data || []);
      setLifecycleTasks(tasks.data || []);
      if (isAdmin) {
        const configured = await getWorkflowPolicies();
        setPolicies(configured.data || []);
      }
    } catch (error) {
      window.alert(error.response?.data?.message || "Could not load workflow inbox");
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const openResubmit = (request) => {
    setResubmitId(request._id);
    const firstItem = request.items?.[0] || {};
    setForm({ title: request.title, reason: request.reason, priority: request.priority || "normal", description: firstItem.description || "", quantity: firstItem.quantity || 1, unitPrice: firstItem.unitPrice || 0 });
    document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const saveRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = { title: form.title, reason: form.reason, priority: form.priority, items: [{ description: form.description, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }] };
    try {
      if (resubmitId) await resubmitPurchaseRequest(resubmitId, payload);
      else await submitPurchaseRequest(payload);
      setForm(blankForm);
      setResubmitId(null);
      await load();
    } catch (error) { window.alert(error.response?.data?.message || "Could not submit the request"); }
    finally { setSaving(false); }
  };

  const decide = async (request, decision) => {
    if (["reject", "return"].includes(decision) && !commentById[request._id]?.trim()) {
      window.alert("Add a comment before returning or rejecting this request.");
      return;
    }
    setSaving(true);
    try {
      await decidePurchaseRequest(request._id, { decision, comment: commentById[request._id] || "" });
      setCommentById((current) => ({ ...current, [request._id]: "" }));
      await load();
    } catch (error) { window.alert(error.response?.data?.message || "Could not update the request"); }
    finally { setSaving(false); }
  };

  const decideTask = async (task, decision) => {
    if (["reject", "return"].includes(decision) && !commentById[task.id]?.trim()) {
      window.alert("Add a comment before returning or rejecting this item.");
      return;
    }
    setSaving(true);
    try {
      await decideLifecycleTask(task.workflowType, task.id, { decision, comment: commentById[task.id] || "" });
      setCommentById((current) => ({ ...current, [task.id]: "" }));
      await load();
    } catch (error) { window.alert(error.response?.data?.message || "Could not update this workflow item"); }
    finally { setSaving(false); }
  };

  const openTaskResubmit = (task) => {
    setEditingTask(task);
    setTaskDraft({ invoiceNumber: task.workflowType === "supplier_invoice" ? task.reference : "", amount: task.amount || "", reference: "", description: task.detail || "", items: (task.items || []).map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })), unitPrices: (task.items || []).map((item) => item.unitPrice) });
  };

  const saveTaskResubmit = async (event) => {
    event.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    try {
      const payload = { ...taskDraft };
      if (editingTask.workflowType === "purchase_order") payload.unitPrices = taskDraft.unitPrices.map(Number);
      if (["supplier_invoice", "hmis_bill"].includes(editingTask.workflowType)) payload.items = taskDraft.items.map((item) => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }));
      await resubmitLifecycleTask(editingTask.workflowType, editingTask.id, payload);
      setEditingTask(null);
      await load();
    } catch (error) { window.alert(error.response?.data?.message || "Could not resubmit this item"); }
    finally { setSaving(false); }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    const roles = policyForm.roleChain.split(",").map((role) => role.trim().toLowerCase().replace(/[\s-]+/g, "_")).filter(Boolean);
    if (roles.some((role) => !approvalRoles.includes(role))) {
      window.alert(`Approval roles must be: ${approvalRoles.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const payload = { workflowType: policyForm.workflowType, name: policyForm.name, department: policyForm.department, minAmount: Number(policyForm.minAmount), maxAmount: policyForm.maxAmount === "" ? null : Number(policyForm.maxAmount), steps: roles.map((role) => ({ approverRole: role, label: role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) })) };
      if (editingPolicyId) await updateWorkflowPolicy(editingPolicyId, payload);
      else await createWorkflowPolicy(payload);
      setEditingPolicyId(null);
      setPolicyForm((current) => ({ ...current, name: "", minAmount: 0, maxAmount: "" }));
      await load();
    } catch (error) { window.alert(error.response?.data?.message || "Could not save approval policy"); }
    finally { setSaving(false); }
  };

  const removePolicy = async (policy) => {
    if (!window.confirm(`Delete the approval policy â€œ${policy.name}â€?`)) return;
    try { await deleteWorkflowPolicy(policy._id); await load(); }
    catch (error) { window.alert(error.response?.data?.message || "Could not delete policy"); }
  };

  const editPolicy = (policy) => {
    setEditingPolicyId(policy._id);
    setPolicyForm({
      name: policy.name,
      workflowType: policy.workflowType,
      department: policy.department,
      minAmount: policy.minAmount,
      maxAmount: policy.maxAmount ?? "",
      roleChain: policy.steps.map((step) => step.approverRole).join(","),
    });
    document.getElementById("policy-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const statusClass = { pending_approval: "bg-amber-100 text-amber-800", returned: "bg-orange-100 text-orange-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-rose-100 text-rose-800" };
  const requestDepartment = user?.department || user?.role || "your department";

  return <div className="space-y-6">
    <header>
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary-100 p-3 text-primary-700"><Inbox size={22} /></div><div><h1 className="text-2xl font-bold text-slate-900">Department Workflows</h1><p className="text-sm text-slate-500">Submit requests, route approvals, and follow each decision.</p></div></div>
    </header>

    <section id="request-form" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><Plus size={18} />{resubmitId ? "Revise returned request" : "New purchase request"}</h2>
      <form onSubmit={saveRequest} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-600">Department<input className="form-input mt-1" value={requestDepartment} disabled /></label>
        <label className="text-sm text-slate-600">Priority<select className="form-input mt-1" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label className="text-sm text-slate-600 md:col-span-2">Request title<input className="form-input mt-1" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Monthly animal feeds" /></label>
        <label className="text-sm text-slate-600 md:col-span-2">Business reason<textarea className="form-input mt-1 min-h-20" required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
        <label className="text-sm text-slate-600">Item description<input className="form-input mt-1" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm text-slate-600">Quantity<input className="form-input mt-1" type="number" min="0.01" step="any" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label className="text-sm text-slate-600">Unit price (KES)<input className="form-input mt-1" type="number" min="0" step="0.01" required value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label></div>
        <div className="md:col-span-2 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-semibold text-slate-700">Estimated total: {formatMoney(Number(form.quantity) * Number(form.unitPrice))}</span><button disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Savingâ€¦" : resubmitId ? "Resubmit request" : "Submit for approval"}</button></div>
      </form>
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2"><ClipboardCheck size={19} className="text-primary-700" /><h2 className="text-lg font-semibold text-slate-900">Requests and approvals</h2></div>
      {loading ? <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Loading workflow inboxâ€¦</div> : requests.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No requests in your inbox yet.</div> : <div className="space-y-4">{requests.map((request) => {
        const currentStep = request.approvalSteps?.[request.currentStep];
        const isRequester = String(request.createdBy?._id) === String(user?._id);
        const canDecide = request.status === "pending_approval" && !isRequester && (isAdmin || currentStep?.approverRole === user?.role);
        return <article key={request._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{request.requestNumber} Â· {request.department}</p><h3 className="mt-1 text-lg font-semibold text-slate-900">{request.title}</h3><p className="mt-1 text-sm text-slate-600">{request.reason}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status] || "bg-slate-100 text-slate-700"}`}>{request.status.replaceAll("_", " ")}</span></div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600"><span>{request.createdBy?.name || "Requester"} Â· {request.department}</span><span>{request.items?.length || 0} line item(s)</span><span className="font-semibold text-slate-800">{formatMoney(request.totalAmount)}</span>{currentStep && request.status === "pending_approval" && <span>Awaiting {currentStep.label}</span>}</div>
          <div className="mt-4 flex flex-wrap gap-2">{request.approvalSteps?.map((step, index) => <span key={`${step.label}-${index}`} className={`rounded-full px-2.5 py-1 text-xs ${step.status === "approved" ? "bg-emerald-50 text-emerald-700" : index === request.currentStep && request.status === "pending_approval" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{step.label}: {step.status}</span>)}</div>
          {request.history?.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-slate-600">Decision history ({request.history.length})</summary><ol className="mt-2 space-y-2 border-l border-slate-200 pl-4">{request.history.map((entry, index) => <li key={`${entry._id || entry.at}-${index}`} className="text-sm text-slate-600"><span className="font-medium capitalize text-slate-800">{entry.action}</span> Â· {entry.by?.name || "User"} Â· {new Date(entry.at).toLocaleString()}{entry.comment && <p className="text-slate-500">{entry.comment}</p>}</li>)}</ol></details>}
          {request.status === "returned" && isRequester && <button className="mt-4 inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50" onClick={() => openResubmit(request)}><RotateCcw size={16} />Revise and resubmit</button>}
          {canDecide && <div className="mt-4 border-t border-slate-100 pt-4"><textarea className="form-input min-h-16" value={commentById[request._id] || ""} onChange={(event) => setCommentById((current) => ({ ...current, [request._id]: event.target.value }))} placeholder="Comment (required to return or reject)"/><div className="mt-3 flex justify-end gap-2"><button disabled={saving} onClick={() => decide(request, "return")} className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800"><RotateCcw size={15} className="mr-1 inline"/>Return</button><button disabled={saving} onClick={() => decide(request, "reject")} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"><X size={15} className="mr-1 inline"/>Reject</button><button disabled={saving} onClick={() => decide(request, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><Check size={15} className="mr-1 inline"/>Approve</button></div></div>}
        </article>;
      })}</div>}
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2"><ClipboardCheck size={19} className="text-primary-700" /><h2 className="text-lg font-semibold text-slate-900">Purchase orders, invoices, payments, and HMIS bills</h2></div>
      {loading ? <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">Loading cross-department tasksâ€¦</div> : lifecycleTasks.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No downstream approvals or submitted items are assigned to you.</div> : <div className="space-y-3">{lifecycleTasks.map((task) => <article key={`${task.workflowType}-${task.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{task.workflowType.replaceAll("_", " ")} Â· {task.department} Â· {task.reference}</p><h3 className="mt-1 font-semibold text-slate-900">{task.title}</h3><p className="mt-1 text-sm text-slate-600">{task.detail}</p></div><div className="text-right"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[task.status] || "bg-slate-100 text-slate-700"}`}>{task.status.replaceAll("_", " ")}</span><p className="mt-2 text-sm font-semibold text-slate-800">{formatMoney(task.amount)}</p></div></div>{task.documentUrl && <p className="mt-3 text-sm"><a className="font-medium text-primary-700 hover:underline" href={task.documentUrl} target="_blank" rel="noreferrer">Open supporting document</a></p>}<TaskLineItems task={task}/><p className="mt-3 text-xs text-slate-500">Submitted by {task.requestedBy}{task.approvalSteps?.[task.currentStep] && task.status === "pending_approval" ? ` Â· Awaiting ${task.approvalSteps[task.currentStep].label}` : ""}</p>{task.discrepancies?.length > 0 && <ul className="mt-3 list-disc rounded-lg bg-rose-50 px-8 py-3 text-sm text-rose-800">{task.discrepancies.map((problem) => <li key={problem}>{problem}</li>)}</ul>}<div className="mt-3 flex flex-wrap gap-2">{task.approvalSteps?.map((step, index) => <span key={`${step.label}-${index}`} className={`rounded-full px-2.5 py-1 text-xs ${step.status === "approved" ? "bg-emerald-50 text-emerald-700" : index === task.currentStep && task.status === "pending_approval" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{step.label}: {step.status}</span>)}</div>{task.history?.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-slate-600">Audit history ({task.history.length})</summary><ol className="mt-2 space-y-2 border-l border-slate-200 pl-4">{task.history.map((entry, index) => <li key={`${entry.at}-${index}`} className="text-sm text-slate-600"><span className="font-medium capitalize text-slate-800">{entry.action.replaceAll("_", " ")}</span> · {entry.by} · {new Date(entry.at).toLocaleString()}{entry.comment && <p>{entry.comment}</p>}</li>)}</ol></details>}{task.status === "returned" && task.requestedById === String(user?._id) && <button className="mt-4 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800" onClick={() => openTaskResubmit(task)}>Revise and resubmit</button>}{editingTask?.id === task.id && <form onSubmit={saveTaskResubmit} className="mt-4 space-y-3 rounded-lg bg-orange-50 p-4"><p className="text-sm font-semibold text-orange-900">Revise returned {task.label || task.workflowType.replaceAll("_", " ")}</p>{["supplier_payment", "finance_transaction"].includes(task.workflowType) && <label className="block text-sm">Amount<input type="number" min="0.01" step="0.01" required className="form-input mt-1" value={taskDraft.amount} onChange={(event) => setTaskDraft({ ...taskDraft, amount: event.target.value })}/></label>}{task.workflowType === "supplier_invoice" && <label className="block text-sm">Invoice number<input required className="form-input mt-1" value={taskDraft.invoiceNumber} onChange={(event) => setTaskDraft({ ...taskDraft, invoiceNumber: event.target.value })}/></label>}{["purchase_order", "supplier_invoice", "hmis_bill"].includes(task.workflowType) && taskDraft.items?.map((item, index) => <div key={index} className="grid grid-cols-2 gap-3"><label className="text-sm">{item.description} quantity<input type="number" min="0" step="any" className="form-input mt-1" value={task.workflowType === "purchase_order" ? item.quantity : taskDraft.items[index].quantity} onChange={(event) => task.workflowType === "purchase_order" ? null : setTaskDraft({ ...taskDraft, items: taskDraft.items.map((line, i) => i === index ? { ...line, quantity: event.target.value } : line) })} disabled={task.workflowType === "purchase_order"}/></label><label className="text-sm">Unit rate<input type="number" min="0" step="0.01" className="form-input mt-1" value={task.workflowType === "purchase_order" ? taskDraft.unitPrices[index] : item.unitPrice} onChange={(event) => task.workflowType === "purchase_order" ? setTaskDraft({ ...taskDraft, unitPrices: taskDraft.unitPrices.map((price, i) => i === index ? event.target.value : price) }) : setTaskDraft({ ...taskDraft, items: taskDraft.items.map((line, i) => i === index ? { ...line, unitPrice: event.target.value } : line) })}/></label></div>)}<div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">Resubmit</button><button type="button" onClick={() => setEditingTask(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button></div></form>}{task.canDecide && <div className="mt-4 border-t border-slate-100 pt-4"><textarea className="form-input min-h-16" value={commentById[task.id] || ""} onChange={(event) => setCommentById((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Comment (required to return or reject)"/><div className="mt-3 flex justify-end gap-2"><button disabled={saving} onClick={() => decideTask(task, "return")} className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800">Return</button><button disabled={saving || task.matchStatus === "discrepancy"} onClick={() => decideTask(task, "reject")} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700">Reject</button><button disabled={saving || task.matchStatus === "discrepancy"} onClick={() => decideTask(task, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Approve</button>{task.matchStatus === "discrepancy" && <span className="self-center text-xs text-rose-700">Resolve the 3-way match before Finance approval.</span>}</div></div>}</article>)}</div>}
    </section>

    {isAdmin && <section id="policy-form" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><CircleDollarSign size={18}/>Approval policy configuration</h2><p className="mb-4 text-sm text-slate-500">Configure approval stages and KES amount bands for each department and process.</p><form onSubmit={savePolicy} className="grid gap-3 md:grid-cols-2"><select className="form-input" value={policyForm.workflowType} onChange={(event) => setPolicyForm({ ...policyForm, workflowType: event.target.value })}>{workflowTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><input className="form-input" required placeholder="Policy name" value={policyForm.name} onChange={(event) => setPolicyForm({ ...policyForm, name: event.target.value })}/><input className="form-input" required placeholder="Department (e.g. Livestock, finance, hmis)" value={policyForm.department} onChange={(event) => setPolicyForm({ ...policyForm, department: event.target.value })}/><input className="form-input" type="number" min="0" placeholder="Minimum amount (KES)" value={policyForm.minAmount} onChange={(event) => setPolicyForm({ ...policyForm, minAmount: event.target.value })}/><input className="form-input" type="number" min="0" placeholder="Maximum amount (blank = no limit)" value={policyForm.maxAmount} onChange={(event) => setPolicyForm({ ...policyForm, maxAmount: event.target.value })}/><input className="form-input md:col-span-2" required placeholder="Approval roles in order: manager,finance,procurement" value={policyForm.roleChain} onChange={(event) => setPolicyForm({ ...policyForm, roleChain: event.target.value })}/><div className="md:col-span-2 flex justify-end gap-2">{editingPolicyId && <button type="button" onClick={() => { setEditingPolicyId(null); setPolicyForm({ workflowType: "purchase_request", name: "", department: user?.department || "", minAmount: 0, maxAmount: "", roleChain: "manager,finance,procurement" }); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Cancel edit</button>}<button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{editingPolicyId ? "Update policy" : "Save policy"}</button></div></form><div className="mt-5 divide-y divide-slate-100">{policies.map((policy) => <div key={policy._id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium text-slate-800">{policy.name} Â· {policy.workflowType.replaceAll("_", " ")} Â· {policy.department}</p><p className="text-xs text-slate-500">{formatMoney(policy.minAmount)} â€“ {policy.maxAmount == null ? "No upper limit" : formatMoney(policy.maxAmount)} Â· {policy.steps.map((step) => step.approverRole).join(" â†’ ")}</p></div><div className="flex gap-3"><button onClick={() => editPolicy(policy)} className="text-sm font-medium text-primary-700">Edit</button><button onClick={() => removePolicy(policy)} className="text-sm font-medium text-rose-700">Delete</button></div></div>)}</div></section>}
  </div>;
};

export default WorkflowInboxPage;
