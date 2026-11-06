import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const farmerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  membershipNumber: true,
  phone: true,
};
const livestockFields = [
  "animalTag", "farmerId", "species", "breed", "sex", "dateOfBirth", "healthStatus", "status",
];
const livestockRelations = { farmer: "farmerId" };

export const createLivestock = async (req, res, next) => {
  try {
    const livestock = await prisma.livestock.create({
      data: prismaData(req.body, livestockFields, livestockRelations, ["dateOfBirth"]),
      include: { farmer: { select: farmerSelect } },
    });
    res.status(201).json({
      success: true,
      message: "Livestock record created successfully",
      livestock: serializePrismaRecord(livestock),
    });
  } catch (error) {
    next(error);
  }
};

export const getLivestock = async (req, res, next) => {
  try {
    const livestock = await prisma.livestock.findMany({
      include: { farmer: { select: farmerSelect } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
      success: true,
      count: livestock.length,
      livestock: serializePrismaRecord(livestock),
    });
  } catch (error) {
    next(error);
  }
};

export const getLivestockById = async (req, res, next) => {
  try {
    const livestock = await prisma.livestock.findUnique({
      where: { id: req.params.id },
      include: { farmer: { select: farmerSelect } },
    });
    if (!livestock) {
      return res.status(404).json({ success: false, message: "Livestock record not found" });
    }
    return res.status(200).json({ success: true, livestock: serializePrismaRecord(livestock) });
  } catch (error) {
    return next(error);
  }
};

export const updateLivestock = async (req, res, next) => {
  try {
    const livestock = await prisma.livestock.update({
      where: { id: req.params.id },
      data: prismaData(req.body, livestockFields, livestockRelations, ["dateOfBirth"]),
      include: { farmer: { select: farmerSelect } },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!livestock) {
      return res.status(404).json({ success: false, message: "Livestock record not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Livestock updated successfully",
      livestock: serializePrismaRecord(livestock),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteLivestock = async (req, res, next) => {
  try {
    const livestock = await prisma.livestock.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!livestock) {
      return res.status(404).json({ success: false, message: "Livestock record not found" });
    }
    return res.status(200).json({ success: true, message: "Livestock deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
