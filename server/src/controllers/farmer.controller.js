import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const farmerFields = [
  "membershipNumber",
  "firstName",
  "lastName",
  "nationalId",
  "phone",
  "email",
  "address",
  "farmLocation",
  "membershipStatus",
  "shares",
];

export const createFarmer = async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.create({
      data: prismaData(req.body, farmerFields),
    });
    res.status(201).json({
      success: true,
      message: "Farmer created successfully",
      data: serializePrismaRecord(farmer),
    });
  } catch (error) {
    next(error);
  }
};

export const getFarmers = async (req, res, next) => {
  try {
    const farmers = await prisma.farmer.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: farmers.length,
      data: serializePrismaRecord(farmers),
    });
  } catch (error) {
    next(error);
  }
};

export const getFarmerById = async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { id: req.params.id } });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(farmer) });
  } catch (error) {
    return next(error);
  }
};

export const updateFarmer = async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.update({
      where: { id: req.params.id },
      data: prismaData(req.body, farmerFields),
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }
    return res.json({
      success: true,
      message: "Farmer updated successfully",
      data: serializePrismaRecord(farmer),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteFarmer = async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }
    return res.json({ success: true, message: "Farmer deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
