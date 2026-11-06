import { randomInt } from "node:crypto";
import prisma from "../config/prisma.js";
import { isWorkflowAdmin } from "../services/approvalWorkflow.service.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const supplierFields = [
  "supplierCode", "name", "contactPerson", "phone", "email", "address", "taxNumber", "status",
];
const orderInclude = {
  supplier: true,
  purchaseRequest: { select: { id: true, requestNumber: true } },
  items: true,
};

export const createSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.create({
      data: prismaData(req.body, supplierFields),
    });
    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: serializePrismaRecord(supplier),
    });
  } catch (error) {
    next(error);
  }
};

export const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: suppliers.length,
      data: serializePrismaRecord(suppliers),
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    return res.json({ success: true, data: serializePrismaRecord(supplier) });
  } catch (error) {
    return next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: prismaData(req.body, supplierFields),
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    return res.json({
      success: true,
      message: "Supplier updated",
      data: serializePrismaRecord(supplier),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    return res.json({ success: true, message: "Supplier deleted" });
  } catch (error) {
    return next(error);
  }
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      purchaseRequest: purchaseRequestId,
      supplier: supplierId,
      unitPrices = [],
      quotationUrl = "",
    } = req.body;
    if (!purchaseRequestId || !supplierId) {
      return res.status(400).json({
        success: false,
        message: "Choose an approved purchase request and supplier",
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const request = await transaction.purchaseRequest.findUnique({
        where: { id: purchaseRequestId },
        include: { items: true },
      });
      if (!request) return { status: 404, message: "Purchase request not found" };
      if (request.status !== "approved") {
        return { status: 409, message: "Only fully approved requests can become purchase orders" };
      }

      const supplier = await transaction.supplier.findFirst({
        where: { id: supplierId, status: "active" },
      });
      if (!supplier) return { status: 400, message: "Choose an active supplier" };

      const existing = await transaction.purchaseOrder.findUnique({
        where: { purchaseRequestId: request.id },
      });
      if (existing) {
        return { status: 409, message: "A purchase order already exists for this request" };
      }

      const items = request.items.map((item, index) => {
        const unitPrice = unitPrices[index] === undefined ? Number(item.unitPrice) : Number(unitPrices[index]);
        return {
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice,
          total: Number(item.quantity) * unitPrice,
        };
      });
      if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
        return { status: 400, message: "Supplier unit prices must be valid non-negative amounts" };
      }

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const userId = req.user.id;
      const order = await transaction.purchaseOrder.create({
        data: {
          poNumber: `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
          purchaseRequestId: request.id,
          department: request.department,
          supplierId: supplier.id,
          quotationUrl: String(quotationUrl).trim(),
          items: { create: items },
          subtotal,
          tax: 0,
          totalAmount: subtotal,
          status: "approved",
          requestedById: userId,
          approvedById: userId,
          history: [{
            action: "approved",
            by: userId,
            at: new Date().toISOString(),
            comment: "Created by procurement from an approved purchase request",
          }],
        },
        include: orderInclude,
      });

      const history = Array.isArray(request.history) ? request.history : [];
      await transaction.purchaseRequest.update({
        where: { id: request.id },
        data: {
          status: "converted",
          history: [...history, {
            action: "converted_to_po",
            by: userId,
            at: new Date().toISOString(),
            comment: order.poNumber,
          }],
        },
      });
      return { order };
    }, { isolationLevel: "Serializable" });

    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.status(201).json({
      success: true,
      message: "Purchase order created for the selected supplier",
      data: serializePrismaRecord(result.order),
    });
  } catch (error) {
    return next(error);
  }
};

export const getPurchaseOrders = async (req, res, next) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      count: orders.length,
      data: serializePrismaRecord(orders),
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    return res.json({ success: true, data: serializePrismaRecord(order) });
  } catch (error) {
    return next(error);
  }
};

export const placePurchaseOrder = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.purchaseOrder.findUnique({ where: { id: req.params.id } });
      if (!order) return { status: 404, message: "Purchase order not found" };
      if (order.status !== "approved") {
        return { status: 409, message: "Only an authorized purchase order can be placed with the supplier" };
      }
      const history = Array.isArray(order.history) ? order.history : [];
      const updated = await transaction.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: "ordered",
          history: [...history, {
            action: "ordered",
            by: req.user.id,
            at: new Date().toISOString(),
            comment: String(req.body.comment || "").trim(),
          }],
        },
        include: orderInclude,
      });
      return { order: updated };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      message: "Purchase order marked as placed with the supplier",
      data: serializePrismaRecord(result.order),
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    return res.status(409).json({
      success: false,
      message: "Purchase order details are locked after submission. Return it through the approval workflow for correction.",
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePurchaseOrder = async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (!["draft", "returned"].includes(order.status) ||
        (!isWorkflowAdmin(req.user.role) && String(order.requestedById) !== String(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: "Only the requester can delete a draft or returned purchase order",
      });
    }
    await prisma.purchaseOrder.delete({ where: { id: order.id } });
    return res.json({ success: true, message: "Purchase order deleted" });
  } catch (error) {
    return next(error);
  }
};
