import Inventory from "../models/Inventory.js";

export const createInventory = async (req, res, next) => {
  try {
    const item = await Inventory.create(req.body);

    res.status(201).json({
      success: true,
      message: "Inventory item created",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const getInventory = async (req, res, next) => {
  try {
    const items = await Inventory.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryById = async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const updateInventory = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      message: "Inventory item updated",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInventory = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndDelete(
      req.params.id
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      message: "Inventory item deleted",
    });
  } catch (error) {
    next(error);
  }
};