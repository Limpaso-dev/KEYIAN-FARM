import Supplier from "../models/Supplier.js";
import PurchaseOrder from "../models/PurchaseOrder.js";

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
    const order = await PurchaseOrder.create(req.body);

    res.status(201).json({
      success: true,
      message: "Purchase order created",
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

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      message: "Purchase order updated",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByIdAndDelete(
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      message: "Purchase order deleted",
    });
  } catch (error) {
    next(error);
  }
};