import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { parseBody } from "../../lib/validate.js";

const router = express.Router();
const farmBrief = { select: { id: true, farmNumber: true, cropType: true, location: true } };

// ---------------------------------------------------------------------
// Farms (sugarcane, tea, coffee)
// ---------------------------------------------------------------------
const farmRouter = express.Router();

// Change the farm status (e.g. "weeding done, awaiting fertiliser") and
// keep a history of changes.
farmRouter.post("/:id/status", allow("cropFarms", "write"), async (req, res) => {
  const data = parseBody({ status: "option:farmStatus!", date: "date!", note: "text" }, req.body);
  const farm = await inTransaction(async (tx) => {
    const existing = await tx.cropFarm.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Farm");
    await tx.cropStatusLog.create({ data: { farmId: existing.id, ...data } });
    const updated = await tx.cropFarm.update({
      where: { id: existing.id },
      data: { status: data.status, statusNote: data.note || null },
    });
    await audit(tx, { user: req.user, action: "status", entity: "cropFarm", entityId: existing.id, before: { status: existing.status }, after: data });
    return updated;
  });
  ok(res, farm);
});

farmRouter.get("/:id/history", allow("cropFarms", "read"), async (req, res) => {
  const [statusLogs, harvests] = await Promise.all([
    prisma.cropStatusLog.findMany({ where: { farmId: req.params.id }, orderBy: { date: "desc" } }),
    prisma.cropHarvest.findMany({ where: { farmId: req.params.id }, orderBy: { harvestDate: "desc" } }),
  ]);
  ok(res, { statusLogs, harvests });
});

router.use("/farms", crud({
  router: farmRouter,
  resource: "cropFarms",
  model: "cropFarm",
  label: "Farm",
  fields: {
    farmNumber: "string!",
    cropType: "option:cropTypes!",
    acreage: "decimal!",
    location: "string!",
    plantingDate: "date",
    ratoonCount: "int",
    status: "option:farmStatus",
    statusNote: "text",
    notes: "text",
  },
  // Status changes go through POST /:id/status so they are logged.
  updateFields: {
    farmNumber: "string!",
    cropType: "option:cropTypes!",
    acreage: "decimal!",
    location: "string!",
    plantingDate: "date",
    ratoonCount: "int",
    notes: "text",
  },
  include: { _count: { select: { harvests: true } } },
  search: ["farmNumber", "location"],
  filters: ["cropType", "status"],
  orderBy: { farmNumber: "asc" },
  prepare: (data) => {
    if (data.acreage !== undefined && !(data.acreage > 0)) throw badRequest("Acreage must be more than zero");
    if (data.ratoonCount !== undefined && data.ratoonCount !== null && data.ratoonCount < 0) throw badRequest("Ratoon count cannot be negative");
  },
  beforeDelete: async (farm, { tx }) => {
    if (await tx.cropHarvest.count({ where: { farmId: farm.id } })) throw conflict("This farm has harvest records and cannot be deleted");
  },
}));

// ---------------------------------------------------------------------
// Harvests. Each sugarcane harvest adds one to the farm's ratoon count.
// ---------------------------------------------------------------------
const harvestRouter = express.Router();
harvestRouter.post("/", allow("cropHarvests", "write"), async (req, res) => {
  const data = parseBody({
    farmId: "id!",
    harvestDate: "date!",
    quantity: "decimal!",
    unit: "option:harvestUnits!",
    buyer: "string",
    amount: "decimal",
    notes: "text",
    markHarvested: "bool",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  const { markHarvested, ...fields } = data;
  const harvest = await inTransaction(async (tx) => {
    const farm = await tx.cropFarm.findUnique({ where: { id: fields.farmId } });
    if (!farm) throw notFound("Farm");
    const created = await tx.cropHarvest.create({ data: fields, include: { farm: farmBrief } });
    const update = {};
    if (farm.cropType === "sugarcane") update.ratoonCount = farm.ratoonCount + 1;
    if (markHarvested) {
      update.status = "harvested";
      update.statusNote = null;
      await tx.cropStatusLog.create({ data: { farmId: farm.id, date: fields.harvestDate, status: "harvested", note: "Recorded with harvest" } });
    }
    if (Object.keys(update).length) await tx.cropFarm.update({ where: { id: farm.id }, data: update });
    await audit(tx, { user: req.user, action: "create", entity: "cropHarvest", entityId: created.id, after: created });
    return created;
  });
  ok(res, harvest, 201);
});
router.use("/harvests", crud({
  router: harvestRouter,
  resource: "cropHarvests",
  model: "cropHarvest",
  fields: {},
  updateFields: { quantity: "decimal!", unit: "option:harvestUnits!", buyer: "string", amount: "decimal", notes: "text" },
  include: { farm: farmBrief },
  dateField: "harvestDate",
  filters: ["farmId"],
  orderBy: { harvestDate: "desc" },
  create: false,
  beforeDelete: async (harvest, { tx }) => {
    const farm = await tx.cropFarm.findUnique({ where: { id: harvest.farmId } });
    if (farm?.cropType === "sugarcane" && farm.ratoonCount > 0) {
      await tx.cropFarm.update({ where: { id: farm.id }, data: { ratoonCount: farm.ratoonCount - 1 } });
    }
  },
}));

export default router;
