import { randomInt } from "node:crypto";
import prisma from "../config/prisma.js";
import {
  applyWorkflowDecision,
  canApproveStep,
  getApprovalSteps,
  isWorkflowAdmin,
} from "../services/approvalWorkflow.service.js";
import { serializePrismaRecord } from "../utils/prismaRecords.js";

const isAdmin = (role) => ["admin", "super_admin"].includes(role);
const departmentFor = (user) => (user.department || user.role || "").trim();
const canActOnStep = (request, user, step) =>
  isAdmin(user.role) || (
    step?.approverRole === user.role &&
    (step.approverRole !== "manager" ||
      step.approverDepartment?.toLowerCase() === departmentFor(user).toLowerCase())
  );

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Add at least one request item");
  return items.map((item) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Each item needs a description, positive quantity, and valid unit price");
    }
    return { description, quantity, unitPrice, total: quantity * unitPrice };
  });
};

const normalizeWorkflowLines = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error("Add at least one line item"), { status: 400 });
  }
  return items.map((item) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw Object.assign(new Error("Each line needs a description, positive quantity, and valid unit price"), { status: 400 });
    }
    return { description, quantity, unitPrice, total: quantity * unitPrice };
  });
};

const requestInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true, department: true } },
  items: true,
};

const createOrResubmit = async ({ body, user, existingId }) => {
  const items = normalizeItems(body.items);
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const existing = existingId
    ? await prisma.purchaseRequest.findUnique({ where: { id: existingId }, include: { items: true } })
    : null;
  if (existingId && !existing) {
    const error = new Error("Purchase request not found");
    error.status = 404;
    throw error;
  }
  const department = existing?.department ||
    (user.role === "receptionist" ? String(body.department || "").trim() : departmentFor(user));
  if (!department) throw new Error("Your account needs a department before submitting requests");
  const policies = await prisma.workflowPolicy.findMany({
    where: { workflowType: "purchase_request", department: department.toLowerCase(), isActive: true },
    orderBy: { minAmount: "desc" },
  });
  const policy = policies.find((candidate) =>
    totalAmount >= Number(candidate.minAmount) &&
    (candidate.maxAmount == null || totalAmount <= Number(candidate.maxAmount)));
  const title = String(body.title || "").trim();
  const reason = String(body.reason || "").trim();
  if (!title || !reason) throw new Error("A request title and business reason are required");

  const approvalSteps = [{ label: "Procurement approval", approverRole: "procurement", status: "pending" }];
  const now = new Date().toISOString();
  const userId = user.id;
  const data = {
    title,
    reason,
    priority: body.priority || existing?.priority || "normal",
    totalAmount,
    policyId: policy?.id || null,
    approvalSteps,
    currentStep: 0,
    status: "pending_approval",
    history: [
      ...(Array.isArray(existing?.history) ? existing.history : []),
      { action: existing ? "resubmitted" : "submitted", by: userId, at: now },
    ],
    items: { deleteMany: {}, create: items },
  };
  if (existing) {
    return prisma.purchaseRequest.update({
      where: { id: existing.id },
      data,
      include: requestInclude,
    });
  }
  return prisma.purchaseRequest.create({
    data: {
      ...data,
      requestNumber: `PR-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
      department,
      createdById: userId,
    },
    include: requestInclude,
  });
};

export const listPurchaseRequests = async (req, res, next) => {
  try {
    const requests = await prisma.purchaseRequest.findMany({
      include: requestInclude,
      orderBy: { updatedAt: "desc" },
    });
    const userById = await usersForHistory(requests);
    const visible = requests.filter((request) => {
      if (isAdmin(req.user.role) || request.createdById === req.user.id) return true;
      if (req.user.role === "procurement" && request.status === "approved") return true;
      if (request.status !== "pending_approval") return false;
      return canActOnStep(request, req.user, request.approvalSteps?.[request.currentStep]);
    });
    const data = visible.map((request) => {
      const serialized = serializePrismaRecord(request);
      serialized.history = (request.history || []).map((entry) => ({
        ...entry,
        by: userById.get(entry.by) || entry.by,
      }));
      return {
        ...serialized,
        canDecide: request.status === "pending_approval" &&
          request.createdById !== req.user.id &&
          canActOnStep(request, req.user, request.approvalSteps?.[request.currentStep]),
      };
    });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const submitPurchaseRequest = async (req, res) => {
  try {
    const request = await createOrResubmit({ body: req.body, user: req.user });
    res.status(201).json({
      success: true,
      message: "Purchase request submitted for approval",
      data: serializePrismaRecord(request),
    });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const resubmitPurchaseRequest = async (req, res) => {
  try {
    const existing = await prisma.purchaseRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Purchase request not found" });
    if (existing.createdById !== req.user.id || existing.status !== "returned") {
      return res.status(403).json({
        success: false,
        message: "Only the requester can revise and resubmit a returned request",
      });
    }
    const updated = await createOrResubmit({
      body: req.body,
      user: req.user,
      existingId: existing.id,
    });
    return res.json({
      success: true,
      message: "Request resubmitted for approval",
      data: serializePrismaRecord(updated),
    });
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

export const decidePurchaseRequest = async (req, res, next) => {
  try {
    const { decision, comment = "" } = req.body;
    if (!["approve", "reject", "return"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Choose approve, reject, or return" });
    }
    if (["reject", "return"].includes(decision) && !String(comment).trim()) {
      return res.status(400).json({
        success: false,
        message: "Add a comment when rejecting or returning a request",
      });
    }
    const result = await prisma.$transaction(async (transaction) => {
      const request = await transaction.purchaseRequest.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!request) return { status: 404, message: "Purchase request not found" };
      const step = request.approvalSteps?.[request.currentStep];
      if (request.status !== "pending_approval" || !step ||
          !canActOnStep(request, req.user, step)) {
        return { status: 403, message: "This request is not assigned to your approval role" };
      }
      if (request.createdById === req.user.id) {
        return { status: 403, message: "You cannot approve your own request" };
      }
      const action = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "returned";
      const approvalSteps = [...request.approvalSteps];
      approvalSteps[request.currentStep] = {
        ...step,
        status: action,
        decidedBy: req.user.id,
        decidedAt: new Date().toISOString(),
        comment: String(comment).trim(),
      };
      const history = Array.isArray(request.history) ? request.history : [];
      let status = request.status;
      let currentStep = request.currentStep;
      if (decision === "reject") status = "rejected";
      else if (decision === "return") status = "returned";
      else if (currentStep + 1 >= approvalSteps.length) status = "approved";
      else currentStep += 1;
      const updated = await transaction.purchaseRequest.update({
        where: { id: request.id },
        data: {
          approvalSteps,
          history: [...history, {
            action,
            by: req.user.id,
            at: new Date().toISOString(),
            comment: String(comment).trim(),
            stepLabel: step.label,
          }],
          currentStep,
          status,
        },
        include: requestInclude,
      });
      return { request: updated, action };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      message: `Request ${result.action}`,
      data: serializePrismaRecord(result.request),
    });
  } catch (error) {
    return next(error);
  }
};

export const listWorkflowPolicies = async (req, res, next) => {
  try {
    const policies = await prisma.workflowPolicy.findMany({
      orderBy: [{ department: "asc" }, { minAmount: "asc" }],
    });
    res.json({ success: true, data: serializePrismaRecord(policies) });
  } catch (error) {
    next(error);
  }
};

export const saveWorkflowPolicy = async (req, res) => {
  try {
    const {
      workflowType = "purchase_request",
      name,
      department,
      minAmount = 0,
      maxAmount = null,
      steps,
      isActive = true,
    } = req.body;
    if (!String(name || "").trim() || !String(department || "").trim() ||
        !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Policy name, department, and at least one approval step are required",
      });
    }
    if (maxAmount != null && Number(maxAmount) < Number(minAmount)) {
      return res.status(400).json({
        success: false,
        message: "Maximum amount must be greater than or equal to minimum amount",
      });
    }
    const payload = {
      workflowType,
      name: String(name).trim(),
      department: String(department).trim().toLowerCase(),
      minAmount: Number(minAmount),
      maxAmount: maxAmount == null || maxAmount === "" ? null : Number(maxAmount),
      steps,
      isActive: Boolean(isActive),
    };
    const policy = req.params.id
      ? await prisma.workflowPolicy.update({ where: { id: req.params.id }, data: payload }).catch((error) => {
        if (error.code === "P2025") return null;
        throw error;
      })
      : await prisma.workflowPolicy.create({
        data: { ...payload, createdById: req.user.id },
      });
    if (!policy) return res.status(404).json({ success: false, message: "Approval policy not found" });
    return res.status(200).json({ success: true, data: serializePrismaRecord(policy) });
  } catch (error) {
    const duplicate = error.code === "P2002";
    return res.status(duplicate ? 409 : 400).json({
      success: false,
      message: duplicate
        ? "A policy already exists for this department and amount range"
        : error.message,
    });
  }
};

export const deleteWorkflowPolicy = async (req, res) => {
  try {
    const policy = await prisma.workflowPolicy.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!policy) return res.status(404).json({ success: false, message: "Approval policy not found" });
    return res.json({ success: true, message: "Approval policy deleted" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const taskModels = {
  purchase_order: {
    delegate: "purchaseOrder",
    requester: "requestedBy",
    label: "Purchase order",
    include: {
      requestedBy: { select: { id: true, name: true, role: true, department: true } },
      supplier: { select: { id: true, name: true } },
      purchaseRequest: { select: { id: true, requestNumber: true } },
      items: true,
    },
  },
  supplier_invoice: {
    delegate: "supplierInvoice",
    requester: "submittedBy",
    label: "Supplier invoice",
    include: {
      submittedBy: { select: { id: true, name: true, role: true, department: true } },
      supplier: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, poNumber: true, totalAmount: true, items: true } },
      goodsReceipt: { select: { id: true, receiptNumber: true, items: true } },
      items: true,
    },
  },
  supplier_payment: {
    delegate: "supplierPayment",
    requester: "requestedBy",
    label: "Supplier payment",
    include: {
      requestedBy: { select: { id: true, name: true, role: true, department: true } },
      supplier: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
      account: { select: { id: true, accountName: true, accountCode: true } },
    },
  },
  hmis_bill: {
    delegate: "medicalBill",
    requester: "createdBy",
    label: "HMIS bill",
    include: {
      createdBy: { select: { id: true, name: true, role: true, department: true } },
      items: true,
    },
  },
  finance_transaction: {
    delegate: "transaction",
    requester: "createdBy",
    label: "Finance transaction",
    include: {
      createdBy: { select: { id: true, name: true, role: true, department: true } },
      account: { select: { id: true, accountName: true, accountCode: true } },
    },
  },
};

const usersForHistory = async (records) => {
  const ids = [...new Set(records.flatMap((record) =>
    (Array.isArray(record.history) ? record.history : [])
      .map((entry) => entry.by)
      .filter((id) => typeof id === "string")))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, role: true, department: true },
  });
  return new Map(users.map((user) => [user.id, user]));
};

export const listLifecycleTasks = async (req, res, next) => {
  try {
    const results = await Promise.all(Object.entries(taskModels).map(async ([workflowType, descriptor]) => {
      const records = await prisma[descriptor.delegate].findMany({
        include: descriptor.include,
        orderBy: { updatedAt: "desc" },
      });
      const userById = await usersForHistory(records);
      return records.map((record) => {
        const current = record.approvalSteps?.[record.currentStep];
        const requester = record[descriptor.requester];
        const requesterId = record[`${descriptor.requester}Id`];
        const owned = requesterId === req.user.id;
        const pending = workflowType === "finance_transaction"
          ? record.status === "pending"
          : record.status === "pending_approval";
        const assigned = pending && canApproveStep(req.user, current);
        const procurementApprovedRequest = workflowType === "purchase_order" &&
          req.user.role === "procurement" && record.status === "approved";
        if (!isWorkflowAdmin(req.user.role) && !owned && !assigned && !procurementApprovedRequest) {
          return null;
        }
        const reference = record.poNumber || record.invoiceNumber || record.paymentNumber ||
          record.billNumber || record.reference;
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
          id: record.id,
          workflowType,
          label: descriptor.label,
          reference,
          title: `${descriptor.label} ${reference}`,
          department: record.department || (workflowType === "supplier_payment" ? "Finance" : "HMIS"),
          amount: record.totalAmount ?? record.amount,
          status: record.status,
          detail,
          requestedBy: requester?.name || "User",
          requestedById: requesterId,
          approvalSteps: record.approvalSteps,
          currentStep: record.currentStep,
          history: (record.history || []).map((entry) => ({
            action: entry.action,
            comment: entry.comment,
            at: entry.at,
            stepLabel: entry.stepLabel,
            by: userById.get(entry.by)?.name || "User",
          })),
          canDecide: assigned && !owned,
          matchStatus: record.matchStatus,
          discrepancies: workflowType === "supplier_invoice" ? record.discrepancies : undefined,
          items: record.items?.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
          poReference: workflowType === "supplier_invoice" ? record.purchaseOrder?.poNumber : undefined,
          grnReference: workflowType === "supplier_invoice" ? record.goodsReceipt?.receiptNumber : undefined,
          receiptItems: workflowType === "supplier_invoice"
            ? record.goodsReceipt?.items?.map((item) => ({
              description: item.description,
              receivedQuantity: item.receivedQuantity,
              acceptedQuantity: item.acceptedQuantity,
              damagedQuantity: item.damagedQuantity,
            }))
            : undefined,
          documentUrl: record.quotationUrl || record.supportingDocumentUrl || undefined,
          updatedAt: record.updatedAt,
        };
      }).filter(Boolean);
    }));
    const tasks = results.flat().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ success: true, count: tasks.length, data: serializePrismaRecord(tasks) });
  } catch (error) {
    next(error);
  }
};

export const decideLifecycleTask = async (req, res, next) => {
  try {
    const descriptor = taskModels[req.params.workflowType];
    if (!descriptor) return res.status(404).json({ success: false, message: "Unknown workflow type" });
    const result = await prisma.$transaction(async (transaction) => {
      const model = transaction[descriptor.delegate];
      const record = await model.findUnique({ where: { id: req.params.id } });
      if (!record) return { status: 404, message: "Workflow item not found" };
      const isPending = req.params.workflowType === "finance_transaction"
        ? record.status === "pending"
        : record.status === "pending_approval";
      if (!isPending) {
        return { status: 409, message: "This item is no longer awaiting approval" };
      }
      if (req.params.workflowType === "supplier_invoice" &&
          req.body.decision === "approve" && record.matchStatus !== "matched") {
        return {
          status: 409,
          message: "Finance cannot approve an invoice until the PO, accepted goods, and invoice match",
        };
      }
      const mutable = {
        ...record,
        history: Array.isArray(record.history) ? [...record.history] : [],
        approvalSteps: Array.isArray(record.approvalSteps) ? record.approvalSteps.map((step) => ({ ...step })) : [],
      };
      const completed = applyWorkflowDecision(
        mutable,
        req.user,
        req.body.decision,
        req.body.comment,
      );
      const update = {
        approvalSteps: mutable.approvalSteps.map((step) => ({
          ...step,
          decidedAt: step.decidedAt instanceof Date ? step.decidedAt.toISOString() : step.decidedAt,
        })),
        currentStep: mutable.currentStep,
        history: mutable.history.map((entry) => ({
          ...entry,
          at: entry.at instanceof Date ? entry.at.toISOString() : entry.at,
        })),
        status: mutable.status,
      };
      if (completed && req.params.workflowType === "purchase_order") {
        update.status = "approved";
        update.approvedById = req.user.id;
      }
      if (completed && req.params.workflowType === "finance_transaction") update.status = "posted";
      if (completed && req.params.workflowType === "supplier_payment") {
        const payment = record;
        let ledgerTransaction = await transaction.transaction.findUnique({
          where: { reference: `SUP-${payment.paymentNumber}` },
        });
        if (!ledgerTransaction) {
          ledgerTransaction = await transaction.transaction.create({
            data: {
              reference: `SUP-${payment.paymentNumber}`,
              type: "payment",
              accountId: payment.accountId,
              amount: payment.amount,
              transactionDate: payment.paymentDate,
              description: `Supplier invoice payment ${payment.invoiceId}`,
              status: "posted",
              createdById: payment.requestedById,
            },
          });
        }
        update.transactionId = ledgerTransaction.id;
        const approvedPayments = await transaction.supplierPayment.findMany({
          where: { invoiceId: payment.invoiceId, status: "approved", id: { not: payment.id } },
          select: { amount: true },
        });
        const paid = approvedPayments.reduce((sum, item) => sum + Number(item.amount), 0) + Number(payment.amount);
        const invoice = await transaction.supplierInvoice.findUnique({
          where: { id: payment.invoiceId },
        });
        if (invoice) {
          await transaction.supplierInvoice.update({
            where: { id: invoice.id },
            data: { status: paid >= Number(invoice.totalAmount) ? "paid" : "partially_paid" },
          });
        }
      }
      const updated = await model.update({
        where: { id: record.id },
        data: update,
      });
      return { record: updated };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      message: `Workflow item ${result.record.status.replaceAll("_", " ")}`,
      data: serializePrismaRecord(result.record),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

const replaceItems = (items) => ({ deleteMany: {}, create: items });

export const resubmitLifecycleTask = async (req, res) => {
  try {
    const type = req.params.workflowType;
    const descriptor = taskModels[type];
    if (!descriptor) return res.status(404).json({ success: false, message: "Unknown workflow type" });
    const result = await prisma.$transaction(async (transaction) => {
      const model = transaction[descriptor.delegate];
      const record = await model.findUnique({
        where: { id: req.params.id },
        include: descriptor.include,
      });
      if (!record) return { status: 404, message: "Workflow item not found" };
      const submitterId = record[`${descriptor.requester}Id`];
      if (submitterId !== req.user.id || record.status !== "returned") {
        return {
          status: 403,
          message: "Only the submitter can revise a returned workflow item",
        };
      }

      let department = record.department || "finance";
      let amount = Number(record.totalAmount ?? record.amount);
      const update = {};
      if (type === "purchase_order") {
        const supplier = await transaction.supplier.findFirst({
          where: { id: req.body.supplier || record.supplierId, status: "active" },
        });
        if (!supplier) return { status: 400, message: "Choose an active supplier" };
        const prices = Array.isArray(req.body.unitPrices)
          ? req.body.unitPrices
          : record.items.map((item) => item.unitPrice);
        const items = record.items.map((item, index) => {
          const unitPrice = Number(prices[index]);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw Object.assign(new Error("Quoted unit prices must be valid"), { status: 400 });
          }
          return {
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice,
            total: Number(item.quantity) * unitPrice,
          };
        });
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        update.supplierId = supplier.id;
        update.quotationUrl = String(req.body.quotationUrl || record.quotationUrl || "").trim();
        update.subtotal = subtotal;
        update.totalAmount = subtotal + Number(record.tax || 0);
        update.items = replaceItems(items);
        amount = Number(update.totalAmount);
      } else if (type === "supplier_invoice") {
        const order = await transaction.purchaseOrder.findUnique({
          where: { id: record.purchaseOrderId },
          include: { items: true },
        });
        const receipt = await transaction.goodsReceipt.findUnique({
          where: { id: req.body.goodsReceipt || record.goodsReceiptId },
          include: { items: true },
        });
        if (!order || !receipt || receipt.purchaseOrderId !== order.id) {
          return { status: 400, message: "Choose a GRN linked to this purchase order" };
        }
        const submittedItems = Array.isArray(req.body.items) ? req.body.items : record.items;
        if (submittedItems.length !== order.items.length) {
          return { status: 400, message: "Invoice lines must match the purchase order lines" };
        }
        const discrepancies = [];
        const items = order.items.map((poLine, index) => {
          const quantity = Number(submittedItems[index].quantity);
          const unitPrice = Number(submittedItems[index].unitPrice);
          const accepted = Number(receipt.items.find((line) =>
            line.poItemIndex === index)?.acceptedQuantity || 0);
          if (!Number.isFinite(quantity) || quantity < 0 ||
              !Number.isFinite(unitPrice) || unitPrice < 0) {
            throw Object.assign(new Error("Invoice quantities and rates must be valid"), { status: 400 });
          }
          if (quantity > accepted) {
            discrepancies.push(`${poLine.description}: invoiced quantity exceeds accepted GRN quantity ${accepted}`);
          }
          if (Math.abs(unitPrice - Number(poLine.unitPrice)) > 0.01) {
            discrepancies.push(`${poLine.description}: invoice rate differs from the PO`);
          }
          return {
            description: poLine.description,
            quantity,
            unitPrice,
            total: quantity * unitPrice,
          };
        });
        if (!items.some((item) => item.quantity > 0)) {
          return { status: 400, message: "At least one invoice line must have a positive quantity" };
        }
        const invoiceNumber = String(req.body.invoiceNumber || record.invoiceNumber).trim();
        const duplicate = await transaction.supplierInvoice.findFirst({
          where: {
            supplierId: record.supplierId,
            invoiceNumber,
            id: { not: record.id },
          },
        });
        if (duplicate) {
          return { status: 409, message: "That supplier invoice number is already recorded" };
        }
        update.invoiceNumber = invoiceNumber;
        update.goodsReceiptId = receipt.id;
        update.items = replaceItems(items);
        update.totalAmount = items.reduce((sum, item) => sum + item.total, 0);
        update.matchStatus = discrepancies.length ? "discrepancy" : "matched";
        update.discrepancies = discrepancies;
        update.supportingDocumentUrl = String(
          req.body.supportingDocumentUrl || record.supportingDocumentUrl || "",
        ).trim();
        amount = Number(update.totalAmount);
      } else if (type === "supplier_payment") {
        const invoice = await transaction.supplierInvoice.findUnique({
          where: { id: record.invoiceId },
        });
        if (!invoice || !["approved", "partially_paid"].includes(invoice.status)) {
          return { status: 409, message: "The linked invoice is no longer payable" };
        }
        const otherPayments = await transaction.supplierPayment.findMany({
          where: {
            invoiceId: invoice.id,
            status: { in: ["approved", "pending_approval"] },
            id: { not: record.id },
          },
          select: { amount: true },
        });
        amount = Number(req.body.amount);
        const remaining = Number(invoice.totalAmount) -
          otherPayments.reduce((sum, item) => sum + Number(item.amount), 0);
        if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) {
          return { status: 400, message: `Enter an amount up to KES ${remaining.toFixed(2)}` };
        }
        const account = await transaction.account.findFirst({
          where: {
            id: req.body.account || record.accountId,
            status: "active",
            accountType: "asset",
          },
        });
        if (!account) return { status: 400, message: "Choose an active finance account" };
        update.accountId = account.id;
        update.amount = amount;
        update.paymentMethod = req.body.paymentMethod || record.paymentMethod;
        update.reference = String(req.body.reference || record.reference).trim();
      } else if (type === "hmis_bill") {
        const items = normalizeWorkflowLines(req.body.items);
        update.items = replaceItems(items);
        update.totalAmount = items.reduce((sum, item) => sum + item.total, 0);
        amount = Number(update.totalAmount);
      } else if (type === "finance_transaction") {
        const account = await transaction.account.findFirst({
          where: {
            id: req.body.account || record.accountId,
            status: "active",
            accountType: "asset",
          },
        });
        if (!account) return { status: 400, message: "Choose an active finance account" };
        amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return { status: 400, message: "Amount must be greater than zero" };
        }
        update.reference = String(req.body.reference || record.reference).trim();
        update.accountId = account.id;
        update.amount = amount;
        update.type = req.body.type || record.type;
        update.description = String(req.body.description ?? record.description ?? "").trim();
      }

      const { policyId, steps } = await getApprovalSteps({ workflowType: type, department, amount });
      update.policyId = policyId;
      update.approvalSteps = steps;
      update.currentStep = 0;
      update.status = type === "finance_transaction" ? "pending" : "pending_approval";
      update.history = [
        ...(Array.isArray(record.history) ? record.history : []),
        { action: "resubmitted", by: req.user.id, at: new Date().toISOString() },
      ];
      return { record: await model.update({ where: { id: record.id }, data: update }) };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      message: "Revised item resubmitted for approval",
      data: serializePrismaRecord(result.record),
    });
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
};
