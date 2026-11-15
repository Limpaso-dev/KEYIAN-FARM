import express from "express";
import prisma from "../../config/prisma.js";
import { storeRequestRules } from "../../config/access.js";
import { optionLabel } from "../../config/catalog.js";
import { audit } from "../../lib/audit.js";
import { dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, forbidden, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { nairobiToday } from "../../lib/periods.js";
import { takeStoreItem } from "../../lib/stock.js";
import { parseBody, parseItems } from "../../lib/validate.js";
import { itemBrief } from "./stores.routes.js";

// Store requests: a department asks Stores for items
//   pending -> issued, shown as "Dispatched" (Stores hands them over: stock out to that department)
// Stores may decline (with a reason); the person who asked may cancel while
// it is still waiting. Numbered SRQ-year-number.

const router = express.Router();
const include = {
  items: { include: { item: itemBrief } },
  requestedBy: { select: { id: true, name: true, department: true } },
  handledBy: { select: { id: true, name: true } },
  issues: { select: { id: true, issueNumber: true, quantity: true, issuedTo: true, item: itemBrief }, orderBy: { issueNumber: "asc" } },
};

const visibleTo = (user) => {
  if (storeRequestRules.seeAll(user)) return {};
  if (!user.department) return { requestedById: user.id };
  return { OR: [{ department: user.department }, { requestedById: user.id }] };
};

const withFlags = (user) => (request) => {
  const waiting = request.status === "pending";
  const handles = storeRequestRules.handles(user);
  return {
    ...request,
    canDispatch: waiting && handles,
    canDecline: waiting && handles,
    canCancel: waiting && request.requestedById === user.id,
  };
};

const load = async (tx, user, id) => {
  const request = await tx.storeRequest.findFirst({ where: { id, ...visibleTo(user) }, include: { items: { include: { item: true } }, requestedBy: true } });
  if (!request) throw notFound("Request");
  return request;
};

const mustBeWaiting = (request) => {
  if (request.status !== "pending") throw conflict("This request is no longer waiting");
};

// The items a department can ask for: those in use, by name and unit. What
// the store holds stays with Stores.
router.get("/items", async (req, res) => {
  const user = req.user;
  if (!storeRequestRules.canRaise(user) && !storeRequestRules.seeAll(user)) throw forbidden("You cannot ask Stores for items");
  const items = await prisma.storeItem.findMany({ where: { isActive: true }, select: itemBrief.select, orderBy: [{ category: "asc" }, { name: "asc" }] });
  ok(res, items);
});

router.get("/", async (req, res) => {
  const where = { ...visibleTo(req.user), ...dateRange("date", req.query) };
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.department) where.department = String(req.query.department);
  const rows = await prisma.storeRequest.findMany({ where, include, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 });
  ok(res, rows.map(withFlags(req.user)));
});

router.get("/:id", async (req, res) => {
  const request = await prisma.storeRequest.findFirst({ where: { id: req.params.id, ...visibleTo(req.user) }, include });
  if (!request) throw notFound("Request");
  ok(res, withFlags(req.user)(request));
});

router.post("/", async (req, res) => {
  if (!storeRequestRules.canRaise(req.user)) {
    throw forbidden(req.user.department === "stores" ? "Stores does not ask itself for items" : "Only the departments ask Stores for items");
  }
  const data = parseBody({ date: "date", purpose: "text" }, req.body);
  const items = parseItems(req.body.items, { itemId: "id!", quantity: "decimal!" }, { label: "items" }).filter((line) => line.quantity > 0);
  if (!items.length) throw badRequest("Enter a quantity for at least one item");
  if (new Set(items.map((i) => i.itemId)).size !== items.length) throw badRequest("List each item only once");

  const request = await inTransaction(async (tx) => {
    const found = await tx.storeItem.findMany({ where: { id: { in: items.map((i) => i.itemId) }, isActive: true } });
    if (found.length !== items.length) throw badRequest("Choose items that the store keeps");
    const date = data.date || nairobiToday();
    const created = await tx.storeRequest.create({
      data: {
        requestNumber: await nextNumber(tx, "SRQ", date),
        date,
        department: req.user.department,
        purpose: data.purpose,
        requestedById: req.user.id,
        items: { create: items },
      },
      include,
    });
    await audit(tx, { user: req.user, action: "create", entity: "storeRequest", entityId: created.id, after: created });
    return created;
  });
  ok(res, withFlags(req.user)(request), 201);
});

// Stores hands the items over: each line becomes a stock out to the
// department, taken off the store's stock. Stores may give less than was
// asked for (what it has), never more.
router.post("/:id/dispatch", async (req, res) => {
  const { date, issuedTo } = parseBody({ date: "date!", issuedTo: "string!" }, req.body);
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (!storeRequestRules.handles(req.user)) throw forbidden("Only Stores dispatches what departments ask for");
    mustBeWaiting(existing);
    const lines = parseItems(req.body.items, { itemId: "id!", quantity: "decimal" }, { label: "items" }).filter((line) => line.quantity > 0);
    if (!lines.length) throw badRequest("Enter a quantity for at least one item");
    const purpose = [`Request ${existing.requestNumber}`, existing.purpose].filter(Boolean).join(": ");
    for (const line of lines) {
      const asked = existing.items.find((i) => i.id === line.itemId);
      if (!asked) throw badRequest("A line does not belong to this request");
      if (line.quantity > Number(asked.quantity) + 0.001) throw badRequest(`Only ${Number(asked.quantity)} ${asked.item.unit} of ${asked.item.name} was asked for`);
      await takeStoreItem(tx, asked.itemId, line.quantity);
      await tx.storeIssue.create({
        data: {
          issueNumber: await nextNumber(tx, "SO", date),
          date,
          itemId: asked.itemId,
          quantity: line.quantity,
          department: existing.department,
          issuedTo,
          purpose,
          requestId: existing.id,
        },
      });
      await tx.storeRequestItem.update({ where: { id: asked.id }, data: { quantityGiven: line.quantity } });
    }
    const updated = await tx.storeRequest.update({
      where: { id: existing.id },
      data: { status: "issued", handledById: req.user.id, handledAt: new Date() },
      include,
    });
    await audit(tx, { user: req.user, action: "dispatch", entity: "storeRequest", entityId: existing.id, metadata: { department: optionLabel("departments", existing.department), issuedTo } });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

router.post("/:id/decline", async (req, res) => {
  const { reason } = parseBody({ reason: "text!" }, req.body);
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (!storeRequestRules.handles(req.user)) throw forbidden("Only Stores can decline a store request");
    mustBeWaiting(existing);
    const updated = await tx.storeRequest.update({
      where: { id: existing.id },
      data: { status: "declined", declineReason: reason, handledById: req.user.id, handledAt: new Date() },
      include,
    });
    await audit(tx, { user: req.user, action: "decline", entity: "storeRequest", entityId: existing.id, metadata: { reason } });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

router.post("/:id/cancel", async (req, res) => {
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (existing.requestedById !== req.user.id) throw forbidden("Only the person who asked can cancel this request");
    if (existing.status !== "pending") throw conflict("This request can no longer be cancelled");
    const updated = await tx.storeRequest.update({ where: { id: existing.id }, data: { status: "cancelled" }, include });
    await audit(tx, { user: req.user, action: "cancel", entity: "storeRequest", entityId: existing.id });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

export default router;
