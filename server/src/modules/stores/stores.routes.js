import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { nairobiToday } from "../../lib/periods.js";
import { takeStoreItem } from "../../lib/stock.js";
import { parseBody } from "../../lib/validate.js";

// Stores keeps quantities only: no costs, suppliers, delivery notes or
// purchase orders. Departments ask for items by word of mouth, so stock out
// is not tied to requisitions.

const router = express.Router();
const itemBrief = { select: { id: true, code: true, name: true, unit: true, category: true } };

// ---------------------------------------------------------------------
// Items. Quantity on hand changes only through goods received and stock out; the
// opening quantity, and the day it was counted, are set when the item is added.
// ---------------------------------------------------------------------
router.get("/items/low-stock", allow("storeItems", "read"), async (req, res) => {
  const items = await prisma.storeItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  ok(res, items.filter((item) => Number(item.quantityOnHand) <= Number(item.reorderLevel)));
});

router.use("/items", crud({
  resource: "storeItems",
  model: "storeItem",
  label: "Store item",
  fields: {
    code: "string",
    name: "string!",
    category: "option:storeCategories!",
    unit: "string!",
    openingQuantity: "decimal",
    openingDate: "date",
    reorderLevel: "decimal",
  },
  updateFields: { name: "string!", category: "option:storeCategories!", unit: "string!", reorderLevel: "decimal", isActive: "bool" },
  prepare: (data, { existing }) => {
    if (existing) return data;
    const opening = data.openingQuantity || 0;
    if (opening < 0) throw badRequest("The opening quantity cannot be negative");
    return { ...data, openingQuantity: opening, quantityOnHand: opening, openingDate: data.openingDate || nairobiToday() };
  },
  search: ["code", "name"],
  filters: ["category", "isActive"],
  orderBy: [{ category: "asc" }, { name: "asc" }],
  numbering: { field: "code", prefix: "ITM", yearly: false },
  beforeDelete: async (item, { tx }) => {
    const used = await tx.storeReceipt.count({ where: { itemId: item.id } }) + await tx.storeIssue.count({ where: { itemId: item.id } });
    if (used) throw conflict("This item has stock history. Mark it inactive instead.");
  },
}));

// ---------------------------------------------------------------------
// Goods received into stores
// ---------------------------------------------------------------------
const receiptRouter = express.Router();
receiptRouter.post("/", allow("storeReceipts", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    itemId: "id!",
    quantity: "decimal!",
    source: "option:receiptSources!",
    notes: "text",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  const receipt = await inTransaction(async (tx) => {
    const item = await tx.storeItem.findUnique({ where: { id: data.itemId } });
    if (!item) throw notFound("Store item");
    const created = await tx.storeReceipt.create({
      data: { ...data, receiptNumber: await nextNumber(tx, "GRN", data.date) },
      include: { item: itemBrief },
    });
    await tx.storeItem.update({ where: { id: item.id }, data: { quantityOnHand: { increment: data.quantity } } });
    await audit(tx, { user: req.user, action: "create", entity: "storeReceipt", entityId: created.id, after: created });
    return created;
  });
  ok(res, receipt, 201);
});
router.use("/receipts", crud({
  router: receiptRouter,
  resource: "storeReceipts",
  model: "storeReceipt",
  fields: {},
  include: { item: itemBrief },
  dateField: "date",
  filters: ["itemId", "source"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Stock out: items handed to departments (feeds to Livestock, tools to
// MVA, fertiliser to Crops, ...). Numbered SO-year-number.
// ---------------------------------------------------------------------
const issueRouter = express.Router();
issueRouter.post("/", allow("storeIssues", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    itemId: "id!",
    quantity: "decimal!",
    department: "option:departments!",
    issuedTo: "string!",
    purpose: "text",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  const issue = await inTransaction(async (tx) => {
    await takeStoreItem(tx, data.itemId, data.quantity);
    const created = await tx.storeIssue.create({
      data: { ...data, issueNumber: await nextNumber(tx, "SO", data.date) },
      include: { item: itemBrief },
    });
    await audit(tx, { user: req.user, action: "create", entity: "storeIssue", entityId: created.id, after: created });
    return created;
  });
  ok(res, issue, 201);
});
router.use("/issues", crud({
  router: issueRouter,
  resource: "storeIssues",
  model: "storeIssue",
  fields: {},
  include: { item: itemBrief },
  dateField: "date",
  filters: ["itemId", "department"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

export default router;
