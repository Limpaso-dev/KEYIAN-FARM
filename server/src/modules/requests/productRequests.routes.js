import express from "express";
import prisma from "../../config/prisma.js";
import { productRequestRules } from "../../config/access.js";
import { RAW_MILK } from "../../config/catalog.js";
import { audit } from "../../lib/audit.js";
import { dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, forbidden, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { nairobiToday } from "../../lib/periods.js";
import { moveStock } from "../../lib/stock.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";
import { sendToSales } from "../mva/transfers.js";

// Product requests:
//   Sales asks MVA for products     -> pending -> sent (MVA sends them to Sales) -> received (Sales receives the transfer)
//   the administration asks Sales   -> pending -> issued (Sales gives them out as office use: off stock, not paid for)
// The department asked may decline (with a reason); the person who asked may
// cancel while it is still waiting.

const router = express.Router();
const product = { select: { id: true, code: true, name: true, unit: true } };
const include = {
  items: { include: { product } },
  requestedBy: { select: { id: true, name: true, role: true, department: true } },
  handledBy: { select: { id: true, name: true } },
  transfer: { select: { id: true, transferNumber: true, status: true } },
  officeRecords: { select: { id: true, recordNumber: true, quantity: true, product } },
};

const visibleTo = (user) => {
  if (productRequestRules.seeAll(user)) return {};
  const departments = [...new Set([...productRequestRules.handles(user), ...(user.department ? [user.department] : [])])];
  return { OR: [{ toDepartment: { in: departments } }, { fromDepartment: { in: departments } }, { requestedById: user.id }] };
};

const withFlags = (user) => (request) => {
  const handles = productRequestRules.handles(user).includes(request.toDepartment);
  const waiting = request.status === "pending";
  return {
    ...request,
    canSend: waiting && handles && request.toDepartment === "mva",
    canIssue: waiting && handles && request.toDepartment === "sales",
    canDecline: waiting && handles,
    canCancel: waiting && request.requestedById === user.id,
  };
};

const load = async (tx, user, id) => {
  const request = await tx.productRequest.findFirst({ where: { id, ...visibleTo(user) }, include: { items: { include: { product: true } } } });
  if (!request) throw notFound("Request");
  return request;
};

/** The quantities given against each line: [{ itemId, quantity }], at most what was asked for. */
const givenLines = (request, body) => {
  const lines = parseItems(body.items, { itemId: "id!", quantity: "decimal" }, { label: "products" }).filter((line) => line.quantity > 0);
  if (!lines.length) throw badRequest("Enter a quantity for at least one product");
  return lines.map((line) => {
    const item = request.items.find((i) => i.id === line.itemId);
    if (!item) throw badRequest("A line does not belong to this request");
    if (line.quantity > Number(item.quantity) + 0.001) throw badRequest(`Only ${Number(item.quantity)} ${item.product.unit} of ${item.product.name} was asked for`);
    return { item, quantity: line.quantity };
  });
};

router.get("/", async (req, res) => {
  const where = { ...visibleTo(req.user), ...dateRange("date", req.query) };
  if (req.query.to) where.toDepartment = req.query.to;
  if (req.query.status) where.status = req.query.status;
  const rows = await prisma.productRequest.findMany({ where, include, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 });
  ok(res, rows.map(withFlags(req.user)));
});

router.get("/:id", async (req, res) => {
  const request = await prisma.productRequest.findFirst({ where: { id: req.params.id, ...visibleTo(req.user) }, include });
  if (!request) throw notFound("Request");
  ok(res, withFlags(req.user)(request));
});

router.post("/", async (req, res) => {
  const data = parseBody({ to: "string!", date: "date", purpose: "text" }, req.body);
  if (!productRequestRules.raiseTo(req.user).includes(data.to)) {
    throw forbidden(data.to === "mva" ? "Only Sales asks MVA for products" : data.to === "sales" ? "Only the administration asks Sales for products" : "Choose who the request is for");
  }
  const items = parseItems(req.body.items, { productId: "id!", quantity: "decimal!" }, { label: "products" }).filter((line) => line.quantity > 0);
  if (!items.length) throw badRequest("Enter a quantity for at least one product");
  if (new Set(items.map((i) => i.productId)).size !== items.length) throw badRequest("List each product only once");

  const request = await inTransaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    for (const line of items) {
      const found = products.find((p) => p.id === line.productId);
      if (!found || !found.isActive) throw badRequest("Choose products that are still sold");
      if (data.to === "mva" && found.code === RAW_MILK) throw badRequest("Raw milk comes to Sales through MVA's L.Sale allocation");
    }
    const date = data.date || nairobiToday();
    const created = await tx.productRequest.create({
      data: {
        requestNumber: await nextNumber(tx, "PRQ", date),
        date,
        fromDepartment: req.user.department || null,
        toDepartment: data.to,
        purpose: data.purpose,
        requestedById: req.user.id,
        items: { create: items },
      },
      include,
    });
    await audit(tx, { user: req.user, action: "create", entity: "productRequest", entityId: created.id, after: created });
    return created;
  });
  ok(res, withFlags(req.user)(request), 201);
});

// MVA sends what Sales asked for. Sales then receives it under From MVA.
router.post("/:id/send", async (req, res) => {
  const { date, notes } = parseBody({ date: "date!", notes: "text" }, req.body);
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (existing.toDepartment !== "mva" || !productRequestRules.handles(req.user).includes("mva")) throw forbidden("Only MVA sends products asked for by Sales");
    if (existing.status !== "pending") throw conflict("This request is no longer waiting");
    const lines = givenLines(existing, req.body);
    const transfer = await sendToSales(tx, {
      date,
      notes: [`For request ${existing.requestNumber}`, notes].filter(Boolean).join(" | "),
      items: lines.map(({ item, quantity }) => ({ productId: item.productId, quantity })),
    });
    for (const { item, quantity } of lines) await tx.productRequestItem.update({ where: { id: item.id }, data: { quantityGiven: quantity } });
    const updated = await tx.productRequest.update({
      where: { id: existing.id },
      data: { status: "sent", transferId: transfer.id, handledById: req.user.id, handledAt: new Date() },
      include,
    });
    await audit(tx, { user: req.user, action: "send", entity: "productRequest", entityId: existing.id, metadata: { transfer: transfer.transferNumber } });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

// Sales gives out what the administration asked for: office use, off Sales stock, not paid for.
router.post("/:id/issue", async (req, res) => {
  const { date } = parseBody({ date: "date!" }, req.body);
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (existing.toDepartment !== "sales" || !productRequestRules.handles(req.user).includes("sales")) throw forbidden("Only Sales gives out products asked for by the administration");
    if (existing.status !== "pending") throw conflict("This request is no longer waiting");
    for (const { item, quantity } of givenLines(existing, req.body)) {
      const record = await tx.damageReplacement.create({
        data: {
          recordNumber: await nextNumber(tx, "OFF", date),
          date,
          recordType: "office",
          productId: item.productId,
          quantity,
          value: round2(quantity * Number(item.product.localPrice)),
          reason: [`Office request ${existing.requestNumber}`, existing.purpose].filter(Boolean).join(": "),
          requestId: existing.id,
        },
      });
      await moveStock(tx, {
        productId: item.productId,
        location: "sales",
        quantity: -quantity,
        movementType: "office",
        referenceType: "damageReplacement",
        referenceId: record.id,
        date,
        notes: `Office request ${existing.requestNumber}`,
      });
      await tx.productRequestItem.update({ where: { id: item.id }, data: { quantityGiven: quantity } });
    }
    const updated = await tx.productRequest.update({
      where: { id: existing.id },
      data: { status: "issued", handledById: req.user.id, handledAt: new Date() },
      include,
    });
    await audit(tx, { user: req.user, action: "issue", entity: "productRequest", entityId: existing.id });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

router.post("/:id/decline", async (req, res) => {
  const { reason } = parseBody({ reason: "text!" }, req.body);
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (!productRequestRules.handles(req.user).includes(existing.toDepartment)) throw forbidden("Only the department asked can decline this request");
    if (existing.status !== "pending") throw conflict("This request is no longer waiting");
    const updated = await tx.productRequest.update({
      where: { id: existing.id },
      data: { status: "declined", declineReason: reason, handledById: req.user.id, handledAt: new Date() },
      include,
    });
    await audit(tx, { user: req.user, action: "decline", entity: "productRequest", entityId: existing.id, metadata: { reason } });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

router.post("/:id/cancel", async (req, res) => {
  const request = await inTransaction(async (tx) => {
    const existing = await load(tx, req.user, req.params.id);
    if (existing.requestedById !== req.user.id) throw forbidden("Only the person who asked can cancel this request");
    if (existing.status !== "pending") throw conflict("This request can no longer be cancelled");
    const updated = await tx.productRequest.update({ where: { id: existing.id }, data: { status: "cancelled" }, include });
    await audit(tx, { user: req.user, action: "cancel", entity: "productRequest", entityId: existing.id });
    return updated;
  });
  ok(res, withFlags(req.user)(request));
});

export default router;
