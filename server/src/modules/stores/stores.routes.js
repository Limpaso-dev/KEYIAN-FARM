import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { nairobiToday } from "../../lib/periods.js";
import { takeStoreItem } from "../../lib/stock.js";
import { parseBody, parseItems } from "../../lib/validate.js";

// Stores keeps quantities only: no costs, prices or item codes (items are
// known by name). Departments ask for items through store requests
// (storeRequests.routes.js), or by word of mouth; either way what is handed
// over is recorded as stock out. Accounts' purchase orders reach Stores as
// deliveries to expect, without their prices.

const router = express.Router();
export const itemBrief = { select: { id: true, name: true, unit: true, category: true } };

/** "out" (nothing left), "low" (at or below the reorder level) or "ok". */
export const stockState = (item) => {
  const onHand = Number(item.quantityOnHand);
  if (onHand <= 0) return "out";
  return onHand <= Number(item.reorderLevel) ? "low" : "ok";
};

/** No two items share a name, since the name is what tells them apart. */
const checkName = async (tx, name, id) => {
  if (!name) return;
  const same = await tx.storeItem.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
  if (same) throw conflict(`There is already an item called "${same.name}"${same.isActive ? "" : " (inactive)"}`);
};

// ---------------------------------------------------------------------
// Items. Quantity on hand changes only through goods received and stock out; the
// opening quantity, and the day it was counted, are set when the item is added.
// ---------------------------------------------------------------------
// The stock in the store now: every item in use, with what it holds.
// ?state=low (low or out of stock) or ?state=out; ?category; ?search.
router.get("/stock", allow("storeItems", "read"), async (req, res) => {
  const where = { isActive: true };
  if (req.query.category) where.category = String(req.query.category);
  const term = String(req.query.search || "").trim();
  if (term) where.name = { contains: term, mode: "insensitive" };
  const items = await prisma.storeItem.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const rows = items.map((item) => ({ ...item, state: stockState(item) }));
  const state = req.query.state;
  ok(res, state === "low" ? rows.filter((r) => r.state !== "ok") : state === "out" ? rows.filter((r) => r.state === "out") : rows);
});

// An item's stock card: the opening count, then every delivery and stock out
// in date order, with the balance after each.
router.get("/items/:id/card", allow("storeItems", "read"), async (req, res) => {
  const item = await prisma.storeItem.findUnique({
    where: { id: req.params.id },
    include: {
      receipts: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      issues: { orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { request: { select: { requestNumber: true } } } },
    },
  });
  if (!item) throw notFound("Store item");
  const moves = [
    ...item.receipts.map((r) => ({ date: r.date, at: r.createdAt, kind: "received", reference: r.receiptNumber, detail: r.notes || "", quantity: Number(r.quantity) })),
    ...item.issues.map((i) => ({ date: i.date, at: i.createdAt, kind: "out", reference: i.issueNumber, department: i.department, detail: [i.issuedTo, i.request?.requestNumber].filter(Boolean).join(" · "), quantity: -Number(i.quantity) })),
  ].sort((a, b) => a.date - b.date || a.at - b.at);
  let balance = Number(item.openingQuantity);
  const lines = [{ date: item.openingDate || item.createdAt, kind: "opening", reference: "", detail: "Counted when the item was added", quantity: balance, balance }];
  for (const move of moves) {
    balance = Math.round((balance + move.quantity) * 100) / 100;
    lines.push({ ...move, at: undefined, balance });
  }
  ok(res, { id: item.id, name: item.name, unit: item.unit, quantityOnHand: Number(item.quantityOnHand), lines });
});

router.use("/items", crud({
  resource: "storeItems",
  model: "storeItem",
  label: "Store item",
  fields: {
    name: "string!",
    category: "option:storeCategories!",
    unit: "string!",
    openingQuantity: "decimal",
    openingDate: "date",
    reorderLevel: "decimal",
  },
  updateFields: { name: "string!", category: "option:storeCategories!", unit: "string!", reorderLevel: "decimal", isActive: "bool" },
  prepare: async (data, { tx, existing }) => {
    await checkName(tx, data.name, existing?.id);
    if (existing) return data;
    const opening = data.openingQuantity || 0;
    if (opening < 0) throw badRequest("The opening quantity cannot be negative");
    return { ...data, openingQuantity: opening, quantityOnHand: opening, openingDate: data.openingDate || nairobiToday() };
  },
  search: ["name"],
  filters: ["category", "isActive"],
  orderBy: [{ category: "asc" }, { name: "asc" }],
  beforeDelete: async (item, { tx }) => {
    const used = await tx.storeReceipt.count({ where: { itemId: item.id } }) + await tx.storeIssue.count({ where: { itemId: item.id } });
    if (used) throw conflict("This item has stock history. Mark it inactive instead.");
    if (await tx.storeRequestItem.count({ where: { itemId: item.id } })) throw conflict("Departments have asked for this item. Mark it inactive instead.");
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
// MVA, fertiliser to Crops, ...). Numbered SO-year-number. Dispatching a
// store request records its stock out too, linked to the request.
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
// ---------------------------------------------------------------------
// Deliveries: each purchase order Accounts raises is a delivery Stores
// expects. Stores records what arrived (all of it, or part, then the rest);
// store items on the order come into stock as goods received, and Accounts
// is told (accounts.routes.js counts deliveries since it last looked).
// ---------------------------------------------------------------------
const WAITING = ["ordered", "partially_received"];
const deliverySelect = {
  id: true,
  poNumber: true,
  date: true,
  status: true,
  notes: true,
  deliveredAt: true,
  deliveryNote: true,
  createdAt: true,
  supplier: { select: { name: true } },
  deliveredBy: { select: { name: true } },
  items: { select: { id: true, description: true, quantity: true, quantityReceived: true, storeItem: itemBrief } },
};

router.get("/deliveries", allow("storeReceipts", "read"), async (req, res) => {
  const where = { status: { not: "cancelled" }, ...dateRange("date", req.query) };
  const status = String(req.query.status || "");
  if (status === "waiting") where.status = { in: WAITING };
  else if (status) where.status = status;
  const rows = await prisma.purchaseOrder.findMany({ where, select: deliverySelect, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 });
  ok(res, rows);
});

router.post("/deliveries/:id/receive", allow("storeReceipts", "write"), async (req, res) => {
  const { date, deliveryNote } = parseBody({ date: "date!", deliveryNote: "text" }, req.body);
  const lines = parseItems(req.body.items, { itemId: "id!", quantity: "decimal" }, { label: "delivered lines" }).filter((line) => line.quantity > 0);
  if (!lines.length) throw badRequest("Enter how much of at least one line arrived");
  const order = await inTransaction(async (tx) => {
    const existing = await tx.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { items: true, supplier: true } });
    if (!existing) throw notFound("Delivery");
    if (!WAITING.includes(existing.status)) throw conflict(existing.status === "cancelled" ? "This order was cancelled" : "This delivery has already been recorded in full");
    for (const line of lines) {
      const item = existing.items.find((i) => i.id === line.itemId);
      if (!item) throw badRequest("A line does not belong to this order");
      const outstanding = Number(item.quantity) - Number(item.quantityReceived);
      if (line.quantity > outstanding + 0.001) throw badRequest(`Only ${Number(outstanding.toFixed(2))} of "${item.description}" is still expected`);
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { quantityReceived: { increment: line.quantity } } });
      // A store item comes into stock as goods received from the order.
      if (item.storeItemId) {
        await tx.storeReceipt.create({
          data: {
            receiptNumber: await nextNumber(tx, "GRN", date),
            date,
            itemId: item.storeItemId,
            quantity: line.quantity,
            source: "purchase",
            supplierId: existing.supplierId,
            purchaseOrderId: existing.id,
            deliveryNote,
            notes: `Delivery for ${existing.poNumber} from ${existing.supplier.name}`,
          },
        });
        await tx.storeItem.update({ where: { id: item.storeItemId }, data: { quantityOnHand: { increment: line.quantity } } });
      }
    }
    const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: existing.id } });
    const complete = items.every((i) => Number(i.quantityReceived) >= Number(i.quantity) - 0.001);
    const updated = await tx.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: complete ? "received" : "partially_received", deliveredAt: new Date(), deliveredById: req.user.id, deliveryNote: deliveryNote || null },
      select: deliverySelect,
    });
    await audit(tx, { user: req.user, action: "receive", entity: "purchaseOrder", entityId: existing.id, metadata: { date, lines, deliveryNote } });
    return updated;
  });
  ok(res, order);
});

router.use("/issues", crud({
  router: issueRouter,
  resource: "storeIssues",
  model: "storeIssue",
  fields: {},
  include: { item: itemBrief, request: { select: { id: true, requestNumber: true } } },
  dateField: "date",
  filters: ["itemId", "department"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

export default router;
