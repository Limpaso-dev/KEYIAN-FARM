import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const recordFields = [
  "productName", "batchNumber", "inputMilkLitres", "outputQuantity", "unit",
  "productionDate", "expiryDate", "status",
];
const dateFields = ["productionDate", "expiryDate"];

export const createMilkValueAddition = async (req, res, next) => {
  try {
    const record = await prisma.milkValueAddition.create({
      data: prismaData(req.body, recordFields, {}, dateFields),
    });
    res.status(201).json({
      success: true,
      message: "Milk value addition record created successfully",
      milkValueAddition: serializePrismaRecord(record),
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkValueAdditions = async (req, res, next) => {
  try {
    const records = await prisma.milkValueAddition.findMany({
      orderBy: [{ productionDate: "desc" }, { createdAt: "desc" }],
    });
    res.status(200).json({
      success: true,
      count: records.length,
      milkValueAdditions: serializePrismaRecord(records),
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkValueAdditionById = async (req, res, next) => {
  try {
    const record = await prisma.milkValueAddition.findUnique({
      where: { id: req.params.id },
    });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Value addition record not found",
      });
    }
    return res.status(200).json({
      success: true,
      milkValueAddition: serializePrismaRecord(record),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMilkValueAddition = async (req, res, next) => {
  try {
    const record = await prisma.milkValueAddition.update({
      where: { id: req.params.id },
      data: prismaData(req.body, recordFields, {}, dateFields),
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Value addition record not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Value addition record updated successfully",
      milkValueAddition: serializePrismaRecord(record),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMilkValueAddition = async (req, res, next) => {
  try {
    const record = await prisma.milkValueAddition.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Value addition record not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Value addition record deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};
