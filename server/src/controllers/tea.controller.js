import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const farmFields = ["farmerId", "farmName", "location", "acreage", "variety", "plantingDate", "status"];
const relations = { farmer: "farmerId" };
const include = {
  farmer: { select: { id: true, firstName: true, lastName: true, membershipNumber: true, phone: true } },
  productionRecords: { orderBy: { date: "desc" } },
};

const productionRecords = (records = []) => records.map((record) => ({
  date: record.date ? new Date(record.date) : null,
  quantityKg: record.quantityKg,
  grade: record.grade,
}));

export const createTeaFarm = async (req, res, next) => {
  try {
    const data = prismaData(req.body, farmFields, relations, ["plantingDate"]);
    data.productionRecords = { create: productionRecords(req.body.productionRecords) };
    const farm = await prisma.teaFarm.create({ data, include });
    res.status(201).json({
      success: true,
      message: "Tea farm record created successfully",
      teaFarm: serializePrismaRecord(farm),
    });
  } catch (error) {
    next(error);
  }
};

export const getTeaFarms = async (req, res, next) => {
  try {
    const farms = await prisma.teaFarm.findMany({ include, orderBy: { createdAt: "desc" } });
    res.status(200).json({
      success: true,
      count: farms.length,
      teaFarms: serializePrismaRecord(farms),
    });
  } catch (error) {
    next(error);
  }
};

export const getTeaFarmById = async (req, res, next) => {
  try {
    const farm = await prisma.teaFarm.findUnique({ where: { id: req.params.id }, include });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Tea farm record not found" });
    }
    return res.status(200).json({ success: true, teaFarm: serializePrismaRecord(farm) });
  } catch (error) {
    return next(error);
  }
};

export const updateTeaFarm = async (req, res, next) => {
  try {
    const farm = await prisma.$transaction(async (transaction) => {
      const data = prismaData(req.body, farmFields, relations, ["plantingDate"]);
      if (Object.hasOwn(req.body, "productionRecords")) {
        await transaction.teaProductionRecord.deleteMany({ where: { farmId: req.params.id } });
        data.productionRecords = { create: productionRecords(req.body.productionRecords) };
      }
      return transaction.teaFarm.update({
        where: { id: req.params.id },
        data,
        include,
      });
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Tea farm record not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Tea farm updated successfully",
      teaFarm: serializePrismaRecord(farm),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteTeaFarm = async (req, res, next) => {
  try {
    const farm = await prisma.teaFarm.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Tea farm record not found" });
    }
    return res.status(200).json({ success: true, message: "Tea farm deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
