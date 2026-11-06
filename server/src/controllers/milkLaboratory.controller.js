import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const testFields = [
  "milkCollectionId",
  "sampleNumber",
  "fatPercentage",
  "proteinPercentage",
  "snfPercentage",
  "acidity",
  "temperature",
  "result",
  "testedById",
  "testedAt",
  "remarks",
];
const testRelations = {
  milkCollection: "milkCollectionId",
  testedBy: "testedById",
};
const testIncludes = {
  milkCollection: true,
  testedBy: { select: { id: true, name: true, email: true } },
};

export const createMilkTest = async (req, res, next) => {
  try {
    const test = await prisma.milkTest.create({
      data: prismaData(req.body, testFields, testRelations, ["testedAt"]),
    });
    res.status(201).json({
      success: true,
      message: "Milk laboratory test recorded successfully",
      data: serializePrismaRecord(test),
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkTests = async (req, res, next) => {
  try {
    const tests = await prisma.milkTest.findMany({
      include: testIncludes,
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      count: tests.length,
      data: serializePrismaRecord(tests),
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkTestById = async (req, res, next) => {
  try {
    const test = await prisma.milkTest.findUnique({
      where: { id: req.params.id },
      include: testIncludes,
    });
    if (!test) {
      return res.status(404).json({ success: false, message: "Milk test not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(test) });
  } catch (error) {
    return next(error);
  }
};

export const updateMilkTest = async (req, res, next) => {
  try {
    const test = await prisma.milkTest.update({
      where: { id: req.params.id },
      data: prismaData(req.body, testFields, testRelations, ["testedAt"]),
      include: testIncludes,
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!test) {
      return res.status(404).json({ success: false, message: "Milk test not found" });
    }
    return res.json({
      success: true,
      message: "Milk test updated successfully",
      data: serializePrismaRecord(test),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMilkTest = async (req, res, next) => {
  try {
    const test = await prisma.milkTest.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!test) {
      return res.status(404).json({ success: false, message: "Milk test not found" });
    }
    return res.json({ success: true, message: "Milk test deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
