import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const fields = ["itemCode", "name", "category", "unit", "quantity", "reorderLevel", "unitCost", "location", "status"];

export const createInventory = async (req, res, next) => {
  try {
    const item = await prisma.inventory.create({ data: prismaData(req.body, fields) });
    res.status(201).json({
      success: true,
      message: "Inventory item created",
      data: serializePrismaRecord(item),
    });
  } catch (error) {
    next(error);
  }
};

export const getInventory = async (req, res, next) => {
  try {
    const items = await prisma.inventory.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: items.length,
      data: serializePrismaRecord(items),
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryById = async (req, res, next) => {
  try {
    const item = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(item) });
  } catch (error) {
    return next(error);
  }
};

export const updateInventory = async (req, res, next) => {
  try {
    const item = await prisma.inventory.update({
      where: { id: req.params.id },
      data: prismaData(req.body, fields),
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!item) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    return res.json({
      success: true,
      message: "Inventory item updated",
      data: serializePrismaRecord(item),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteInventory = async (req, res, next) => {
  try {
    const item = await prisma.inventory.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!item) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    return res.json({ success: true, message: "Inventory item deleted" });
  } catch (error) {
    return next(error);
  }
};
