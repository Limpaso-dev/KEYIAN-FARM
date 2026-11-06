import { randomInt } from "node:crypto";
import prisma from "../config/prisma.js";
import { logAudit } from "../utils/globalRules.js";
import { getApprovalSteps } from "../services/approvalWorkflow.service.js";
import { calculateBillBalance, normalizeBillStatus } from "../utils/billing.js";
import { serializePrismaRecord } from "../utils/prismaRecords.js";

const invoiceInclude = {
  supplier: { select: { id: true, name: true, supplierCode: true } },
  purchaseOrder: { include: { items: true } },
  goodsReceipt: { include: { items: true } },
  submittedBy: { select: { id: true, name: true, role: true } },
  items: true,
};
const paymentInclude = {
  invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true } },
  supplier: { select: { id: true, name: true, supplierCode: true } },
  account: { select: { id: true, accountName: true, accountCode: true } },
  requestedBy: { select: { id: true, name: true, role: true } },
};
const billInclude = {
  patient: {
    select: {
      id: true, patientNumber: true, firstName: true, lastName: true, nationalId: true,
      phone: true, dateOfBirth: true, estimatedAge: true, sex: true, address: true, status: true,
    },
  },
  visit: { select: { id: true, visitDate: true, visitType: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  items: true,
  payments: {
    include: {
      account: { select: { id: true, accountCode: true, accountName: true } },
      receivedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { receivedAt: "asc" },
  },
};

const paymentError = (error, res, next) => {
  if (error.code === "P2002") {
    return res.status(409).json({ success: false, message: "That payment reference already exists" });
  }
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  return next(error);
};

export const listSupplierInvoices = async (req, res, next) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(invoices.flatMap((invoice) =>
      (Array.isArray(invoice.history) ? invoice.history : [])
        .map((entry) => entry.by)
        .filter((id) => typeof id === "string")))];
    const users = userIds.length
      ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, role: true },
      })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    const data = invoices.map((invoice) => ({
      ...serializePrismaRecord(invoice),
      history: (invoice.history || []).map((entry) => ({
        ...entry,
        by: userById.get(entry.by) || entry.by,
      })),
    }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const submitSupplierInvoice = async (req, res, next) => {
  try {
    const { purchaseOrder: poId, goodsReceipt: receiptId, invoiceNumber } = req.body;
    if (!String(invoiceNumber || "").trim()) {
      return res.status(400).json({ success: false, message: "Supplier invoice number is required" });
    }
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    const receipt = receiptId ? await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: { items: true },
    }) : null;
    if (!order || !receipt || receipt.purchaseOrderId !== order.id) {
      return res.status(400).json({
        success: false,
        message: "Select a goods receipt belonging to the purchase order",
      });
    }
    if (!["approved", "ordered", "partially_received", "received"].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "The purchase order must be approved before invoicing",
      });
    }
    const receivedByLine = order.items.map((_, index) =>
      Number(receipt.items.find((line) => line.poItemIndex === index)?.acceptedQuantity || 0));
    const submittedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (submittedItems.length !== order.items.length) {
      return res.status(400).json({
        success: false,
        message: "Invoice lines must match the purchase order lines",
      });
    }
    const discrepancies = [];
    const items = order.items.map((poLine, index) => {
      const quantity = Number(submittedItems[index].quantity);
      const unitPrice = Number(submittedItems[index].unitPrice);
      if (!Number.isFinite(quantity) || quantity < 0 ||
          !Number.isFinite(unitPrice) || unitPrice < 0) {
        throw Object.assign(new Error("Invoice quantities and unit prices must be valid"), { status: 400 });
      }
      if (quantity > receivedByLine[index]) {
        discrepancies.push(`${poLine.description}: invoiced quantity ${quantity} exceeds accepted GRN quantity ${receivedByLine[index]}`);
      }
      if (Math.abs(unitPrice - Number(poLine.unitPrice)) > 0.01) {
        discrepancies.push(`${poLine.description}: invoice unit price does not match the approved PO`);
      }
      return { description: poLine.description, quantity, unitPrice, total: quantity * unitPrice };
    });
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    if (!items.some((item) => item.quantity > 0)) {
      return res.status(400).json({
        success: false,
        message: "At least one invoice line must have a positive quantity",
      });
    }
    const { policyId, steps } = await getApprovalSteps({
      workflowType: "supplier_invoice",
      department: order.department,
      amount: totalAmount,
    });
    const invoice = await prisma.supplierInvoice.create({
      data: {
        invoiceNumber: String(invoiceNumber).trim(),
        supplierId: order.supplierId,
        purchaseOrderId: order.id,
        goodsReceiptId: receipt.id,
        submittedById: req.user.id,
        department: order.department,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date(),
        supportingDocumentUrl: String(req.body.supportingDocumentUrl || "").trim(),
        items: { create: items },
        totalAmount,
        matchStatus: discrepancies.length ? "discrepancy" : "matched",
        discrepancies,
        status: "pending_approval",
        approvalSteps: steps,
        policyId,
        history: [{ action: "submitted", by: req.user.id, at: new Date().toISOString() }],
      },
      include: invoiceInclude,
    });
    return res.status(201).json({
      success: true,
      message: discrepancies.length
        ? "Invoice recorded with 3-way match discrepancies; Finance approval is blocked until corrected"
        : "Invoice matched against the PO and GRN and sent to Finance",
      data: serializePrismaRecord(invoice),
    });
  } catch (error) {
    return paymentError(error, res, next);
  }
};

export const listSupplierPayments = async (req, res, next) => {
  try {
    const payments = await prisma.supplierPayment.findMany({
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });
    const historyUserIds = [...new Set(payments.flatMap((payment) =>
      (Array.isArray(payment.history) ? payment.history : [])
        .map((entry) => entry.by)
        .filter((id) => typeof id === "string")))];
    const historyUsers = historyUserIds.length
      ? await prisma.user.findMany({
        where: { id: { in: historyUserIds } },
        select: { id: true, name: true, role: true },
      })
      : [];
    const userById = new Map(historyUsers.map((user) => [user.id, user]));
    const data = payments.map((payment) => ({
      ...serializePrismaRecord(payment),
      history: (payment.history || []).map((entry) => ({
        ...entry,
        by: userById.get(entry.by) || entry.by,
      })),
    }));
    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const requestSupplierPayment = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const invoice = await transaction.supplierInvoice.findUnique({
        where: { id: req.body.invoice },
      });
      if (!invoice || !["approved", "partially_paid"].includes(invoice.status)) {
        return { status: 409, message: "Only a Finance-approved invoice can be paid" };
      }
      const settled = await transaction.supplierPayment.findMany({
        where: {
          invoiceId: invoice.id,
          status: { in: ["approved", "pending_approval"] },
        },
        select: { amount: true },
      });
      const remaining = Math.max(0, Number(invoice.totalAmount) -
        settled.reduce((sum, payment) => sum + Number(payment.amount), 0));
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) {
        return {
          status: 400,
          message: `Payment must be greater than zero and no more than the remaining payable KES ${remaining.toFixed(2)}`,
        };
      }
      const account = await transaction.account.findFirst({
        where: { id: req.body.account, status: "active", accountType: "asset" },
      });
      if (!account) return { status: 400, message: "Select an active cash or bank account" };
      const { policyId, steps } = await getApprovalSteps({
        workflowType: "supplier_payment",
        department: "finance",
        amount,
      });
      const payment = await transaction.supplierPayment.create({
        data: {
          paymentNumber: `PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
          invoiceId: invoice.id,
          supplierId: invoice.supplierId,
          accountId: account.id,
          amount,
          paymentMethod: req.body.paymentMethod,
          reference: String(req.body.reference || "").trim(),
          paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
          requestedById: req.user.id,
          status: "pending_approval",
          approvalSteps: steps,
          policyId,
          history: [{ action: "submitted", by: req.user.id, at: new Date().toISOString() }],
        },
        include: paymentInclude,
      });
      return { payment };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.status(201).json({
      success: true,
      message: "Payment request sent for approval",
      data: serializePrismaRecord(result.payment),
    });
  } catch (error) {
    return paymentError(error, res, next);
  }
};

const findReceiptAccount = async (transaction, paymentMethod, selectedAccountId) => {
  if (paymentMethod !== "cash") {
    if (!selectedAccountId) return { error: "Select the bank or mobile money account that received the payment" };
    const account = await transaction.account.findFirst({
      where: { id: selectedAccountId, status: "active", accountType: "asset" },
    });
    return account ? { account } : { error: "Select an active cash or bank account" };
  }
  const accounts = await transaction.account.findMany({
    where: {
      status: "active",
      accountType: "asset",
      accountName: { contains: "cash", mode: "insensitive" },
    },
    select: { id: true, accountCode: true, accountName: true },
  });
  const rank = (name) => {
    const normalized = name.trim().toLowerCase();
    if (normalized === "cash on hand") return 0;
    if (normalized === "cash drawer") return 1;
    if (normalized === "cash in hand") return 2;
    if (normalized === "cash") return 3;
    return 4;
  };
  accounts.sort((a, b) => rank(a.accountName) - rank(b.accountName) ||
    a.accountCode.localeCompare(b.accountCode));
  return accounts[0]
    ? { account: accounts[0] }
    : { error: "Set up an active asset account named Cash on Hand (or Cash Drawer) before recording cash receipts" };
};

export const recordMedicalBillPayment = async (req, res, next) => {
  try {
    if (!new Set(["finance", "cashier", "admin", "super_admin"]).has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Finance or Cashier can record patient payments",
      });
    }
    const reference = String(req.body.reference || "").trim();
    const paymentMethod = String(req.body.paymentMethod || "cash");
    if (!reference) return res.status(400).json({ success: false, message: "Payment reference is required" });

    const result = await prisma.$transaction(async (transaction) => {
      const bill = await transaction.medicalBill.findUnique({
        where: { id: req.params.id },
        include: { payments: true },
      });
      if (!bill || !["approved", "partially_paid"].includes(bill.status)) {
        return { status: 409, message: "Only an approved bill can be paid" };
      }
      const amount = Number(req.body.amount);
      const remaining = calculateBillBalance({
        totalAmount: bill.totalAmount,
        amountPaid: bill.amountPaid,
      });
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) {
        return { status: 400, message: `Enter an amount up to the remaining balance KES ${remaining.toFixed(2)}` };
      }
      const accountResult = await findReceiptAccount(transaction, paymentMethod, req.body.account);
      if (accountResult.error) return { status: 400, message: accountResult.error };
      const account = accountResult.account;
      const before = serializePrismaRecord(bill);
      const ledgerTransaction = await transaction.transaction.create({
        data: {
          reference: `HMIS-${reference}`,
          type: "receipt",
          accountId: account.id,
          amount,
          description: `Patient bill ${bill.billNumber}`,
          status: "posted",
          createdById: req.user.id,
        },
      });
      const amountPaid = Number(bill.amountPaid) + amount;
      const status = normalizeBillStatus({
        totalAmount: bill.totalAmount,
        amountPaid,
        currentStatus: bill.status,
      });
      await transaction.medicalBillPayment.create({
        data: {
          billId: bill.id,
          amount,
          method: paymentMethod,
          reference,
          accountId: account.id,
          receivedById: req.user.id,
          transactionId: ledgerTransaction.id,
        },
      });
      await transaction.medicalBill.update({
        where: { id: bill.id },
        data: { amountPaid, status },
      });
      let clearedVisit = null;
      if (status === "paid" && bill.visitId) {
        const remainingBills = await transaction.medicalBill.count({
          where: {
            visitId: bill.visitId,
            status: { in: ["approved", "partially_paid"] },
            deletedAt: null,
            id: { not: bill.id },
          },
        });
        if (!remainingBills) {
          const visit = await transaction.medicalVisit.findFirst({
            where: { id: bill.visitId, status: "awaiting_billing" },
          });
          if (visit) {
            clearedVisit = await transaction.medicalVisit.update({
              where: { id: visit.id },
              data: { status: "cleared" },
            });
          }
        }
      }
      const updated = await transaction.medicalBill.findUnique({
        where: { id: bill.id },
        include: billInclude,
      });
      return { bill: updated, before, amount, reference, clearedVisit };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    await logAudit({
      actor: req.user,
      action: "payment_recorded",
      entity: "MedicalBill",
      entityId: result.bill.id,
      before: result.before,
      after: serializePrismaRecord(result.bill),
      metadata: { reference: result.reference, amount: result.amount, ip: req.ip },
    });
    if (result.clearedVisit) {
      await logAudit({
        actor: req.user,
        action: "payment_cleared_visit",
        entity: "MedicalVisit",
        entityId: result.clearedVisit.id,
        before: { ...serializePrismaRecord(result.clearedVisit), status: "awaiting_billing" },
        after: serializePrismaRecord(result.clearedVisit),
        metadata: { bill: result.bill.id, ip: req.ip },
      });
    }
    return res.status(201).json({
      success: true,
      message: "Patient payment recorded in Finance",
      data: serializePrismaRecord(result.bill),
    });
  } catch (error) {
    return paymentError(error, res, next);
  }
};

export const recordMedicalVisitPayment = async (req, res, next) => {
  try {
    if (!new Set(["finance", "cashier", "admin", "super_admin"]).has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Finance or Cashier can record patient payments",
      });
    }
    const reference = String(req.body.reference || "").trim();
    const paymentMethod = String(req.body.paymentMethod || "cash");
    if (!reference) return res.status(400).json({ success: false, message: "Payment reference is required" });
    const result = await prisma.$transaction(async (transaction) => {
      const bills = await transaction.medicalBill.findMany({
        where: {
          visitId: req.params.visitId,
          status: { in: ["approved", "partially_paid"] },
          deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
        include: { payments: true },
      });
      if (!bills.length) {
        return { status: 409, message: "This patient visit has no outstanding bills" };
      }
      const amount = Number(req.body.amount);
      const totalBalance = bills.reduce((sum, bill) =>
        sum + calculateBillBalance({ totalAmount: bill.totalAmount, amountPaid: bill.amountPaid }), 0);
      if (!Number.isFinite(amount) || amount <= 0 || amount > totalBalance + 0.0001) {
        return { status: 400, message: `Enter an amount up to the combined visit balance KES ${totalBalance.toFixed(2)}` };
      }
      const accountResult = await findReceiptAccount(transaction, paymentMethod, req.body.account);
      if (accountResult.error) return { status: 400, message: accountResult.error };
      const account = accountResult.account;
      let unallocated = amount;
      const paidBills = [];
      const auditEvents = [];
      for (const bill of bills) {
        if (unallocated <= 0.0001) break;
        const balance = calculateBillBalance({
          totalAmount: bill.totalAmount,
          amountPaid: bill.amountPaid,
        });
        const allocation = Math.min(balance, unallocated);
        if (allocation <= 0) continue;
        const before = serializePrismaRecord(bill);
        const ledgerTransaction = await transaction.transaction.create({
          data: {
            reference: `HMIS-${reference}-${bill.id}-${randomInt(1000, 1000000)}`,
            type: "receipt",
            accountId: account.id,
            amount: allocation,
            description: `Combined patient visit payment · ${bill.department} bill ${bill.billNumber}`,
            status: "posted",
            createdById: req.user.id,
          },
        });
        await transaction.medicalBillPayment.create({
          data: {
            billId: bill.id,
            amount: allocation,
            method: paymentMethod,
            reference,
            accountId: account.id,
            receivedById: req.user.id,
            transactionId: ledgerTransaction.id,
          },
        });
        const amountPaid = Number(bill.amountPaid) + allocation;
        const status = normalizeBillStatus({
          totalAmount: bill.totalAmount,
          amountPaid,
          currentStatus: bill.status,
        });
        await transaction.medicalBill.update({
          where: { id: bill.id },
          data: { amountPaid, status },
        });
        const updatedBill = await transaction.medicalBill.findUnique({
          where: { id: bill.id },
          include: billInclude,
        });
        paidBills.push(updatedBill);
        auditEvents.push({ before, after: serializePrismaRecord(updatedBill), amount: allocation, id: bill.id });
        unallocated -= allocation;
      }
      if (unallocated > 0.0001) {
        return {
          status: 409,
          message: "The outstanding visit balance changed while recording payment. Refresh and try again.",
        };
      }
      const stillOwing = await transaction.medicalBill.count({
        where: {
          visitId: req.params.visitId,
          status: { in: ["approved", "partially_paid"] },
          deletedAt: null,
        },
      });
      let clearedVisit = null;
      if (!stillOwing) {
        const visit = await transaction.medicalVisit.findFirst({
          where: { id: req.params.visitId, status: "awaiting_billing" },
        });
        if (visit) {
          clearedVisit = await transaction.medicalVisit.update({
            where: { id: visit.id },
            data: { status: "cleared" },
          });
        }
      }
      return { bills: paidBills, amount, auditEvents, clearedVisit };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    for (const event of result.auditEvents) {
      await logAudit({
        actor: req.user,
        action: "payment_recorded",
        entity: "MedicalBill",
        entityId: event.id,
        before: event.before,
        after: event.after,
        metadata: {
          reference,
          amount: event.amount,
          groupedVisitPayment: req.params.visitId,
          ip: req.ip,
        },
      });
    }
    if (result.clearedVisit) {
      await logAudit({
        actor: req.user,
        action: "payment_cleared_visit",
        entity: "MedicalVisit",
        entityId: result.clearedVisit.id,
        before: { ...serializePrismaRecord(result.clearedVisit), status: "awaiting_billing" },
        after: serializePrismaRecord(result.clearedVisit),
        metadata: { ip: req.ip },
      });
    }
    return res.status(201).json({
      success: true,
      message: "Combined visit payment recorded and allocated across department bills",
      data: {
        visit: req.params.visitId,
        amount: result.amount,
        bills: serializePrismaRecord(result.bills),
      },
    });
  } catch (error) {
    return paymentError(error, res, next);
  }
};
