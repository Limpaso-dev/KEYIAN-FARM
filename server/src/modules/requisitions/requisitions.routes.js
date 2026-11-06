import express from "express";
import prisma from "../../config/prisma.js";
import { requisitionRules } from "../../config/access.js";
import { audit } from "../../lib/audit.js";
import { dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, forbidden, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";

// Requisition flow:
//   department raises  -> pending
//   Accounts head / GM -> approved | rejected | returned (with comment)
//   requester          -> edits a returned one and resubmits (pending)
//   Stores / Accounts  -> fulfilled (issued from stores or bought)

const router = express.Router();
const include = {
  items: true,
  requestedBy: { select: { id: true, name: true, role: true, department: true } },
  decidedBy: { select: { id: true, name: true, role: true } },
  storeIssues: { select: { id: true, issueNumber: true, quantity: true, item: { select: { name: true, unit: true } } } },
  purchaseOrders: { select: { id: true, poNumber: true, status: true, totalAmount: true } },
};

const itemFields = { description: "string!", quantity: "decimal!", unit: "string", unitCost: "decimal" };
const buildItems = (raw) => {
  const items = parseItems(raw, itemFields, { label: "requested items" });
  if (items.some((i) => !(i.quantity > 0))) throw badRequest("Each item needs a quantity more than zero");
  return items.map((i) => ({ ...i, unitCost: i.unitCost || 0, total: round2(i.quantity * (i.unitCost || 0)) }));
};

const withFlags = (user) => (requisition) => ({
  ...requisition,
  canDecide: requisition.status === "pending" && requisitionRules.canDecide(user) && requisition.requestedById !== user.id,
  canEdit: requisition.status === "returned" && requisition.requestedById === user.id,
  canCancel: ["pending", "returned"].includes(requisition.status) && requisition.requestedById === user.id,
  canFulfil: requisition.status === "approved" && requisitionRules.canFulfil(user),
});

const load = async (tx, id) => {
  const requisition = await tx.requisition.findUnique({ where: { id } });
  if (!requisition) throw notFound("Requisition");
  return requisition;
};

const visible = (user, requisition) =>
  requisitionRules.canSeeAll(user) ||
  requisition.department === user.department ||
  (requisitionRules.canFulfil(user) && ["approved", "fulfilled"].includes(requisition.status));

router.get("/", async (req, res) => {
  const user = req.user;
  const where = { ...dateRange("createdAt", req.query) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.department) where.department = req.query.department;
  if (!requisitionRules.canSeeAll(user)) {
    // Own department, plus approved ones for Stores to fulfil.
    where.OR = [
      { department: user.department ?? "__none__" },
      ...(requisitionRules.canFulfil(user) ? [{ status: { in: ["approved", "fulfilled"] } }] : []),
    ];
  }
  const rows = await prisma.requisition.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 500 });
  ok(res, rows.map(withFlags(user)));
});

router.get("/inbox", async (req, res) => {
  const user = req.user;
  if (!requisitionRules.canDecide(user)) return ok(res, []);
  const rows = await prisma.requisition.findMany({
    where: { status: "pending", requestedById: { not: user.id } },
    include,
    orderBy: { createdAt: "asc" },
  });
  return ok(res, rows.map(withFlags(user)));
});

router.get("/:id", async (req, res) => {
  const requisition = await prisma.requisition.findUnique({ where: { id: req.params.id }, include });
  if (!requisition || !visible(req.user, requisition)) throw notFound("Requisition");
  ok(res, withFlags(req.user)(requisition));
});

router.post("/", async (req, res) => {
  if (!requisitionRules.canRaise(req.user)) throw forbidden("Only department staff can raise requisitions");
  const data = parseBody({ title: "string!", purpose: "text!", priority: "option:priorities" }, req.body);
  const items = buildItems(req.body.items);
  const requisition = await inTransaction(async (tx) => {
    const created = await tx.requisition.create({
      data: {
        ...data,
        requisitionNumber: await nextNumber(tx, "REQ"),
        department: req.user.department,
        requestedById: req.user.id,
        totalAmount: round2(items.reduce((s, i) => s + i.total, 0)),
        items: { create: items },
      },
      include,
    });
    await audit(tx, { user: req.user, action: "create", entity: "requisition", entityId: created.id, after: created });
    return created;
  });
  ok(res, withFlags(req.user)(requisition), 201);
});

// Edit and resubmit a returned requisition.
router.put("/:id", async (req, res) => {
  const data = parseBody({ title: "string!", purpose: "text!", priority: "option:priorities" }, req.body);
  const items = buildItems(req.body.items);
  const requisition = await inTransaction(async (tx) => {
    const existing = await load(tx, req.params.id);
    if (existing.requestedById !== req.user.id) throw forbidden("Only the person who raised it can change this requisition");
    if (existing.status !== "returned") throw conflict("Only a returned requisition can be changed");
    await tx.requisitionItem.deleteMany({ where: { requisitionId: existing.id } });
    const updated = await tx.requisition.update({
      where: { id: existing.id },
      data: {
        ...data,
        status: "pending",
        totalAmount: round2(items.reduce((s, i) => s + i.total, 0)),
        items: { create: items },
      },
      include,
    });
    await audit(tx, { user: req.user, action: "resubmit", entity: "requisition", entityId: existing.id, before: existing, after: updated });
    return updated;
  });
  ok(res, withFlags(req.user)(requisition));
});

router.post("/:id/decision", async (req, res) => {
  if (!requisitionRules.canDecide(req.user)) throw forbidden("Only the head of Accounts or the General Manager can decide requisitions");
  const decision = String(req.body.decision || "");
  const comment = String(req.body.comment || "").trim();
  const status = { approve: "approved", reject: "rejected", return: "returned" }[decision];
  if (!status) throw badRequest("Choose approve, reject or return");
  if (status !== "approved" && !comment) throw badRequest("Add a comment explaining why");
  const requisition = await inTransaction(async (tx) => {
    const existing = await load(tx, req.params.id);
    if (existing.status !== "pending") throw conflict("This requisition is not waiting for a decision");
    if (existing.requestedById === req.user.id) throw forbidden("You cannot decide your own requisition");
    const updated = await tx.requisition.update({
      where: { id: existing.id },
      data: { status, decidedById: req.user.id, decidedAt: new Date(), decisionComment: comment || null },
      include,
    });
    await audit(tx, { user: req.user, action: decision, entity: "requisition", entityId: existing.id, metadata: { comment } });
    return updated;
  });
  ok(res, withFlags(req.user)(requisition));
});

router.post("/:id/fulfil", async (req, res) => {
  if (!requisitionRules.canFulfil(req.user)) throw forbidden("Only Stores or Accounts can mark requisitions fulfilled");
  const requisition = await inTransaction(async (tx) => {
    const existing = await load(tx, req.params.id);
    if (existing.status !== "approved") throw conflict("Only an approved requisition can be fulfilled");
    const updated = await tx.requisition.update({ where: { id: existing.id }, data: { status: "fulfilled", fulfilledAt: new Date() }, include });
    await audit(tx, { user: req.user, action: "fulfil", entity: "requisition", entityId: existing.id });
    return updated;
  });
  ok(res, withFlags(req.user)(requisition));
});

router.post("/:id/cancel", async (req, res) => {
  const requisition = await inTransaction(async (tx) => {
    const existing = await load(tx, req.params.id);
    if (existing.requestedById !== req.user.id) throw forbidden("Only the person who raised it can cancel this requisition");
    if (!["pending", "returned"].includes(existing.status)) throw conflict("This requisition can no longer be cancelled");
    const updated = await tx.requisition.update({ where: { id: existing.id }, data: { status: "cancelled" }, include });
    await audit(tx, { user: req.user, action: "cancel", entity: "requisition", entityId: existing.id });
    return updated;
  });
  ok(res, withFlags(req.user)(requisition));
});

export default router;
