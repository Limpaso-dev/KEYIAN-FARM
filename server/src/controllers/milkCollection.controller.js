import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const farmerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  membershipNumber: true,
  phone: true,
};
const collectionFields = [
  "farmerId",
  "collectionCentre",
  "collectionDate",
  "quantityLitres",
  "pricePerLitre",
  "totalAmount",
  "status",
];
const collectionRelations = { farmer: "farmerId" };

export const createMilkCollection = async (req, res, next) => {
  try {
    const data = prismaData(req.body, collectionFields, collectionRelations, ["collectionDate"]);
    if (req.body.quantityLitres !== undefined && req.body.pricePerLitre !== undefined) {
      data.totalAmount = Number(req.body.quantityLitres) * Number(req.body.pricePerLitre);
    }
    const collection = await prisma.milkCollection.create({
      data,
      include: { farmer: { select: farmerSelect } },
    });
    res.status(201).json({
      success: true,
      message: "Milk collection recorded successfully",
      milkCollection: serializePrismaRecord(collection),
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkCollections = async (req, res, next) => {
  try {
    const collections = await prisma.milkCollection.findMany({
      include: { farmer: { select: farmerSelect } },
      orderBy: { collectionDate: "desc" },
    });
    res.status(200).json({
      success: true,
      count: collections.length,
      milkCollections: serializePrismaRecord(collections),
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkCollectionById = async (req, res, next) => {
  try {
    const collection = await prisma.milkCollection.findUnique({
      where: { id: req.params.id },
      include: { farmer: { select: farmerSelect } },
    });
    if (!collection) {
      return res.status(404).json({ success: false, message: "Milk collection record not found" });
    }
    return res.status(200).json({
      success: true,
      milkCollection: serializePrismaRecord(collection),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMilkCollection = async (req, res, next) => {
  try {
    const data = prismaData(req.body, collectionFields, collectionRelations, ["collectionDate"]);
    if (req.body.quantityLitres !== undefined && req.body.pricePerLitre !== undefined) {
      data.totalAmount = Number(req.body.quantityLitres) * Number(req.body.pricePerLitre);
    }
    const collection = await prisma.milkCollection.update({
      where: { id: req.params.id },
      data,
      include: { farmer: { select: farmerSelect } },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!collection) {
      return res.status(404).json({ success: false, message: "Milk collection record not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Milk collection updated successfully",
      milkCollection: serializePrismaRecord(collection),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMilkCollection = async (req, res, next) => {
  try {
    const collection = await prisma.milkCollection.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!collection) {
      return res.status(404).json({ success: false, message: "Milk collection record not found" });
    }
    return res.status(200).json({ success: true, message: "Milk collection deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
