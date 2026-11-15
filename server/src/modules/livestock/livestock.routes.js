import express from "express";
import prisma from "../../config/prisma.js";
import { DAIRY_SESSIONS, DISEASE_RECORD_TYPES, optionLabel, RAW_MILK } from "../../config/catalog.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { nairobiToday } from "../../lib/periods.js";
import { moveStock, productByCode } from "../../lib/stock.js";
import { parseBody, parseItems } from "../../lib/validate.js";

const router = express.Router();
const animalBrief = { select: { id: true, tagNumber: true, name: true, sex: true } };

/** Dairy A milks in the morning and evening; Dairy C also at midday. */
const checkSession = (dairy, session) => {
  if (!DAIRY_SESSIONS[dairy]?.includes(session)) {
    throw badRequest(`${optionLabel("dairies", dairy)} has no ${optionLabel("milkSessions", session).toLowerCase()} milking`);
  }
};

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

/**
 * The dates the herd report counts by: when a bought or donated animal
 * joined, and when an animal left (sold, died, culled; today if not given).
 * An active animal has not left; one born on the farm joined when born.
 */
const herdDates = (data, existing = {}) => {
  // Left blank, status and source keep their value (or the default: active, born on the farm).
  for (const key of ["status", "source"]) if (data[key] === null) delete data[key];
  const merged = { ...existing, ...data };
  if (merged.status === "active") {
    if (merged.exitDate) data.exitDate = null;
  } else if (!merged.exitDate) {
    data.exitDate = nairobiToday();
  }
  if (merged.source === "born_on_farm" && merged.acquiredDate) data.acquiredDate = null;
  const final = { ...existing, ...data };
  if (final.dateOfBirth && final.exitDate && final.exitDate < final.dateOfBirth) throw badRequest("The date it left the herd is before it was born");
  if (final.dateOfBirth && final.acquiredDate && final.acquiredDate < final.dateOfBirth) throw badRequest("The date it was bought or received is before it was born");
  if (final.acquiredDate && final.exitDate && final.exitDate < final.acquiredDate) throw badRequest("The date it left the herd is before it joined");
};

router.use("/animals", crud({
  resource: "animals",
  model: "animal",
  fields: {
    tagNumber: "string!",
    name: "string",
    breed: "string",
    sex: "option:animalSex!",
    dairy: "option:dairies!",
    dateOfBirth: "date",
    source: "option:animalSource",
    acquiredDate: "date",
    damId: "id",
    sireId: "id",
    sireDetails: "string",
    status: "option:animalStatus",
    exitDate: "date",
    notes: "text",
  },
  include: { dam: animalBrief, sire: animalBrief },
  search: ["tagNumber", "name", "breed"],
  filters: ["sex", "status", "breed", "dairy"],
  orderBy: { tagNumber: "asc" },
  prepare: async (data, { tx, existing }) => {
    await checkParents(tx, data, existing?.id);
    herdDates(data, existing || { status: "active", source: "born_on_farm" });
  },
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
// Calving: registers the calf (or twins) with the mother and father, in
// the mother's dairy, and opens the mother's next lactation.
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
    twins: "bool",
    twinTagNumber: "string",
    twinName: "string",
    twinSex: "option:animalSex",
    notes: "text",
  }, req.body);
  if (data.twins) {
    if (!data.twinTagNumber || !data.twinSex) throw badRequest("Enter the second calf's tag number and sex");
    if (data.twinTagNumber.toLowerCase() === data.calfTagNumber.toLowerCase()) throw badRequest("The twins need different tag numbers");
  }
  const result = await inTransaction(async (tx) => {
    await checkParents(tx, data);
    const dam = await tx.animal.findUnique({ where: { id: data.damId } });
    if (dam.status !== "active") throw conflict("The mother is not an active animal");
    const tags = data.twins ? [data.calfTagNumber, data.twinTagNumber] : [data.calfTagNumber];
    const taken = await tx.animal.findFirst({ where: { OR: tags.map((tag) => ({ tagNumber: { equals: tag, mode: "insensitive" } })) } });
    if (taken) throw conflict(`Tag ${taken.tagNumber} is already in the herd register`);

    await tx.lactation.updateMany({ where: { animalId: dam.id, status: "milking" }, data: { status: "dry", dryOffDate: data.calvingDate } });
    const born = (tagNumber, name, sex) => tx.animal.create({
      data: {
        tagNumber,
        name,
        sex,
        breed: data.calfBreed || dam.breed,
        dairy: dam.dairy,
        dateOfBirth: data.calvingDate,
        source: "born_on_farm",
        damId: dam.id,
        sireId: data.sireId,
        sireDetails: data.sireDetails,
      },
    });
    const calf = await born(data.calfTagNumber, data.calfName, data.calfSex);
    const twin = data.twins ? await born(data.twinTagNumber, data.twinName, data.twinSex) : null;
    const lactation = await tx.lactation.create({
      data: {
        animalId: dam.id,
        lactationNumber: dam.lactationCount + 1,
        calvingDate: data.calvingDate,
        calfId: calf.id,
        twinCalfId: twin?.id ?? null,
        notes: data.notes,
      },
    });
    await tx.animal.update({ where: { id: dam.id }, data: { lactationCount: dam.lactationCount + 1 } });
    await audit(tx, { user: req.user, action: "calving", entity: "animal", entityId: dam.id, after: { calf, twin, lactation } });
    return { calf, twin, lactation };
  });
  const message = result.twin
    ? `Twins registered: ${result.calf.tagNumber} and ${result.twin.tagNumber}`
    : `Calf ${result.calf.tagNumber} registered`;
  ok(res, result, 201, { message });
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
    include: { animal: animalBrief, calf: animalBrief, twinCalf: animalBrief },
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
  include: { animal: animalBrief, calf: animalBrief, twinCalf: animalBrief },
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
    vaccine: "option:vaccines!",
    date: "date!",
    dose: "string",
    nextDueDate: "date",
    administeredBy: "string",
    notes: "text",
  },
  include: { animal: animalBrief },
  dateField: "date",
  filters: ["animalId", "vaccine"],
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

/**
 * A disease case names the disease (from the list); a treatment names the
 * disease or describes the treatment; "Other" is written in the details.
 * Checks, deworming and dipping describe what was done instead.
 */
const checkHealth = (data, existing = {}) => {
  const merged = { ...existing, ...data };
  if (!DISEASE_RECORD_TYPES.includes(merged.recordType)) {
    if (merged.disease) data.disease = null;
    if (!merged.condition) throw badRequest("Say what was done or checked");
    return;
  }
  if (merged.recordType === "disease" && !merged.disease) throw badRequest("Choose the disease");
  if (merged.disease === "other" && !merged.condition) throw badRequest("Write the disease in the details");
  if (!merged.disease && !merged.condition) throw badRequest("Choose the disease treated, or describe the treatment");
};

router.use("/health-records", crud({
  resource: "healthRecords",
  model: "healthRecord",
  fields: {
    animalId: "id",
    recordType: "option:healthRecordTypes!",
    date: "date!",
    disease: "option:diseases",
    condition: "string",
    treatment: "text",
    vet: "string",
    cost: "decimal",
    outcome: "option:healthOutcomes",
    notes: "text",
  },
  include: { animal: animalBrief },
  dateField: "date",
  filters: ["animalId", "recordType", "outcome", "disease"],
  search: ["condition", "treatment"],
  orderBy: { date: "desc" },
  prepare: (data, { existing }) => checkHealth(data, existing),
}));

// ---------------------------------------------------------------------
// Milk records: kilograms per cow per session, entered in bulk for one
// dairy's milking.
// ---------------------------------------------------------------------
const milkRouter = express.Router();
milkRouter.post("/", allow("milkRecords", "write"), async (req, res) => {
  const { date, dairy, session } = parseBody({ date: "date!", dairy: "option:dairies!", session: "option:milkSessions!" }, req.body);
  checkSession(dairy, session);
  const lines = parseItems(req.body.records, { animalId: "id!", kg: "decimal!" }, { label: "milk records" })
    .filter((line) => line.kg > 0);
  if (!lines.length) throw badRequest("Enter the kilograms for at least one cow");
  const result = await inTransaction(async (tx) => {
    const ids = [...new Set(lines.map((line) => line.animalId))];
    if (ids.length !== lines.length) throw badRequest("Each cow can appear only once per session");
    const cows = await tx.animal.findMany({ where: { id: { in: ids }, sex: "female", status: "active", dairy } });
    if (cows.length !== ids.length) throw badRequest(`Milk can only be recorded for active cows at ${optionLabel("dairies", dairy)}`);
    const saved = [];
    for (const line of lines) {
      saved.push(await tx.milkRecord.upsert({
        where: { animalId_date_session: { animalId: line.animalId, date, session } },
        create: { animalId: line.animalId, date, dairy, session, kg: line.kg },
        update: { kg: line.kg, dairy },
      }));
    }
    await audit(tx, { user: req.user, action: "record_milk", entity: "milkRecord", metadata: { date, dairy, session, cows: saved.length } });
    return saved;
  });
  ok(res, result, 201, { message: `Saved milk for ${result.length} cow(s)` });
});

// Daily totals by dairy and session, plus what was already sent to MVA.
milkRouter.get("/daily", allow("milkRecords", "read"), async (req, res) => {
  const where = dateRange("date", req.query);
  const records = await prisma.milkRecord.groupBy({ by: ["date", "dairy", "session"], where, _sum: { kg: true }, _count: true, orderBy: { date: "desc" } });
  const transfers = await prisma.milkTransfer.groupBy({ by: ["date", "dairy", "session"], where, _sum: { kg: true } });
  const keyOf = (row) => `${row.date.toISOString()}|${row.dairy}|${row.session}`;
  const sent = new Map(transfers.map((row) => [keyOf(row), Number(row._sum.kg || 0)]));
  ok(res, records.map((row) => ({
    date: row.date,
    dairy: row.dairy,
    session: row.session,
    cows: row._count,
    kg: Number(row._sum.kg || 0),
    sentToMva: sent.get(keyOf(row)) || 0,
  })));
});

router.use("/milk-records", crud({
  router: milkRouter,
  resource: "milkRecords",
  model: "milkRecord",
  fields: {},
  updateFields: { kg: "decimal!" },
  include: { animal: animalBrief },
  dateField: "date",
  filters: ["animalId", "session", "dairy"],
  orderBy: [{ date: "desc" }, { dairy: "asc" }, { session: "asc" }],
  create: false,
}));

// ---------------------------------------------------------------------
// Milk transfers to MVA, in kilograms. Livestock sends; MVA confirms what
// arrived, and only then does the milk enter MVA's raw milk stock (kg).
// ---------------------------------------------------------------------
const transferRouter = express.Router();
transferRouter.post("/", allow("milkTransfers", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", dairy: "option:dairies!", session: "option:milkSessions!", kg: "decimal!", notes: "text" }, req.body);
  checkSession(data.dairy, data.session);
  if (!(data.kg > 0)) throw badRequest("The kilograms sent must be more than zero");
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
  const { receivedKg, notes } = parseBody({ receivedKg: "decimal!", notes: "text" }, req.body);
  const transfer = await inTransaction(async (tx) => {
    const existing = await tx.milkTransfer.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Milk transfer");
    if (existing.status !== "sent") throw conflict("This transfer has already been received");
    if (receivedKg > Number(existing.kg)) throw badRequest("The kilograms received cannot be more than the kilograms sent");
    const rawMilk = await productByCode(tx, RAW_MILK);
    const updated = await tx.milkTransfer.update({
      where: { id: existing.id },
      data: {
        status: "received",
        receivedKg,
        receivedAt: new Date(),
        receivedById: req.user.id,
        notes: [existing.notes, notes].filter(Boolean).join(" | ") || null,
      },
    });
    await moveStock(tx, {
      productId: rawMilk.id,
      location: "mva",
      quantity: receivedKg,
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
  updateFields: { dairy: "option:dairies!", session: "option:milkSessions!", kg: "decimal!", notes: "text" },
  dateField: "date",
  filters: ["status", "session", "dairy"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  prepare: (data, { existing }) => {
    if (existing.status !== "sent") throw conflict("A received transfer cannot be changed");
    if (data.kg !== undefined && !(data.kg > 0)) throw badRequest("The kilograms sent must be more than zero");
    const merged = { ...existing, ...data };
    checkSession(merged.dairy, merged.session);
  },
  beforeDelete: (transfer) => {
    if (transfer.status !== "sent") throw conflict("A received transfer cannot be deleted");
  },
}));

export default router;
