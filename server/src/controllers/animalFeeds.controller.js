import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const fields = ["name", "feedType", "unit", "quantity", "reorderLevel", "unitCost", "supplierId", "status"];
const relations = { supplier: "supplierId" };
const include = { supplier: { select: { id: true, name: true } } };

export const createAnimalFeed = async (req, res, next) => {
  try {
    const feed = await prisma.animalFeed.create({
      data: prismaData(req.body, fields, relations),
      include,
    });
    res.status(201).json({
      success: true,
      message: "Animal feed record created",
      data: serializePrismaRecord(feed),
    });
  } catch (error) {
    next(error);
  }
};

export const getAnimalFeeds = async (req, res, next) => {
  try {
    const feeds = await prisma.animalFeed.findMany({
      include,
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      count: feeds.length,
      data: serializePrismaRecord(feeds),
    });
  } catch (error) {
    next(error);
  }
};

export const getAnimalFeedById = async (req, res, next) => {
  try {
    const feed = await prisma.animalFeed.findUnique({
      where: { id: req.params.id },
      include,
    });
    if (!feed) {
      return res.status(404).json({ success: false, message: "Animal feed record not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(feed) });
  } catch (error) {
    return next(error);
  }
};

export const updateAnimalFeed = async (req, res, next) => {
  try {
    const feed = await prisma.animalFeed.update({
      where: { id: req.params.id },
      data: prismaData(req.body, fields, relations),
      include,
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!feed) {
      return res.status(404).json({ success: false, message: "Animal feed record not found" });
    }
    return res.json({
      success: true,
      message: "Animal feed updated",
      data: serializePrismaRecord(feed),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAnimalFeed = async (req, res, next) => {
  try {
    const feed = await prisma.animalFeed.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!feed) {
      return res.status(404).json({ success: false, message: "Animal feed record not found" });
    }
    return res.json({ success: true, message: "Animal feed deleted" });
  } catch (error) {
    return next(error);
  }
};
