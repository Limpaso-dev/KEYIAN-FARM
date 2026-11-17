import express from "express";
import prisma from "../../config/prisma.js";
import { RAW_MILK } from "../../config/catalog.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { moveStock, productByCode, stockOnHand } from "../../lib/stock.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";

// MVA's raw materials: the raw milk it processes and the cups yoghurt is
// packed in (config/catalog.js RAW_MATERIALS). Raw milk stays on the product
// ledger, as it also goes to Sales; the cups have a ledger of their own. Cups
// come in when MVA records them received and go out as yoghurt is packed,
// one cup a piece; a head corrects either after a physical count.

const lock = (tx, id) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`material:${id}`}))`;

const onHandOf = async (tx, materialId) => {
  const result = await tx.rawMaterialMovement.aggregate({ where: { materialId }, _sum: { quantity: true } });
  return round2(Number(result._sum.quantity || 0));
};

/**
 * Record a change to a raw material's stock. Taking out more than is on hand
 * is refused; `short` says what to do about it.
 */
export const moveMaterial = async (tx, { material, quantity, movementType, referenceType, referenceId, date, notes, short = "" }) => {
  const amount = round2(quantity);
  if (!amount) return null;
  await lock(tx, material.id);
  if (amount < 0) {
    const onHand = await onHandOf(tx, material.id);
    if (onHand + amount < -0.001) {
      throw conflict(`Not enough ${material.name} at MVA: ${onHand} ${material.unit} on hand, ${-amount} needed.${short ? ` ${short}` : ""}`);
    }
  }
  return tx.rawMaterialMovement.create({ data: { materialId: material.id, quantity: amount, movementType, referenceType, referenceId, date, notes } });
};

/**
 * Packing yoghurt uses a cup a piece (sign -1); deleting the output puts them
 * back (sign 1). made: [[productCode, pieces]].
 */
export const useCups = async (tx, batch, made, sign = -1) => {
  const materials = await tx.rawMaterial.findMany({ where: { isActive: true, usedFor: { in: made.map(([code]) => code) } } });
  for (const [code, pieces] of made) {
    const material = materials.find((m) => m.usedFor === code);
    if (!material || !(pieces > 0)) continue;
    await moveMaterial(tx, {
      material,
      quantity: sign * pieces,
      movementType: sign < 0 ? "production" : "production_reversal",
      referenceType: "processingBatch",
      referenceId: batch.id,
      date: batch.date,
      notes: sign < 0 ? batch.batchNumber : `${batch.batchNumber} deleted`,
      short: "Record the cups received under Raw materials first.",
    });
  }
};

/** Raw milk then the cups, each with what is on hand. */
const onHandList = async (db) => {
  const rawMilk = await productByCode(db, RAW_MILK);
  const [milk, materials, sums] = await Promise.all([
    stockOnHand(db, rawMilk.id, "mva"),
    db.rawMaterial.findMany({ where: { isActive: true } }),
    db.rawMaterialMovement.groupBy({ by: ["materialId"], _sum: { quantity: true } }),
  ]);
  const byMaterial = new Map(sums.map((row) => [row.materialId, round2(Number(row._sum.quantity || 0))]));
  // Smallest cup first: YOGHURT_150 before YOGHURT_1000.
  const size = (m) => Number(/_(\d+)$/.exec(m.usedFor || "")?.[1] || 0);
  return [
    { id: rawMilk.id, kind: "milk", code: rawMilk.code, name: rawMilk.name, unit: rawMilk.unit, onHand: milk },
    ...materials
      .sort((a, b) => size(a) - size(b) || a.name.localeCompare(b.name))
      .map((m) => ({ id: m.id, kind: "material", code: m.code, name: m.name, unit: m.unit, usedFor: m.usedFor, onHand: byMaterial.get(m.id) || 0 })),
  ];
};

const router = express.Router();

router.get("/", allow("rawMaterials", "read"), async (req, res) => {
  ok(res, await onHandList(prisma));
});

// Raw milk's movements at MVA and the cups', newest first, in one list.
router.get("/movements", allow("rawMaterials", "read"), async (req, res) => {
  const rawMilk = await productByCode(prisma, RAW_MILK);
  const range = dateRange("date", req.query);
  const take = Math.min(Number(req.query.limit) || 500, 2000);
  const [milk, cups] = await Promise.all([
    prisma.stockMovement.findMany({ where: { location: "mva", productId: rawMilk.id, ...range }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take }),
    prisma.rawMaterialMovement.findMany({ where: range, include: { material: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take }),
  ]);
  const rows = [
    ...milk.map((m) => ({ id: m.id, date: m.date, item: rawMilk.name, unit: rawMilk.unit, movementType: m.movementType, quantity: Number(m.quantity), notes: m.notes, createdAt: m.createdAt })),
    ...cups.map((m) => ({ id: m.id, date: m.date, item: m.material.name, unit: m.material.unit, movementType: m.movementType, quantity: Number(m.quantity), notes: m.notes, createdAt: m.createdAt })),
  ].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
  ok(res, rows.slice(0, take));
});

// Cups received, several sizes at once. The reference says where they came
// from (a delivery note, the requisition that bought them, Stores).
router.post("/receipts", allow("rawMaterials", "write"), async (req, res) => {
  const { date, reference } = parseBody({ date: "date!", reference: "text" }, req.body);
  const lines = parseItems(req.body.items, { materialId: "id!", quantity: "decimal" }, { label: "materials" }).filter((line) => line.quantity > 0);
  if (!lines.length) throw badRequest("Enter how many were received of at least one item");
  if (new Set(lines.map((line) => line.materialId)).size !== lines.length) throw badRequest("List each item only once");
  const receipt = await inTransaction(async (tx) => {
    const materials = await tx.rawMaterial.findMany({ where: { id: { in: lines.map((line) => line.materialId) }, isActive: true } });
    if (materials.length !== lines.length) throw badRequest("Every item must be one of MVA's raw materials");
    const receiptNumber = await nextNumber(tx, "RMR", date);
    for (const line of lines) {
      await moveMaterial(tx, {
        material: materials.find((m) => m.id === line.materialId),
        quantity: line.quantity,
        movementType: "received",
        referenceType: "rawMaterialReceipt",
        referenceId: receiptNumber,
        date,
        notes: [receiptNumber, reference].filter(Boolean).join(" · "),
      });
    }
    await audit(tx, { user: req.user, action: "receive", entity: "rawMaterial", metadata: { receiptNumber, date, reference, lines } });
    return { receiptNumber };
  });
  ok(res, receipt, 201, { message: `${receipt.receiptNumber} recorded and added to raw materials` });
});

// Correct raw milk or a material after a physical count. Head of department only.
router.post("/adjustments", allow("rawMaterials", "adjust"), async (req, res) => {
  const data = parseBody({ itemId: "id!", quantity: "signed!", date: "date!", reason: "text!" }, req.body);
  if (data.quantity === 0) throw badRequest("Enter a quantity to add (positive) or remove (negative)");
  const movement = await inTransaction(async (tx) => {
    const rawMilk = await productByCode(tx, RAW_MILK);
    let created;
    if (data.itemId === rawMilk.id) {
      created = await moveStock(tx, { productId: rawMilk.id, location: "mva", quantity: data.quantity, movementType: "adjustment", date: data.date, notes: data.reason });
    } else {
      const material = await tx.rawMaterial.findUnique({ where: { id: data.itemId } });
      if (!material) throw notFound("Raw material");
      created = await moveMaterial(tx, { material, quantity: data.quantity, movementType: "adjustment", date: data.date, notes: data.reason });
    }
    await audit(tx, { user: req.user, action: "stock_adjustment", entity: data.itemId === rawMilk.id ? "stockMovement" : "rawMaterialMovement", entityId: created.id, after: created });
    return created;
  });
  ok(res, movement, 201);
});

export default router;
