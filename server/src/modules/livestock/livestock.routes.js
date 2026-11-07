import express from "express";
import prisma from "../../config/prisma.js";
import { RAW_MILK } from "../../config/catalog.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { moveStock, productByCode } from "../../lib/stock.js";
import { parseBody, parseItems } from "../../lib/validate.js";

const router = express.Router();
const animalBrief = { select: { id: true, tagNumber: true, name: true, sex: true } };

// ---------------------------------------------------------------------
// Animals
// ---------------------------------------------------------------------
const checkParents = async (tx, data, selfId) => {
  if (data.damId) {
    if (data.damId === selfId) throw badRequest("An animal cannot be its own mother");
    const dam = await tx.animal.findUnique({ where: { id: data.damId } });
    if (!dam || dam.sex !== "female") throw badRequest("The mother (dam) must be a registered female animal");
  }
  if (data.sireId) {
    if (data.sireId === selfId) throw badRequest("An animal cannot be its own father");
    const sire = await tx.animal.findUnique({ where: { id: data.sireId } });
    if (!sire || sire.sex !== "male") throw badRequest("The father (sire) must be a registered male animal");
  }
};

router.use("/animals", crud({
  resource: "animals",
  model: "animal",
  fields: {
    tagNumber: "string!",
    name: "string",
    breed: "string",
    sex: "option:animalSex!",
    dateOfBirth: "date",
    source: "option:animalSource",
    damId: "id",
    sireId: "id",
    sireDetails: "string",
    status: "option:animalStatus",
    notes: "text",
  },
  include: { dam: animalBrief, sire: animalBrief },
  search: ["tagNumber", "name", "breed"],
  filters: ["sex", "status", "breed"],
  orderBy: { tagNumber: "asc" },
  prepare: (data, { tx, existing }) => checkParents(tx, data, existing?.id),
  beforeDelete: async (animal, { tx }) => {
    const [milk, lactations, calves] = await Promise.all([
      tx.milkRecord.count({ where: { animalId: animal.id } }),
      tx.lactation.count({ where: { animalId: animal.id } }),
      tx.animal.count({ where: { OR: [{ damId: animal.id }, { sireId: animal.id }] } }),
    ]);
    if (milk || lactations || calves) throw conflict("This animal has history. Change its status (sold, dead, culled) instead of deleting it.");
  },
}));

// ---------------------------------------------------------------------
// Calving: registers the calf with its mother/father and opens a new
// lactation for the mother.
// ---------------------------------------------------------------------
router.post("/calvings", allow("lactations", "write"), async (req, res) => {
  const data = parseBody({
    damId: "id!",
    sireId: "id",
    sireDetails: "string",
    calvingDate: "date!",
    calfTagNumber: "string!",
    calfName: "string",
    calfSex: "option:animalSex!",
    calfBreed: "string",
    notes: "text",
  }, req.body);
  const result = await inTransaction(async (tx) => {
    await checkParents(tx, data);
    const dam = await tx.animal.findUnique({ where: { id: data.damId } });
    if (dam.status !== "active") throw conflict("The mother is not an active animal");
    await tx.lactation.updateMany({ where: { animalId: dam.id, status: "milking" }, data: { status: "dry", dryOffDate: data.calvingDate } });
    const calf = await tx.animal.create({
      data: {
        tagNumber: data.calfTagNumber,
        name: data.calfName,
        sex: data.calfSex,
        breed: data.calfBreed || dam.breed,
        dateOfBirth: data.calvingDate,
        source: "born_on_farm",
        damId: dam.id,
        sireId: data.sireId,
        sireDetails: data.sireDetails,
      },
    });
    const lactation = await tx.lactation.create({
      data: {
        animalId: dam.id,
        lactationNumber: dam.lactationCount + 1,
        calvingDate: data.calvingDate,
        calfId: calf.id,
        notes: data.notes,
      },
    });
    await tx.animal.update({ where: { id: dam.id }, data: { lactationCount: dam.lactationCount + 1 } });
    await audit(tx, { user: req.user, action: "calving", entity: "animal", entityId: dam.id, after: { calf, lactation } });
    return { calf, lactation };
  });
  ok(res, result, 201);
});

const lactationRouter = express.Router();
lactationRouter.post("/:id/dry-off", allow("lactations", "write"), async (req, res) => {
  const { dryOffDate } = parseBody({ dryOffDate: "date!" }, req.body);
  const lactation = await prisma.lactation.findUnique({ where: { id: req.params.id } });
  if (!lactation) throw notFound("Lactation");
  if (lactation.status !== "milking") throw conflict("This lactation has already ended");
  if (dryOffDate < lactation.calvingDate) throw badRequest("Dry-off date is before the calving date");
  const updated = await prisma.lactation.update({
    where: { id: lactation.id },
    data: { status: "dry", dryOffDate },
    include: { animal: animalBrief },
  });
  await audit(prisma, { user: req.user, action: "dry_off", entity: "lactation", entityId: lactation.id });
  ok(res, updated);
});
router.use("/lactations", crud({
  router: lactationRouter,
  resource: "lactations",
  model: "lactation",
  fields: {},
  updateFields: { notes: "text" },
  include: { animal: animalBrief },
  dateField: "calvingDate",
  filters: ["animalId", "status"],
  orderBy: { calvingDate: "desc" },
  create: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Vaccinations and health
// ---------------------------------------------------------------------
router.use("/vaccinations", crud({
  resource: "vaccinations",
  model: "vaccination",
  fields: {
    animalId: "id!",
    vaccine: "string!",
    date: "date!",
    dose: "string",
    nextDueDate: "date",
    administeredBy: "string",
    notes: "text",
  },
  include: { animal: animalBrief },
  dateField: "date",
  filters: ["animalId"],
  search: ["vaccine"],
  orderBy: { date: "desc" },
}));

router.get("/vaccinations-due", allow("vaccinations", "read"), async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 180);
  const rows = await prisma.vaccination.findMany({
    where: { nextDueDate: { not: null, lte: new Date(Date.now() + days * 86400000) }, animal: { status: "active" } },
    include: { animal: animalBrief },
    orderBy: { nextDueDate: "asc" },
  });
  ok(res, rows);
});

router.use("/health-records", crud({
  resource: "healthRecords",
  model: "healthRecord",
  fields: {
    animalId: "id",
    recordType: "option:healthRecordTypes!",
    date: "date!",
    condition: "string!",
    treatment: "text",
    vet: "string",
    cost: "decimal",
    outcome: "option:healthOutcomes",
    notes: "text",
  },
  include: { animal: animalBrief },
  dateField: "date",
  filters: ["animalId", "recordType", "outcome"],
  search: ["condition", "treatment"],
  orderBy: { date: "desc" },
}));

// ---------------------------------------------------------------------
// Milk records: one entry per cow per session; entered in bulk.
// ---------------------------------------------------------------------
const milkRouter = express.Router();
milkRouter.post("/", allow("milkRecords", "write"), async (req, res) => {
  const { date, session } = parseBody({ date: "date!", session: "option:milkSessions!" }, req.body);
  const lines = parseItems(req.body.records, { animalId: "id!", litres: "decimal!" }, { label: "milk records" })
    .filter((line) => line.litres > 0);
  if (!lines.length) throw badRequest("Enter litres for at least one cow");
  const result = await inTransaction(async (tx) => {
    const ids = [...new Set(lines.map((line) => line.animalId))];
    if (ids.length !== lines.length) throw badRequest("Each cow can appear only once per session");
    const cows = await tx.animal.findMany({ where: { id: { in: ids }, sex: "female", status: "active" } });
    if (cows.length !== ids.length) throw badRequest("Milk can only be recorded for active female animals");
    const saved = [];
    for (const line of lines) {
      saved.push(await tx.milkRecord.upsert({
        where: { animalId_date_session: { animalId: line.animalId, date, session } },
        create: { animalId: line.animalId, date, session, litres: line.litres },
        update: { litres: line.litres },
      }));
    }
    await audit(tx, { user: req.user, action: "record_milk", entity: "milkRecord", metadata: { date, session, cows: saved.length } });
    return saved;
  });
  ok(res, result, 201, { message: `Saved milk for ${result.length} cow(s)` });
});

// Daily totals by session, plus what was already sent to MVA.
milkRouter.get("/daily", allow("milkRecords", "read"), async (req, res) => {
  const where = dateRange("date", req.query);
  const records = await prisma.milkRecord.groupBy({ by: ["date", "session"], where, _sum: { litres: true }, _count: true, orderBy: { date: "desc" } });
  const transfers = await prisma.milkTransfer.groupBy({ by: ["date", "session"], where, _sum: { litres: true } });
  const sent = new Map(transfers.map((row) => [`${row.date.toISOString()}|${row.session}`, Number(row._sum.litres || 0)]));
  ok(res, records.map((row) => ({
    date: row.date,
    session: row.session,
    cows: row._count,
    litres: Number(row._sum.litres || 0),
    sentToMva: sent.get(`${row.date.toISOString()}|${row.session}`) || 0,
  })));
});

router.use("/milk-records", crud({
  router: milkRouter,
  resource: "milkRecords",
  model: "milkRecord",
  fields: {},
  updateFields: { litres: "decimal!" },
  include: { animal: animalBrief },
  dateField: "date",
  filters: ["animalId", "session"],
  orderBy: [{ date: "desc" }, { session: "asc" }],
  create: false,
}));

// ---------------------------------------------------------------------
// Milk transfers to MVA. Livestock sends; MVA confirms what arrived, and
// only then does the milk enter MVA's raw milk stock.
// ---------------------------------------------------------------------
const transferRouter = express.Router();
transferRouter.post("/", allow("milkTransfers", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", session: "option:milkSessions!", litres: "decimal!", notes: "text" }, req.body);
  if (!(data.litres > 0)) throw badRequest("Litres must be more than zero");
  const transfer = await inTransaction(async (tx) => {
    const created = await tx.milkTransfer.create({
      data: { ...data, transferNumber: await nextNumber(tx, "MTR", data.date) },
    });
    await audit(tx, { user: req.user, action: "create", entity: "milkTransfer", entityId: created.id, after: created });
    return created;
  });
  ok(res, transfer, 201);
});

transferRouter.post("/:id/receive", allow("milkTransfers", "receive"), async (req, res) => {
  const { receivedLitres, notes } = parseBody({ receivedLitres: "decimal!", notes: "text" }, req.body);
  const transfer = await inTransaction(async (tx) => {
    const existing = await tx.milkTransfer.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Milk transfer");
    if (existing.status !== "sent") throw conflict("This transfer has already been received");
    if (receivedLitres > Number(existing.litres)) throw badRequest("Received litres cannot be more than the litres sent");
    const rawMilk = await productByCode(tx, RAW_MILK);
    const updated = await tx.milkTransfer.update({
      where: { id: existing.id },
      data: {
        status: "received",
        receivedLitres,
        receivedAt: new Date(),
        receivedById: req.user.id,
        notes: [existing.notes, notes].filter(Boolean).join(" | ") || null,
      },
    });
    await moveStock(tx, {
      productId: rawMilk.id,
      location: "mva",
      quantity: receivedLitres,
      movementType: "livestock_transfer",
      referenceType: "milkTransfer",
      referenceId: existing.id,
      date: existing.date,
      notes: `From Livestock ${existing.transferNumber}`,
    });
    await audit(tx, { user: req.user, action: "receive", entity: "milkTransfer", entityId: existing.id, before: existing, after: updated });
    return updated;
  });
  ok(res, transfer);
});

router.use("/milk-transfers", crud({
  router: transferRouter,
  resource: "milkTransfers",
  model: "milkTransfer",
  fields: {},
  updateFields: { litres: "decimal!", notes: "text" },
  dateField: "date",
  filters: ["status", "session"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  prepare: (data, { existing }) => {
    if (existing.status !== "sent") throw conflict("A received transfer cannot be changed");
    if (data.litres !== undefined && !(data.litres > 0)) throw badRequest("Litres must be more than zero");
  },
  beforeDelete: (transfer) => {
    if (transfer.status !== "sent") throw conflict("A received transfer cannot be deleted");
  },
}));

export default router;
