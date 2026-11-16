import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { parseBody } from "../../lib/validate.js";

const router = express.Router();
const farmBrief = { select: { id: true, farmNumber: true, fieldId: true, cropType: true, location: true } };

/** The Field ID as kept: in capitals, trimmed, with single spaces ("kf  7730 " -> "KF 7730"). */
const normaliseFieldId = (value) => (value == null ? value : String(value).trim().replace(/\s+/g, " ").toUpperCase());

// ---------------------------------------------------------------------
// Farms (sugarcane, tea, coffee, fodder). Registered once, then kept up to
// date through status changes and harvests.
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
    fieldId: "string!",
    cropType: "option:cropTypes!",
    variety: "string",
    acreage: "decimal!",
    hectares: "decimal",
    location: "string!",
    plantingDate: "date",
    cycleStartDate: "date",
    ratoonCount: "int",
    expectedTch: "decimal",
    dailyTarget: "decimal",
    status: "option:farmStatus",
    statusNote: "text",
    notes: "text",
  },
  // Status changes go through POST /:id/status so they are logged.
  updateFields: {
    farmNumber: "string!",
    fieldId: "string!",
    cropType: "option:cropTypes!",
    variety: "string",
    acreage: "decimal!",
    hectares: "decimal",
    location: "string!",
    plantingDate: "date",
    cycleStartDate: "date",
    ratoonCount: "int",
    expectedTch: "decimal",
    dailyTarget: "decimal",
    notes: "text",
  },
  include: { _count: { select: { harvests: true } } },
  // The Field ID is the farm's unique identification number: farms are searched by it.
  search: ["fieldId"],
  filters: ["cropType", "status"],
  orderBy: { farmNumber: "asc" },
  prepare: async (data, { tx, existing }) => {
    if (data.fieldId !== undefined) {
      data.fieldId = normaliseFieldId(data.fieldId);
      const holder = await tx.cropFarm.findFirst({ where: { fieldId: data.fieldId, ...(existing ? { id: { not: existing.id } } : {}) }, select: { farmNumber: true } });
      if (holder) throw conflict(`Field ID ${data.fieldId} is already registered to farm ${holder.farmNumber}`);
    }
    if (data.acreage !== undefined && !(data.acreage > 0)) throw badRequest("Acreage must be more than zero");
    if (data.ratoonCount !== undefined && data.ratoonCount !== null && data.ratoonCount < 0) throw badRequest("Ratoon count cannot be negative");
    if (data.hectares !== undefined && data.hectares !== null && data.acreage !== undefined && data.hectares > data.acreage) throw badRequest("Hectares cannot be more than the acreage");
  },
  // Log the status the farm was registered with, so reports for earlier
  // periods show where it stood before any later change. It is dated from
  // when the standing crop started, since farms are often registered after
  // the fact.
  afterWrite: async (farm, { tx, action }) => {
    if (action !== "create") return;
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const date = [farm.cycleStartDate, farm.plantingDate].filter((d) => d && d <= today).sort((x, y) => x - y)[0] || today;
    await tx.cropStatusLog.create({ data: { farmId: farm.id, date, status: farm.status, note: farm.statusNote } });
  },
  beforeDelete: async (farm, { tx }) => {
    if (await tx.cropHarvest.count({ where: { farmId: farm.id } })) throw conflict("This farm has harvest records and cannot be deleted");
  },
}));

// ---------------------------------------------------------------------
// Harvests. Each sugarcane harvest adds one to the farm's ratoon count and
// starts the next ratoon. Tea and coffee are recorded per plucking day,
// with that day's target copied from the farm.
// ---------------------------------------------------------------------
const harvestRouter = express.Router();
harvestRouter.post("/", allow("cropHarvests", "write"), async (req, res) => {
  const data = parseBody({
    farmId: "id!",
    harvestDate: "date!",
    quantity: "decimal!",
    unit: "option:harvestUnits!",
    target: "decimal",
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
    if (fields.target === undefined && farm.dailyTarget != null && ["tea", "coffee"].includes(farm.cropType)) fields.target = Number(farm.dailyTarget);
    const created = await tx.cropHarvest.create({ data: fields, include: { farm: farmBrief } });
    const update = {};
    // A cut starts the next ratoon. Reports count the crop's age from the
    // latest cut, so the cycle start recorded at registration is kept as is.
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
  updateFields: { quantity: "decimal!", unit: "option:harvestUnits!", target: "decimal", buyer: "string", amount: "decimal", notes: "text" },
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

// Crop reports (a summary, then one per crop) are department reports:
// GET /api/reports/department?department=crops&part=sugarcane (modules/reports).

export default router;
