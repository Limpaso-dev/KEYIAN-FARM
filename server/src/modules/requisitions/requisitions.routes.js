import express from "express";
import prisma from "../../config/prisma.js";
import { requisitionRules } from "../../config/access.js";
import { audit } from "../../lib/audit.js";
import { dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, forbidden, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { markSeen, seenAt } from "../../lib/seen.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";

// Requisition flow:
//   department raises  -> pending
//   Accounts head / GM -> approved | rejected | returned (with comment)
//   requester          -> edits a returned one and resubmits (pending)
//   Accounts           -> fulfilled (bought or paid for)
// Each item carries its own purpose (why it is needed). A requisition can
// carry the supplier's proforma invoice, a PDF, sent with it and replaced or
// removed when a returned one is changed.
// Stores raises none: it answers the departments' store requests. Accounts
// raises none either: it decides them.

const router = express.Router();
const include = {
  items: true,
  requestedBy: { select: { id: true, name: true, role: true, department: true } },
  decidedBy: { select: { id: true, name: true, role: true } },
  storeIssues: { select: { id: true, issueNumber: true, quantity: true, item: { select: { name: true, unit: true } } } },
  purchaseOrders: { select: { id: true, poNumber: true, status: true, totalAmount: true } },
  // The file itself is fetched on its own (GET /:id/proforma).
  proforma: { select: { id: true, fileName: true, size: true, createdAt: true } },
};

const MAX_PROFORMA_BYTES = 5 * 1024 * 1024;

/**
 * The proforma invoice sent with a requisition: { name, data } with the PDF
 * in base64. Not sent: leave it as it is (undefined). null: remove it.
 */
const readProforma = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "object" || typeof value.data !== "string") throw badRequest("The proforma invoice could not be read. Attach it again.");
  const data = Buffer.from(value.data.replace(/^data:[^,]*,/, ""), "base64");
  if (!data.length) throw badRequest("The proforma invoice is empty. Attach it again.");
  if (data.length > MAX_PROFORMA_BYTES) throw badRequest("The proforma invoice is larger than 5 MB. Attach a smaller PDF, for example scanned at a lower resolution.");
  // A PDF starts with %PDF- (within its first kilobyte).
  if (data.subarray(0, 1024).indexOf("%PDF-") === -1) throw badRequest("The proforma invoice must be a PDF file.");
  const name = String(value.name || "").replace(/[\\/:*?"<>|\r\n\t]+/g, " ").trim().slice(0, 120) || "proforma-invoice";
  return { fileName: /\.pdf$/i.test(name) ? name : `${name}.pdf`, size: data.length, data };
};

const itemFields = { description: "string!", quantity: "decimal!", unit: "string", unitCost: "decimal", purpose: "text!" };
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
    // Own department, plus approved ones for those who fulfil them.
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

// Answers to the department's requisitions - approved, returned or rejected
// by someone else - since this user last looked at them (the count beside
// To Accounts in the sidebar). Looking at the list marks them seen.
const ANSWERS = "requisitionAnswers";
const answersTo = (user, since) => ({
  department: user.department,
  status: { in: ["approved", "returned", "rejected", "fulfilled"] },
  decidedAt: since ? { gt: since } : { not: null },
  OR: [{ decidedById: null }, { decidedById: { not: user.id } }],
});

/** The answers since the user last looked: how many, and the latest. */
const answersSince = async (user, since) => {
  const where = answersTo(user, since);
  const [count, rows] = await Promise.all([
    prisma.requisition.count({ where }),
    prisma.requisition.findMany({
      where,
      select: { id: true, requisitionNumber: true, title: true, status: true, decidedAt: true, decisionComment: true, requestedById: true },
      orderBy: { decidedAt: "desc" },
      take: 20,
    }),
  ]);
  return { since, count, rows };
};
const none = { since: null, count: 0, rows: [] };

router.get("/answers", async (req, res) => {
  if (!requisitionRules.canRaise(req.user)) return ok(res, none);
  return ok(res, await answersSince(req.user, await seenAt(prisma, req.user.id, ANSWERS)));
});

// Looking at the list: the answers until now, then they count as seen.
router.post("/answers/seen", async (req, res) => {
  if (!requisitionRules.canRaise(req.user)) return ok(res, none);
  const answers = await answersSince(req.user, await seenAt(prisma, req.user.id, ANSWERS));
  await markSeen(prisma, req.user.id, ANSWERS);
  return ok(res, answers);
});

// The proforma invoice, to view or save.
router.get("/:id/proforma", async (req, res) => {
  const requisition = await prisma.requisition.findUnique({ where: { id: req.params.id }, include: { proforma: true } });
  if (!requisition || !visible(req.user, requisition)) throw notFound("Requisition");
  if (!requisition.proforma) throw notFound("Proforma invoice");
  const { fileName, data } = requisition.proforma;
  // The name as plain ASCII for old browsers, and in full (RFC 5987) for the rest.
  const plain = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `inline; filename="${plain}"; filename*=UTF-8''${encoded}`);
  res.send(Buffer.from(data));
});

router.get("/:id", async (req, res) => {
  const requisition = await prisma.requisition.findUnique({ where: { id: req.params.id }, include });
  if (!requisition || !visible(req.user, requisition)) throw notFound("Requisition");
  ok(res, withFlags(req.user)(requisition));
});

router.post("/", async (req, res) => {
  if (!requisitionRules.canRaise(req.user)) {
    const refusals = {
      stores: "Stores does not raise requisitions; departments ask Stores for items through store requests",
      accounts: "Accounts does not raise requisitions: it approves, returns or rejects them",
    };
    throw forbidden(refusals[req.user?.department] || "Only department staff can raise requisitions");
  }
  const data = parseBody({ title: "string!", purpose: "text", priority: "option:priorities" }, req.body);
  const items = buildItems(req.body.items);
  const proforma = readProforma(req.body.proforma);
  const requisition = await inTransaction(async (tx) => {
    const created = await tx.requisition.create({
      data: {
        ...data,
        requisitionNumber: await nextNumber(tx, "REQ"),
        department: req.user.department,
        requestedById: req.user.id,
        totalAmount: round2(items.reduce((s, i) => s + i.total, 0)),
        items: { create: items },
        ...(proforma ? { proforma: { create: proforma } } : {}),
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
  const data = parseBody({ title: "string!", purpose: "text", priority: "option:priorities" }, req.body);
  const items = buildItems(req.body.items);
  const proforma = readProforma(req.body.proforma);
  const requisition = await inTransaction(async (tx) => {
    const existing = await load(tx, req.params.id);
    if (existing.requestedById !== req.user.id) throw forbidden("Only the person who raised it can change this requisition");
    if (existing.status !== "returned") throw conflict("Only a returned requisition can be changed");
    await tx.requisitionItem.deleteMany({ where: { requisitionId: existing.id } });
    // A new proforma replaces the old one; null takes it off.
    if (proforma !== undefined) await tx.requisitionProforma.deleteMany({ where: { requisitionId: existing.id } });
    if (proforma) await tx.requisitionProforma.create({ data: { ...proforma, requisitionId: existing.id } });
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
  if (!requisitionRules.canFulfil(req.user)) throw forbidden("Only Accounts can mark requisitions fulfilled");
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
