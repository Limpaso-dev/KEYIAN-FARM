import { randomInt } from "node:crypto";
import GoodsReceipt from "../models/GoodsReceipt.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SupplierInvoice from "../models/SupplierInvoice.js";
import SupplierPayment from "../models/SupplierPayment.js";
import MedicalBill from "../models/MedicalBill.js";
import MedicalVisit from "../models/MedicalVisit.js";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import { logAudit } from "../utils/globalRules.js";
import { getApprovalSteps } from "../services/approvalWorkflow.service.js";
import { calculateBillBalance, normalizeBillStatus } from "../utils/billing.js";

export const listSupplierInvoices = async (req, res, next) => {
  try {
    const invoices = await SupplierInvoice.find()
      .populate("supplier", "name supplierCode")
      .populate("purchaseOrder", "poNumber department items totalAmount")
      .populate("goodsReceipt", "receiptNumber items receivedAt")
      .populate("submittedBy", "name role")
      .populate("history.by", "name role")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (error) { next(error); }
};

export const submitSupplierInvoice = async (req, res, next) => {
  try {
    const { purchaseOrder: poId, goodsReceipt: receiptId, invoiceNumber } = req.body;
    if (!String(invoiceNumber || "").trim()) return res.status(400).json({ success: false, message: "Supplier invoice number is required" });
    const order = await PurchaseOrder.findById(poId);
    const receipt = await GoodsReceipt.findById(receiptId);
    if (!order || !receipt || String(receipt.purchaseOrder) !== String(order._id)) return res.status(400).json({ success: false, message: "Select a goods receipt belonging to the purchase order" });
    if (!["approved", "ordered", "partially_received", "received"].includes(order.status)) return res.status(409).json({ success: false, message: "The purchase order must be approved before invoicing" });
    const receivedByLine = order.items.map((_, index) => Number(receipt.items.find((line) => line.poItemIndex === index)?.acceptedQuantity || 0));
    const submittedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (submittedItems.length !== order.items.length) return res.status(400).json({ success: false, message: "Invoice lines must match the purchase order lines" });
    const discrepancies = [];
    const items = order.items.map((poLine, index) => {
      const quantity = Number(submittedItems[index].quantity);
      const unitPrice = Number(submittedItems[index].unitPrice);
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Invoice quantities and unit prices must be valid");
      if (quantity > receivedByLine[index]) discrepancies.push(`${poLine.description}: invoiced quantity ${quantity} exceeds accepted GRN quantity ${receivedByLine[index]}`);
      if (Math.abs(unitPrice - poLine.unitPrice) > 0.01) discrepancies.push(`${poLine.description}: invoice unit price does not match the approved PO`);
      return { description: poLine.description, quantity, unitPrice, total: quantity * unitPrice };
    });
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    if (!items.some((item) => item.quantity > 0)) return res.status(400).json({ success: false, message: "At least one invoice line must have a positive quantity" });
    const { policyId, steps } = await getApprovalSteps({ workflowType: "supplier_invoice", department: order.department, amount: totalAmount });
    const invoice = await SupplierInvoice.create({
      invoiceNumber: String(invoiceNumber).trim(), supplier: order.supplier, purchaseOrder: order._id,
      goodsReceipt: receipt._id, submittedBy: req.user._id, department: order.department, invoiceDate: req.body.invoiceDate || Date.now(),
      supportingDocumentUrl: String(req.body.supportingDocumentUrl || "").trim(),
      items, totalAmount, matchStatus: discrepancies.length ? "discrepancy" : "matched", discrepancies,
      status: "pending_approval", approvalSteps: steps, policy: policyId,
      history: [{ action: "submitted", by: req.user._id }],
    });
    res.status(201).json({ success: true, message: discrepancies.length ? "Invoice recorded with 3-way match discrepancies; Finance approval is blocked until corrected" : "Invoice matched against the PO and GRN and sent to Finance", data: invoice });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

export const listSupplierPayments = async (req, res, next) => {
  try {
    const payments = await SupplierPayment.find()
      .populate("invoice", "invoiceNumber totalAmount status")
      .populate("supplier", "name supplierCode")
      .populate("account", "accountName accountCode")
      .populate("requestedBy", "name role")
      .populate("history.by", "name role")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: payments.length, data: payments });
  } catch (error) { next(error); }
};

export const requestSupplierPayment = async (req, res, next) => {
  try {
    const invoice = await SupplierInvoice.findById(req.body.invoice);
    if (!invoice || !["approved", "partially_paid"].includes(invoice.status)) return res.status(409).json({ success: false, message: "Only a Finance-approved invoice can be paid" });
    const settled = await SupplierPayment.aggregate([{ $match: { invoice: invoice._id, status: { $in: ["approved", "pending_approval"] } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    const remaining = Math.max(0, invoice.totalAmount - (settled[0]?.amount || 0));
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) return res.status(400).json({ success: false, message: `Payment must be greater than zero and no more than the remaining payable KES ${remaining.toFixed(2)}` });
    const account = await Account.findOne({ _id: req.body.account, status: "active", accountType: "asset" });
    if (!account) return res.status(400).json({ success: false, message: "Select an active cash or bank account" });
    const { policyId, steps } = await getApprovalSteps({ workflowType: "supplier_payment", department: "finance", amount });
    const payment = await SupplierPayment.create({
      paymentNumber: `PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
      invoice: invoice._id, supplier: invoice.supplier, account: req.body.account, amount,
      paymentMethod: req.body.paymentMethod, reference: String(req.body.reference || "").trim(),
      paymentDate: req.body.paymentDate || Date.now(), requestedBy: req.user._id,
      status: "pending_approval", approvalSteps: steps, policy: policyId,
      history: [{ action: "submitted", by: req.user._id }],
    });
    res.status(201).json({ success: true, message: "Payment request sent for approval", data: payment });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

export const recordMedicalBillPayment = async (req, res, next) => {
  try {
    if (!new Set(["finance", "cashier", "admin", "super_admin"]).has(req.user.role)) return res.status(403).json({ success: false, message: "Only Finance or Cashier can record patient payments" });
    const bill = await MedicalBill.findById(req.params.id);
    if (!bill || !["approved", "partially_paid"].includes(bill.status)) return res.status(409).json({ success: false, message: "Only an approved bill can be paid" });
    const amount = Number(req.body.amount);
    const remaining = calculateBillBalance({ totalAmount: bill.totalAmount, amountPaid: bill.amountPaid });
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) return res.status(400).json({ success: false, message: `Enter an amount up to the remaining balance KES ${remaining.toFixed(2)}` });
    const reference = String(req.body.reference || "").trim();
    const paymentMethod = String(req.body.paymentMethod || "cash");
    if (!reference) return res.status(400).json({ success: false, message: "Payment reference is required" });
    let account;
    if (paymentMethod === "cash") {
      const cashAccounts = await Account.find({ status: "active", accountType: "asset", accountName: { $regex: /cash/i } }).select("accountCode accountName").lean();
      const rank = (name) => {
        const normalized = name.trim().toLowerCase();
        if (normalized === "cash on hand") return 0;
        if (normalized === "cash drawer") return 1;
        if (normalized === "cash in hand") return 2;
        if (normalized === "cash") return 3;
        return 4;
      };
      account = cashAccounts.sort((a, b) => rank(a.accountName) - rank(b.accountName) || a.accountCode.localeCompare(b.accountCode))[0];
      if (!account) return res.status(400).json({ success: false, message: "Set up an active asset account named Cash on Hand (or Cash Drawer) before recording cash receipts" });
    } else {
      if (!req.body.account) return res.status(400).json({ success: false, message: "Select the bank or mobile money account that received the payment" });
      account = await Account.findOne({ _id: req.body.account, status: "active", accountType: "asset" });
      if (!account) return res.status(400).json({ success: false, message: "Select an active cash or bank account" });
    }
    const transaction = await Transaction.create({ reference: `HMIS-${reference}`, type: "receipt", account: account._id, amount, description: `Patient bill ${bill.billNumber}`, status: "posted", createdBy: req.user._id });
    bill.payments.push({ amount, method: paymentMethod, reference, account: account._id, receivedBy: req.user._id, transaction: transaction._id });
    bill.amountPaid += amount;
    bill.status = normalizeBillStatus({ totalAmount: bill.totalAmount, amountPaid: bill.amountPaid, currentStatus: bill.status });
    const beforeState = bill.toObject();
    await bill.save();
    if (bill.status === "paid" && bill.visit) {
      const visit = await MedicalVisit.findOne({ _id: bill.visit, status: "awaiting_billing" });
      if (visit) {
        const beforeVisit = visit.toObject();
        visit.status = "cleared";
        await visit.save();
        await logAudit({ actor: req.user, action: "payment_cleared_visit", entity: "MedicalVisit", entityId: visit._id, before: beforeVisit, after: visit.toObject(), metadata: { bill: bill._id, ip: req.ip } });
      }
    }
    await logAudit({
      actor: req.user,
      action: "payment_recorded",
      entity: "MedicalBill",
      entityId: bill._id,
      before: beforeState,
      after: bill.toObject(),
      metadata: {
        reference,
        amount,
        ip: req.ip,
      },
    });
    res.status(201).json({ success: true, message: "Patient payment recorded in Finance", data: bill });
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ success: false, message: error.code === 11000 ? "That payment reference already exists" : error.message }); }
};
