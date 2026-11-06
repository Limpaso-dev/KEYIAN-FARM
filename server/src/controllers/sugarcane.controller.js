import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const farmFields = [
  "farmerId", "farmName", "location", "acreage", "variety", "plantingDate",
  "expectedHarvestDate", "status",
];
const relations = { farmer: "farmerId" };
const dateFields = ["plantingDate", "expectedHarvestDate"];
const include = {
  farmer: { select: { id: true, firstName: true, lastName: true, membershipNumber: true, phone: true } },
  harvestRecords: { orderBy: { harvestDate: "desc" } },
};

const harvestRecords = (records = []) => records.map((record) => ({
  harvestDate: record.harvestDate ? new Date(record.harvestDate) : null,
  quantityTonnes: record.quantityTonnes,
}));

export const createSugarcaneFarm = async (req, res, next) => {
  try {
    const data = prismaData(req.body, farmFields, relations, dateFields);
    data.harvestRecords = { create: harvestRecords(req.body.harvestRecords) };
    const farm = await prisma.sugarcaneFarm.create({ data, include });
    res.status(201).json({
      success: true,
      message: "Sugarcane farm record created successfully",
      sugarcaneFarm: serializePrismaRecord(farm),
    });
  } catch (error) {
    next(error);
  }
};

export const getSugarcaneFarms = async (req, res, next) => {
  try {
    const farms = await prisma.sugarcaneFarm.findMany({ include, orderBy: { createdAt: "desc" } });
    res.status(200).json({
      success: true,
      count: farms.length,
      sugarcaneFarms: serializePrismaRecord(farms),
    });
  } catch (error) {
    next(error);
  }
};

export const getSugarcaneFarmById = async (req, res, next) => {
  try {
    const farm = await prisma.sugarcaneFarm.findUnique({ where: { id: req.params.id }, include });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Sugarcane farm record not found" });
    }
    return res.status(200).json({ success: true, sugarcaneFarm: serializePrismaRecord(farm) });
  } catch (error) {
    return next(error);
  }
};

export const updateSugarcaneFarm = async (req, res, next) => {
  try {
    const farm = await prisma.$transaction(async (transaction) => {
      const data = prismaData(req.body, farmFields, relations, dateFields);
      if (Object.hasOwn(req.body, "harvestRecords")) {
        await transaction.sugarcaneHarvestRecord.deleteMany({ where: { farmId: req.params.id } });
        data.harvestRecords = { create: harvestRecords(req.body.harvestRecords) };
      }
      return transaction.sugarcaneFarm.update({
        where: { id: req.params.id },
        data,
        include,
      });
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Sugarcane farm record not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Sugarcane farm updated successfully",
      sugarcaneFarm: serializePrismaRecord(farm),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSugarcaneFarm = async (req, res, next) => {
  try {
    const farm = await prisma.sugarcaneFarm.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Sugarcane farm record not found" });
    }
    return res.status(200).json({ success: true, message: "Sugarcane farm deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
