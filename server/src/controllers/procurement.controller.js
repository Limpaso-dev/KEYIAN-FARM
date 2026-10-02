import Supplier from "../models/Supplier.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import { getApprovalSteps, isWorkflowAdmin } from "../services/approvalWorkflow.service.js";
import { randomInt } from "node:crypto";

// ===============================
// SUPPLIERS
// ===============================

export const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.json({
      success: true,
      message: "Supplier updated",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(
      req.params.id
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.json({
      success: true,
      message: "Supplier deleted",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// PURCHASE ORDERS
// ===============================

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const { purchaseRequest: purchaseRequestId, supplier: supplierId, unitPrices = [], quotationUrl = "" } = req.body;
    if (!purchaseRequestId || !supplierId) {
      return res.status(400).json({ success: false, message: "Choose an approved purchase request and supplier" });
    }
    const request = await PurchaseRequest.findById(purchaseRequestId);
    if (!request) return res.status(404).json({ success: false, message: "Purchase request not found" });
    if (request.status !== "approved") return res.status(409).json({ success: false, message: "Only fully approved requests can become purchase orders" });
    const supplier = await Supplier.findOne({ _id: supplierId, status: "active" });
    if (!supplier) return res.status(400).json({ success: false, message: "Choose an active supplier" });
    const existing = await PurchaseOrder.findOne({ purchaseRequest: request._id });
    if (existing) return res.status(409).json({ success: false, message: "A purchase order already exists for this request" });
    const items = request.items.map((item, index) => {
      const unitPrice = unitPrices[index] === undefined ? item.unitPrice : Number(unitPrices[index]);
      return { description: item.description, quantity: item.quantity, unitPrice, total: item.quantity * unitPrice };
    });
    if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      return res.status(400).json({ success: false, message: "Supplier unit prices must be valid non-negative amounts" });
    }
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const { policyId, steps } = await getApprovalSteps({ workflowType: "purchase_order", department: request.department, amount: subtotal });
    const order = await PurchaseOrder.create({
      poNumber: `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
      purchaseRequest: request._id, department: request.department, supplier: supplier._id,
      quotationUrl: String(quotationUrl).trim(),
      items, subtotal, tax: 0, totalAmount: subtotal, status: "pending_approval",
      requestedBy: req.user._id, policy: policyId, approvalSteps: steps,
      history: [{ action: "submitted", by: req.user._id }],
    });
    request.status = "converted";
    request.history.push({ action: "converted_to_po", by: req.user._id, comment: order.poNumber });
    await request.save();

    res.status(201).json({
      success: true,
      message: "Purchase order sent for approval",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrders = async (req, res, next) => {
  try {
    const orders = await PurchaseOrder.find()
      .populate("supplier")
      .populate("purchaseRequest", "requestNumber")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate("supplier");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const placePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (order.status !== "approved") return res.status(409).json({ success: false, message: "Only an authorized purchase order can be placed with the supplier" });
    order.status = "ordered";
    order.history.push({ action: "ordered", by: req.user._id, comment: String(req.body.comment || "").trim() });
    await order.save();
    res.json({ success: true, message: "Purchase order marked as placed with the supplier", data: order });
  } catch (error) { next(error); }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    return res.status(409).json({ success: false, message: "Purchase order details are locked after submission. Return it through the approval workflow for correction." });
  } catch (error) {
    next(error);
  }
};

export const deletePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    if (!["draft", "returned"].includes(order.status) || (!isWorkflowAdmin(req.user.role) && String(order.requestedBy) !== String(req.user._id))) {
      return res.status(403).json({ success: false, message: "Only the requester can delete a draft or returned purchase order" });
    }

    await order.deleteOne();

    res.json({
      success: true,
      message: "Purchase order deleted",
    });
  } catch (error) {
    next(error);
  }
};
