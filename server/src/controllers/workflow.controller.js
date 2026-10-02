import { randomInt } from "node:crypto";
import PurchaseRequest from "../models/PurchaseRequest.js";
import WorkflowPolicy from "../models/WorkflowPolicy.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SupplierInvoice from "../models/SupplierInvoice.js";
import SupplierPayment from "../models/SupplierPayment.js";
import MedicalBill from "../models/MedicalBill.js";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import Supplier from "../models/Supplier.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import { applyWorkflowDecision, canApproveStep, getApprovalSteps, isWorkflowAdmin } from "../services/approvalWorkflow.service.js";

const isAdmin = (role) => ["admin", "super_admin"].includes(role);
const departmentFor = (user) => (user.department || user.role || "").trim();
const canActOnStep = (request, user, step) =>
  isAdmin(user.role) || (
    step?.approverRole === user.role &&
    (step.approverRole !== "manager" || step.approverDepartment?.toLowerCase() === departmentFor(user).toLowerCase())
  );

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Add at least one request item");
  return items.map((item) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Each item needs a description, positive quantity, and valid unit price");
    }
    return { description, quantity, unitPrice, total: quantity * unitPrice };
  });
};

const createOrResubmit = async ({ body, user, existing }) => {
  const items = normalizeItems(body.items);
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const department = existing?.department || departmentFor(user);
  if (!department) throw new Error("Your account needs a department before submitting requests");
  const policies = await WorkflowPolicy.find({ workflowType: "purchase_request", department: department.toLowerCase(), isActive: true }).sort({ minAmount: -1 });
  const policy = policies.find((candidate) => totalAmount >= candidate.minAmount && (candidate.maxAmount == null || totalAmount <= candidate.maxAmount));
  if (!policy) throw Object.assign(new Error(`No active approval policy covers ${department} requests of this amount`), { status: 409 });

  const title = String(body.title || "").trim();
  const reason = String(body.reason || "").trim();
  if (!title || !reason) throw new Error("A request title and business reason are required");

  const approvalSteps = policy.steps.map(({ label, approverRole }) => ({
    label, approverRole,
    approverDepartment: approverRole === "manager" ? department : undefined,
    status: "pending",
  }));
  if (existing) {
    existing.title = title;
    existing.reason = reason;
    existing.priority = body.priority || existing.priority;
    existing.items = items;
    existing.totalAmount = totalAmount;
    existing.policy = policy._id;
    existing.approvalSteps = approvalSteps;
    existing.currentStep = 0;
    existing.status = "pending_approval";
    existing.history.push({ action: "resubmitted", by: user._id });
    return existing.save();
  }

  const requestNumber = `PR-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`;
  return PurchaseRequest.create({
    requestNumber, department, title, reason,
    priority: body.priority || "normal", items, totalAmount,
    createdBy: user._id, policy: policy._id, approvalSteps,
    history: [{ action: "submitted", by: user._id }],
  });
};

export const listPurchaseRequests = async (req, res, next) => {
  try {
    const requests = await PurchaseRequest.find()
      .populate("createdBy", "name email role department")
      .populate("history.by", "name role department")
      .sort({ updatedAt: -1 });
    const visible = requests.filter((request) => {
      if (isAdmin(req.user.role) || String(request.createdBy?._id) === String(req.user._id)) return true;
      if (req.user.role === "procurement" && request.status === "approved") return true;
      if (request.status !== "pending_approval") return false;
      return canActOnStep(request, req.user, request.approvalSteps[request.currentStep]);
    });
    const data = visible.map((request) => {
      const requesterId = request.createdBy?._id || request.createdBy;
      return {
        ...request.toObject(),
        canDecide: request.status === "pending_approval" && String(requesterId) !== String(req.user._id) && canActOnStep(request, req.user, request.approvalSteps[request.currentStep]),
      };
    });
    res.json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

export const submitPurchaseRequest = async (req, res) => {
  try {
    const request = await createOrResubmit({ body: req.body, user: req.user });
    res.status(201).json({ success: true, message: "Purchase request submitted for approval", data: request });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

export const resubmitPurchaseRequest = async (req, res) => {
  try {
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Purchase request not found" });
    if (String(request.createdBy) !== String(req.user._id) || request.status !== "returned") {
      return res.status(403).json({ success: false, message: "Only the requester can revise and resubmit a returned request" });
    }
    const updated = await createOrResubmit({ body: req.body, user: req.user, existing: request });
    res.json({ success: true, message: "Request resubmitted for approval", data: updated });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

export const decidePurchaseRequest = async (req, res, next) => {
  try {
    const { decision, comment = "" } = req.body;
    if (!["approve", "reject", "return"].includes(decision)) return res.status(400).json({ success: false, message: "Choose approve, reject, or return" });
    if (["reject", "return"].includes(decision) && !String(comment).trim()) return res.status(400).json({ success: false, message: "Add a comment when rejecting or returning a request" });
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Purchase request not found" });
    const step = request.approvalSteps[request.currentStep];
    if (request.status !== "pending_approval" || !step || !canActOnStep(request, req.user, step)) {
      return res.status(403).json({ success: false, message: "This request is not assigned to your approval role" });
    }
    if (String(request.createdBy) === String(req.user._id)) return res.status(403).json({ success: false, message: "You cannot approve your own request" });

    const action = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "returned";
    step.status = action;
    step.decidedBy = req.user._id;
    step.decidedAt = new Date();
    step.comment = String(comment).trim();
    request.history.push({ action, by: req.user._id, comment: step.comment, stepLabel: step.label });
    if (decision === "reject") request.status = "rejected";
    else if (decision === "return") request.status = "returned";
    else if (request.currentStep + 1 >= request.approvalSteps.length) request.status = "approved";
    else request.currentStep += 1;
    await request.save();
    res.json({ success: true, message: `Request ${action}`, data: request });
  } catch (error) { next(error); }
};

export const listWorkflowPolicies = async (req, res, next) => {
  try {
    const policies = await WorkflowPolicy.find().sort({ department: 1, minAmount: 1 });
    res.json({ success: true, data: policies });
  } catch (error) { next(error); }
};

export const saveWorkflowPolicy = async (req, res) => {
  try {
    const { workflowType = "purchase_request", name, department, minAmount = 0, maxAmount = null, steps, isActive = true } = req.body;
    if (!String(name || "").trim() || !String(department || "").trim() || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ success: false, message: "Policy name, department, and at least one approval step are required" });
    }
    if (maxAmount != null && Number(maxAmount) < Number(minAmount)) return res.status(400).json({ success: false, message: "Maximum amount must be greater than or equal to minimum amount" });
    const payload = {
      workflowType, name: String(name).trim(), department: String(department).trim().toLowerCase(),
      minAmount: Number(minAmount), maxAmount: maxAmount == null || maxAmount === "" ? null : Number(maxAmount),
      steps, isActive: Boolean(isActive), createdBy: req.user._id,
    };
    const policy = req.params.id
      ? await WorkflowPolicy.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      : await WorkflowPolicy.create(payload);
    if (!policy) return res.status(404).json({ success: false, message: "Approval policy not found" });
    res.status(200).json({ success: true, data: policy });
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ success: false, message: error.code === 11000 ? "A policy already exists for this department and amount range" : error.message }); }
};

export const deleteWorkflowPolicy = async (req, res) => {
  try {
    const policy = await WorkflowPolicy.findByIdAndDelete(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: "Approval policy not found" });
    res.json({ success: true, message: "Approval policy deleted" });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const taskModels = {
  purchase_order: { model: PurchaseOrder, requester: "requestedBy", label: "Purchase order" },
  supplier_invoice: { model: SupplierInvoice, requester: "submittedBy", label: "Supplier invoice" },
  supplier_payment: { model: SupplierPayment, requester: "requestedBy", label: "Supplier payment" },
  hmis_bill: { model: MedicalBill, requester: "createdBy", label: "HMIS bill" },
  finance_transaction: { model: Transaction, requester: "createdBy", label: "Finance transaction" },
};

export const listLifecycleTasks = async (req, res, next) => {
  try {
    const results = await Promise.all(Object.entries(taskModels).map(async ([workflowType, descriptor]) => {
      let query = descriptor.model.find().populate(descriptor.requester, "name role department");
      query = query.populate("history.by", "name role");
      if (["purchase_order", "supplier_invoice", "supplier_payment"].includes(workflowType)) query = query.populate("supplier", "name");
      if (workflowType === "finance_transaction") query = query.populate("account", "accountName accountCode");
      if (workflowType === "purchase_order") query = query.populate("purchaseRequest", "requestNumber");
      if (workflowType === "supplier_invoice") query = query.populate("purchaseOrder", "poNumber items totalAmount").populate("goodsReceipt", "receiptNumber items");
      if (workflowType === "supplier_payment") query = query.populate("invoice", "invoiceNumber totalAmount").populate("account", "accountName accountCode");
      const records = await query.sort({ updatedAt: -1 });
      return records.map((record) => {
        const current = record.approvalSteps?.[record.currentStep];
        const requester = record[descriptor.requester];
        const owned = String(requester?._id || requester) === String(req.user._id);
        const pending = workflowType === "finance_transaction" ? record.status === "pending" : record.status === "pending_approval";
        const assigned = pending && canApproveStep(req.user, current);
        const procurementApprovedRequest = workflowType === "purchase_order" && req.user.role === "procurement" && record.status === "approved";
        if (!isWorkflowAdmin(req.user.role) && !owned && !assigned && !procurementApprovedRequest) return null;
        const reference = record.poNumber || record.invoiceNumber || record.paymentNumber || record.billNumber || record.reference;
        const detail = workflowType === "purchase_order"
          ? `Supplier: ${record.supplier?.name || "—"} · Request ${record.purchaseRequest?.requestNumber || "—"}`
          : workflowType === "supplier_invoice"
            ? `3-way match: ${record.matchStatus}`
          : workflowType === "supplier_payment"
              ? `Supplier: ${record.supplier?.name || "—"} · Invoice ${record.invoice?.invoiceNumber || "—"} · Reference: ${record.reference}`
              : workflowType === "finance_transaction"
                ? `${record.type} · ${record.account?.accountName || "Finance account"}`
              : "Patient billing review";
        return {
          id: record._id,
          workflowType,
          label: descriptor.label,
          reference,
          title: `${descriptor.label} ${reference}`,
          department: record.department || (workflowType === "supplier_payment" ? "Finance" : "HMIS"),
          amount: record.totalAmount ?? record.amount,
          status: record.status,
          detail,
          requestedBy: requester?.name || "User",
          requestedById: String(requester?._id || requester),
          approvalSteps: record.approvalSteps,
          currentStep: record.currentStep,
          history: (record.history || []).map((entry) => ({ action: entry.action, comment: entry.comment, at: entry.at, stepLabel: entry.stepLabel, by: entry.by?.name || "User" })),
          canDecide: assigned && !owned,
          matchStatus: record.matchStatus,
          discrepancies: workflowType === "supplier_invoice" ? record.discrepancies : undefined,
          items: record.items?.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })),
          poReference: workflowType === "supplier_invoice" ? record.purchaseOrder?.poNumber : undefined,
          grnReference: workflowType === "supplier_invoice" ? record.goodsReceipt?.receiptNumber : undefined,
          receiptItems: workflowType === "supplier_invoice" ? record.goodsReceipt?.items?.map((item) => ({ description: item.description, receivedQuantity: item.receivedQuantity, acceptedQuantity: item.acceptedQuantity, damagedQuantity: item.damagedQuantity })) : undefined,
          documentUrl: record.quotationUrl || record.supportingDocumentUrl || undefined,
          updatedAt: record.updatedAt,
        };
      }).filter(Boolean);
    }));
    const tasks = results.flat().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) { next(error); }
};

export const decideLifecycleTask = async (req, res, next) => {
  try {
    const descriptor = taskModels[req.params.workflowType];
    if (!descriptor) return res.status(404).json({ success: false, message: "Unknown workflow type" });
    const record = await descriptor.model.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: "Workflow item not found" });
    const isPending = req.params.workflowType === "finance_transaction" ? record.status === "pending" : record.status === "pending_approval";
    if (!isPending) return res.status(409).json({ success: false, message: "This item is no longer awaiting approval" });
    if (req.params.workflowType === "supplier_invoice" && req.body.decision === "approve" && record.matchStatus !== "matched") {
      return res.status(409).json({ success: false, message: "Finance cannot approve an invoice until the PO, accepted goods, and invoice match" });
    }
    const completed = applyWorkflowDecision(record, req.user, req.body.decision, req.body.comment);
    if (completed && req.params.workflowType === "purchase_order") {
      record.status = "approved";
      record.approvedBy = req.user._id;
    }
    if (completed && req.params.workflowType === "finance_transaction") record.status = "posted";
    if (completed && req.params.workflowType === "supplier_payment") {
      const duplicate = await Transaction.findOne({ reference: `SUP-${record.paymentNumber}` });
      if (!duplicate) {
        const transaction = await Transaction.create({ reference: `SUP-${record.paymentNumber}`, type: "payment", account: record.account, amount: record.amount, transactionDate: record.paymentDate, description: `Supplier invoice payment ${record.invoice}`, status: "posted", createdBy: record.requestedBy });
        record.transaction = transaction._id;
      }
      const invoice = await SupplierInvoice.findById(record.invoice);
      if (invoice) {
        const paid = await SupplierPayment.aggregate([{ $match: { invoice: invoice._id, status: { $in: ["approved"] }, _id: { $ne: record._id } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
        invoice.status = (paid[0]?.amount || 0) + record.amount >= invoice.totalAmount ? "paid" : "partially_paid";
        await invoice.save();
      }
    }
    await record.save();
    res.json({ success: true, message: `Workflow item ${record.status.replaceAll("_", " ")}`, data: record });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

const normalizeWorkflowLines = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw Object.assign(new Error("Add at least one line item"), { status: 400 });
  return items.map((item) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error("Each line needs a description, positive quantity, and valid unit price"), { status: 400 });
    return { description, quantity, unitPrice, total: quantity * unitPrice };
  });
};

export const resubmitLifecycleTask = async (req, res) => {
  try {
    const type = req.params.workflowType;
    const descriptor = taskModels[type];
    if (!descriptor) return res.status(404).json({ success: false, message: "Unknown workflow type" });
    const record = await descriptor.model.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: "Workflow item not found" });
    const submitter = record[descriptor.requester];
    if (String(submitter) !== String(req.user._id) || record.status !== "returned") return res.status(403).json({ success: false, message: "Only the submitter can revise a returned workflow item" });

    let department = record.department || "finance";
    let amount = Number(record.totalAmount ?? record.amount);
    if (type === "purchase_order") {
      const supplier = await Supplier.findOne({ _id: req.body.supplier || record.supplier, status: "active" });
      if (!supplier) return res.status(400).json({ success: false, message: "Choose an active supplier" });
      const prices = Array.isArray(req.body.unitPrices) ? req.body.unitPrices : record.items.map((item) => item.unitPrice);
      record.items = record.items.map((item, index) => {
        const unitPrice = Number(prices[index]);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error("Quoted unit prices must be valid"), { status: 400 });
        return { description: item.description, quantity: item.quantity, unitPrice, total: item.quantity * unitPrice };
      });
      record.supplier = supplier._id;
      record.quotationUrl = String(req.body.quotationUrl || record.quotationUrl || "").trim();
      amount = record.items.reduce((sum, item) => sum + item.total, 0);
      record.subtotal = amount;
      record.totalAmount = amount + Number(record.tax || 0);
      amount = record.totalAmount;
    } else if (type === "supplier_invoice") {
      const order = await PurchaseOrder.findById(record.purchaseOrder);
      const receipt = await GoodsReceipt.findById(req.body.goodsReceipt || record.goodsReceipt);
      if (!order || !receipt || String(receipt.purchaseOrder) !== String(order._id)) return res.status(400).json({ success: false, message: "Choose a GRN linked to this purchase order" });
      const submittedItems = Array.isArray(req.body.items) ? req.body.items : record.items;
      if (submittedItems.length !== order.items.length) return res.status(400).json({ success: false, message: "Invoice lines must match the purchase order lines" });
      const discrepancies = [];
      const items = order.items.map((poLine, index) => {
        const quantity = Number(submittedItems[index].quantity);
        const unitPrice = Number(submittedItems[index].unitPrice);
        const accepted = Number(receipt.items.find((line) => line.poItemIndex === index)?.acceptedQuantity || 0);
        if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error("Invoice quantities and rates must be valid"), { status: 400 });
        if (quantity > accepted) discrepancies.push(`${poLine.description}: invoiced quantity exceeds accepted GRN quantity ${accepted}`);
        if (Math.abs(unitPrice - poLine.unitPrice) > 0.01) discrepancies.push(`${poLine.description}: invoice rate differs from the PO`);
        return { description: poLine.description, quantity, unitPrice, total: quantity * unitPrice };
      });
      if (!items.some((item) => item.quantity > 0)) return res.status(400).json({ success: false, message: "At least one invoice line must have a positive quantity" });
      const invoiceNumber = String(req.body.invoiceNumber || record.invoiceNumber).trim();
      const duplicate = await SupplierInvoice.findOne({ supplier: record.supplier, invoiceNumber, _id: { $ne: record._id } });
      if (duplicate) return res.status(409).json({ success: false, message: "That supplier invoice number is already recorded" });
      record.invoiceNumber = invoiceNumber;
      record.goodsReceipt = receipt._id;
      record.items = items;
      record.totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      record.matchStatus = discrepancies.length ? "discrepancy" : "matched";
      record.discrepancies = discrepancies;
      record.supportingDocumentUrl = String(req.body.supportingDocumentUrl || record.supportingDocumentUrl || "").trim();
      amount = record.totalAmount;
    } else if (type === "supplier_payment") {
      const invoice = await SupplierInvoice.findById(record.invoice);
      if (!invoice || !["approved", "partially_paid"].includes(invoice.status)) return res.status(409).json({ success: false, message: "The linked invoice is no longer payable" });
      const otherPayments = await SupplierPayment.aggregate([{ $match: { invoice: invoice._id, status: { $in: ["approved", "pending_approval"] }, _id: { $ne: record._id } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
      amount = Number(req.body.amount);
      const remaining = invoice.totalAmount - (otherPayments[0]?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) return res.status(400).json({ success: false, message: `Enter an amount up to KES ${remaining.toFixed(2)}` });
      const account = await Account.findOne({ _id: req.body.account || record.account, status: "active", accountType: "asset" });
      if (!account) return res.status(400).json({ success: false, message: "Choose an active finance account" });
      record.account = account._id;
      record.amount = amount;
      record.paymentMethod = req.body.paymentMethod || record.paymentMethod;
      record.reference = String(req.body.reference || record.reference).trim();
    } else if (type === "hmis_bill") {
      const items = normalizeWorkflowLines(req.body.items);
      record.items = items;
      record.totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      amount = record.totalAmount;
    } else if (type === "finance_transaction") {
      const account = await Account.findOne({ _id: req.body.account || record.account, status: "active", accountType: "asset" });
      if (!account) return res.status(400).json({ success: false, message: "Choose an active finance account" });
      amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than zero" });
      record.reference = String(req.body.reference || record.reference).trim();
      record.account = account._id;
      record.amount = amount;
      record.type = req.body.type || record.type;
      record.description = String(req.body.description ?? record.description ?? "").trim();
    }

    const { policyId, steps } = await getApprovalSteps({ workflowType: type, department, amount });
    record.policy = policyId;
    record.approvalSteps = steps;
    record.currentStep = 0;
    record.status = type === "finance_transaction" ? "pending" : "pending_approval";
    record.history.push({ action: "resubmitted", by: req.user._id, at: new Date() });
    await record.save();
    res.json({ success: true, message: "Revised item resubmitted for approval", data: record });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};
