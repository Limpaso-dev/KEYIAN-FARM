import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { takeStoreItem } from "../../lib/stock.js";
import { parseBody } from "../../lib/validate.js";

const router = express.Router();
const itemBrief = { select: { id: true, code: true, name: true, unit: true, category: true } };

// ---------------------------------------------------------------------
// Items. Quantity on hand changes only through receipts and issues;
// the opening quantity can be set when the item is created.
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
    quantityOnHand: "decimal",
    reorderLevel: "decimal",
    unitCost: "decimal",
  },
  updateFields: { name: "string!", category: "option:storeCategories!", unit: "string!", reorderLevel: "decimal", unitCost: "decimal", isActive: "bool" },
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
    unitCost: "decimal",
    source: "option:receiptSources!",
    supplierId: "id",
    deliveryNote: "string",
    notes: "text",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  const receipt = await inTransaction(async (tx) => {
    const item = await tx.storeItem.findUnique({ where: { id: data.itemId } });
    if (!item) throw notFound("Store item");
    const created = await tx.storeReceipt.create({
      data: { ...data, unitCost: data.unitCost ?? item.unitCost, receiptNumber: await nextNumber(tx, "GRN", data.date) },
      include: { item: itemBrief, supplier: { select: { id: true, name: true } } },
    });
    await tx.storeItem.update({
      where: { id: item.id },
      data: { quantityOnHand: { increment: data.quantity }, ...(data.unitCost ? { unitCost: data.unitCost } : {}) },
    });
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
  include: { item: itemBrief, supplier: { select: { id: true, name: true } }, purchaseOrder: { select: { id: true, poNumber: true } } },
  dateField: "date",
  filters: ["itemId", "source", "supplierId"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Issues to departments (feeds to Livestock, tools to MVA, fertiliser to
// Crops, ...). Optionally against an approved requisition.
// ---------------------------------------------------------------------
const issueRouter = express.Router();
issueRouter.post("/", allow("storeIssues", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    itemId: "id!",
    quantity: "decimal!",
    department: "option:departments!",
    issuedTo: "string!",
    requisitionId: "id",
    purpose: "text",
    markRequisitionFulfilled: "bool",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  const { markRequisitionFulfilled, ...fields } = data;
  const issue = await inTransaction(async (tx) => {
    if (fields.requisitionId) {
      const requisition = await tx.requisition.findUnique({ where: { id: fields.requisitionId } });
      if (!requisition) throw notFound("Requisition");
      if (requisition.status !== "approved") throw conflict("Only approved requisitions can be issued against");
      if (requisition.department !== fields.department) throw badRequest("The requisition belongs to a different department");
      if (markRequisitionFulfilled) {
        await tx.requisition.update({ where: { id: requisition.id }, data: { status: "fulfilled", fulfilledAt: new Date() } });
      }
    }
    await takeStoreItem(tx, fields.itemId, fields.quantity);
    const created = await tx.storeIssue.create({
      data: { ...fields, issueNumber: await nextNumber(tx, "ISS", fields.date) },
      include: { item: itemBrief, requisition: { select: { id: true, requisitionNumber: true } } },
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
  include: { item: itemBrief, requisition: { select: { id: true, requisitionNumber: true } } },
  dateField: "date",
  filters: ["itemId", "department"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

export default router;
