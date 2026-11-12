import express from "express";
import prisma from "../../config/prisma.js";
import { optionLabel, optionValues, RAW_MILK } from "../../config/catalog.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, dateRange, inTransaction, listQuery } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { isoDay } from "../../lib/periods.js";
import { moveStock, productByCode } from "../../lib/stock.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";
import { outputFigures, productionDays } from "./production.js";
import { productBrief, sendToSales, transferInclude } from "./transfers.js";

const router = express.Router();
const supplierBrief = { select: { id: true, supplierNumber: true, firstName: true, lastName: true } };

// The first farmer number when none exist yet. Farmers are known by
// numbers like 130, 131, 132.
const FIRST_SUPPLIER_NUMBER = 130;

// ---------------------------------------------------------------------
// Milk suppliers (local farmers)
// ---------------------------------------------------------------------
router.get("/milk-suppliers/next-number", allow("milkSuppliers", "read"), async (req, res) => {
  const last = await prisma.milkSupplier.aggregate({ _max: { supplierNumber: true } });
  ok(res, { next: (last._max.supplierNumber ?? FIRST_SUPPLIER_NUMBER - 1) + 1 });
});

router.use("/milk-suppliers", crud({
  resource: "milkSuppliers",
  model: "milkSupplier",
  label: "Farmer",
  // MVA keeps the farmer's name and number; ID and payment details are Accounts'.
  fields: {
    supplierNumber: "int",
    firstName: "string!",
    lastName: "string!",
    status: "option:supplierStatus",
  },
  omit: { nationalId: true, phone: true, location: true, paymentMethod: true, bankName: true, accountNumber: true },
  search: ["firstName", "lastName"],
  filters: ["status"],
  orderBy: { supplierNumber: "asc" },
  prepare: async (data, { tx, existing }) => {
    if (!existing && !data.supplierNumber) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('milk-supplier-number'))`;
      const last = await tx.milkSupplier.aggregate({ _max: { supplierNumber: true } });
      data.supplierNumber = (last._max.supplierNumber ?? FIRST_SUPPLIER_NUMBER - 1) + 1;
    }
    if (data.supplierNumber !== undefined && data.supplierNumber !== null && data.supplierNumber < 1) {
      throw badRequest("Farmer number must be a positive number");
    }
  },
  beforeDelete: async (supplier, { tx }) => {
    if (await tx.milkDelivery.count({ where: { supplierId: supplier.id } })) {
      throw conflict("This farmer has milk deliveries. Mark them inactive instead.");
    }
  },
}));

// ---------------------------------------------------------------------
// Milk price per litre (one price, changes by date)
// ---------------------------------------------------------------------
export const priceOn = async (tx, date) =>
  tx.milkPrice.findFirst({ where: { effectiveDate: { lte: date } }, orderBy: { effectiveDate: "desc" } });

router.get("/milk-prices/current", allow("milkPrices", "read"), async (req, res) => {
  ok(res, await priceOn(prisma, new Date()));
});

router.use("/milk-prices", crud({
  resource: "milkPrices",
  model: "milkPrice",
  fields: { effectiveDate: "date!", pricePerLitre: "decimal!", notes: "text" },
  updateFields: { notes: "text" },
  dateField: "effectiveDate",
  orderBy: { effectiveDate: "desc" },
  prepare: (data, { existing }) => {
    if (!existing && !(data.pricePerLitre > 0)) throw badRequest("Price must be more than zero");
  },
  beforeDelete: async (price, { tx }) => {
    const used = await tx.milkDelivery.count({ where: { date: { gte: price.effectiveDate }, pricePerLitre: price.pricePerLitre } });
    if (used) throw conflict("Deliveries have been priced with this rate; add a new price instead of deleting");
  },
}));

// ---------------------------------------------------------------------
// Farmer milk deliveries
// ---------------------------------------------------------------------
const deliveryRouter = express.Router();

// Record many farmers for one session at once.
deliveryRouter.post("/", allow("milkDeliveries", "write"), async (req, res) => {
  const { date, session } = parseBody({ date: "date!", session: "option:milkSessions!" }, req.body);
  const lines = parseItems(req.body.deliveries, { supplierId: "id!", litres: "decimal!", notes: "text" }, { label: "deliveries" })
    .filter((line) => line.litres > 0);
  if (!lines.length) throw badRequest("Enter litres for at least one farmer");
  const saved = await inTransaction(async (tx) => {
    const price = await priceOn(tx, date);
    if (!price) throw conflict("Set a milk price per litre for this date before recording deliveries");
    const ids = [...new Set(lines.map((line) => line.supplierId))];
    const suppliers = await tx.milkSupplier.findMany({ where: { id: { in: ids }, status: "active" } });
    if (suppliers.length !== ids.length) throw badRequest("Every farmer must be registered and active");
    const rawMilk = await productByCode(tx, RAW_MILK);
    const rows = [];
    for (const line of lines) {
      const delivery = await tx.milkDelivery.create({
        data: {
          supplierId: line.supplierId,
          date,
          session,
          litres: line.litres,
          pricePerLitre: price.pricePerLitre,
          amount: round2(line.litres * Number(price.pricePerLitre)),
          notes: line.notes,
        },
        include: { supplier: supplierBrief },
      });
      await moveStock(tx, {
        productId: rawMilk.id,
        location: "mva",
        quantity: line.litres,
        movementType: "farmer_delivery",
        referenceType: "milkDelivery",
        referenceId: delivery.id,
        date,
        notes: `Farmer ${delivery.supplier.supplierNumber}`,
      });
      rows.push(delivery);
    }
    await audit(tx, { user: req.user, action: "record_deliveries", entity: "milkDelivery", metadata: { date, session, count: rows.length } });
    return rows;
  });
  ok(res, saved, 201, { message: `Recorded ${saved.length} delivery(ies)` });
});

// Totals per farmer for a period (for the farmer's statement).
deliveryRouter.get("/statement", allow("milkDeliveries", "read"), async (req, res) => {
  const { from, to, supplierId } = req.query;
  if (!from || !to) throw badRequest("Choose a from and to date");
  const where = { date: { gte: new Date(from), lte: new Date(to) }, ...(supplierId ? { supplierId } : {}) };
  const groups = await prisma.milkDelivery.groupBy({ by: ["supplierId"], where, _sum: { litres: true, amount: true }, _count: true });
  const suppliers = await prisma.milkSupplier.findMany({ where: { id: { in: groups.map((g) => g.supplierId) } }, select: supplierBrief.select });
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  ok(res, groups.map((g) => ({
    supplier: byId.get(g.supplierId),
    deliveries: g._count,
    litres: Number(g._sum.litres || 0),
    amount: Number(g._sum.amount || 0),
  })).sort((a, b) => a.supplier.supplierNumber - b.supplier.supplierNumber));
});

router.use("/milk-deliveries", crud({
  router: deliveryRouter,
  resource: "milkDeliveries",
  model: "milkDelivery",
  fields: {},
  include: { supplier: supplierBrief },
  dateField: "date",
  filters: ["supplierId", "session"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  beforeDelete: async (delivery, { tx }) => {
    if (delivery.paymentRunId) throw conflict("This delivery is part of a payment run and cannot be deleted");
    const rawMilk = await productByCode(tx, RAW_MILK);
    await moveStock(tx, {
      productId: rawMilk.id,
      location: "mva",
      quantity: -Number(delivery.litres),
      movementType: "farmer_delivery_reversal",
      referenceType: "milkDelivery",
      referenceId: delivery.id,
      date: delivery.date,
      notes: "Delivery deleted",
    });
  },
}));

// ---------------------------------------------------------------------
// Allocation: where each day's milk goes. There is one record per day, and
// saving it again changes it. Raw milk stock falls as it is allocated. L.Sale
// goes to Sales as raw milk, waiting there to be received.
// ---------------------------------------------------------------------
const allocationRouter = express.Router();

allocationRouter.get("/", allow("milkAllocations", "read"), async (req, res) => {
  ok(res, (await productionDays(prisma, dateRange("date", req.query))).reverse());
});

const syncLocalSale = async (tx, allocation, transfer, quantity, rawMilkId) => {
  const ref = { productId: rawMilkId, location: "mva", date: allocation.date, allowNegative: true };
  if (transfer?.status === "received") throw conflict("Sales has already received this day's L.Sale milk, so it cannot be changed");
  if (!transfer) {
    const created = await tx.productTransfer.create({
      data: {
        date: allocation.date,
        allocationId: allocation.id,
        transferNumber: await nextNumber(tx, "PTR", allocation.date),
        notes: "L.Sale allocation",
        items: { create: [{ productId: rawMilkId, quantity }] },
      },
    });
    await moveStock(tx, { ...ref, quantity: -quantity, movementType: "transfer_to_sales", referenceType: "productTransfer", referenceId: created.id, notes: created.transferNumber });
    return;
  }
  const before = Number(transfer.items[0].quantity);
  await moveStock(tx, { ...ref, quantity: round2(before - quantity), movementType: "transfer_to_sales", referenceType: "productTransfer", referenceId: transfer.id, notes: `${transfer.transferNumber} changed` });
  if (quantity > 0) await tx.productTransferItem.update({ where: { id: transfer.items[0].id }, data: { quantity } });
  else await tx.productTransfer.delete({ where: { id: transfer.id } });
};

allocationRouter.post("/", allow("milkAllocations", "write"), async (req, res) => {
  const { date, notes } = parseBody({ date: "date!", notes: "text" }, req.body);
  const lines = parseItems(req.body.lines, { destination: "option:allocationDestinations!", quantity: "decimal" }, { label: "allocations" });
  if (new Set(lines.map((line) => line.destination)).size !== lines.length) throw badRequest("List each destination only once");
  const wanted = new Map(lines.map((line) => [line.destination, round2(line.quantity || 0)]));

  await inTransaction(async (tx) => {
    const rawMilk = await productByCode(tx, RAW_MILK);
    const existing = await tx.milkAllocation.findUnique({ where: { date }, include: { lines: true, transfer: { include: { items: true } } } });
    const before = new Map((existing?.lines || []).map((line) => [line.destination, Number(line.quantity)]));
    const allocation = existing
      ? await tx.milkAllocation.update({ where: { id: existing.id }, data: { notes } })
      : await tx.milkAllocation.create({ data: { date, notes } });

    for (const destination of optionValues("allocationDestinations")) {
      const quantity = wanted.get(destination) || 0;
      const change = round2(quantity - (before.get(destination) || 0));
      if (!change) continue;
      if (destination === "local_sale") {
        await syncLocalSale(tx, allocation, existing?.transfer, quantity, rawMilk.id);
      } else {
        // A day's allocation can run ahead of its intake; the sheet shows that as variance.
        await moveStock(tx, {
          productId: rawMilk.id,
          location: "mva",
          quantity: -change,
          movementType: "allocation",
          referenceType: "milkAllocation",
          referenceId: allocation.id,
          date,
          notes: `${optionLabel("allocationDestinations", destination)}${existing ? " (changed)" : ""}`,
          allowNegative: true,
        });
      }
    }

    await tx.milkAllocationLine.deleteMany({ where: { allocationId: allocation.id } });
    const rows = [...wanted].filter(([, quantity]) => quantity > 0).map(([destination, quantity]) => ({ allocationId: allocation.id, destination, quantity }));
    if (rows.length) await tx.milkAllocationLine.createMany({ data: rows });
    else await tx.milkAllocation.delete({ where: { id: allocation.id } });
    await audit(tx, { user: req.user, action: existing ? "update" : "create", entity: "milkAllocation", entityId: allocation.id, metadata: { date: isoDay(date), lines: rows } });
  });
  ok(res, { date: isoDay(date) }, 201);
});

router.use("/milk-allocations", allocationRouter);

// ---------------------------------------------------------------------
// Product output: kilograms processed and the pieces made from them. The
// milk has already left raw stock when it was allocated. Every pack made -
// Mala, the three yoghurt sizes and fresh milk in 250 ml packets - goes into
// MVA stock, ready to send to Sales.
// ---------------------------------------------------------------------
const batchInclude = { outputs: { include: { product: productBrief } } };
const batchRouter = express.Router();

batchRouter.get("/", allow("processingBatches", "read"), async (req, res) => {
  const { where, take } = listQuery(req.query, { dateField: "date" });
  const rows = await prisma.processingBatch.findMany({ where, include: batchInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take });
  ok(res, rows.map((batch) => ({ ...batch, ...outputFigures(batch) })));
});

batchRouter.post("/", allow("processingBatches", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", malaKg: "decimal", malaPieces: "int", yoghurtKg: "decimal", yoghurt500: "int", yoghurt250: "int", yoghurt150: "int", fresh250: "int", notes: "text" }, req.body);
  const packed = [["MALA", data.malaPieces], ["YOGHURT_500", data.yoghurt500], ["YOGHURT_250", data.yoghurt250], ["YOGHURT_150", data.yoghurt150], ["FRESH_MILK", data.fresh250]];
  if (packed.some(([, pieces]) => pieces < 0)) throw badRequest("The number of pieces cannot be negative");
  const made = packed.filter(([, pieces]) => pieces > 0);
  if (!made.length && !data.malaKg && !data.yoghurtKg) throw badRequest("Enter at least one figure");

  const batch = await inTransaction(async (tx) => {
    const products = await tx.product.findMany({ where: { code: { in: made.map(([code]) => code) } } });
    const outputs = made.map(([code, quantity]) => {
      const product = products.find((p) => p.code === code);
      if (!product) throw badRequest(`The product ${code} no longer exists`);
      return { productId: product.id, quantity };
    });
    const created = await tx.processingBatch.create({
      data: {
        date: data.date,
        notes: data.notes,
        batchNumber: await nextNumber(tx, "BAT", data.date),
        malaKg: data.malaKg || 0,
        yoghurtKg: data.yoghurtKg || 0,
        fresh250: data.fresh250 || 0,
        rawMilkInput: round2((data.malaKg || 0) + (data.yoghurtKg || 0)),
        outputs: { create: outputs },
      },
      include: batchInclude,
    });
    for (const line of outputs) {
      await moveStock(tx, { productId: line.productId, location: "mva", quantity: line.quantity, movementType: "processing_output", referenceType: "processingBatch", referenceId: created.id, date: data.date, notes: created.batchNumber });
    }
    await audit(tx, { user: req.user, action: "create", entity: "processingBatch", entityId: created.id, after: created });
    return created;
  });
  ok(res, batch, 201);
});

router.use("/processing-batches", crud({
  router: batchRouter,
  resource: "processingBatches",
  model: "processingBatch",
  label: "Product output",
  fields: {},
  include: batchInclude,
  dateField: "date",
  create: false,
  update: false,
  // Deleting takes the pieces back out of stock, so anything already sent to Sales blocks it.
  beforeDelete: async (batch, { tx }) => {
    const outputs = await tx.processingOutput.findMany({ where: { batchId: batch.id } });
    for (const line of outputs) {
      await moveStock(tx, { productId: line.productId, location: "mva", quantity: -Number(line.quantity), movementType: "processing_reversal", referenceType: "processingBatch", referenceId: batch.id, date: batch.date, notes: `${batch.batchNumber} deleted` });
    }
  },
}));

// ---------------------------------------------------------------------
// Transfers of products (including unprocessed raw milk) to Sales.
// ---------------------------------------------------------------------
const transferRouter = express.Router();

transferRouter.post("/", allow("productTransfers", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", notes: "text" }, req.body);
  const items = parseItems(req.body.items, { productId: "id!", quantity: "decimal!" }, { label: "products" })
    .filter((line) => line.quantity > 0);
  const transfer = await inTransaction(async (tx) => {
    const created = await sendToSales(tx, { ...data, items });
    await audit(tx, { user: req.user, action: "create", entity: "productTransfer", entityId: created.id, after: created });
    return created;
  });
  ok(res, transfer, 201);
});

transferRouter.post("/:id/receive", allow("productTransfers", "receive"), async (req, res) => {
  const { notes } = parseBody({ notes: "text" }, req.body);
  const transfer = await inTransaction(async (tx) => {
    const existing = await tx.productTransfer.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!existing) throw notFound("Product transfer");
    if (existing.status !== "sent") throw conflict("This transfer has already been received");
    for (const line of existing.items) {
      await moveStock(tx, {
        productId: line.productId,
        location: "sales",
        quantity: Number(line.quantity),
        movementType: "received_from_mva",
        referenceType: "productTransfer",
        referenceId: existing.id,
        date: existing.date,
        notes: existing.transferNumber,
      });
    }
    const updated = await tx.productTransfer.update({
      where: { id: existing.id },
      data: {
        status: "received",
        receivedAt: new Date(),
        receivedById: req.user.id,
        notes: [existing.notes, notes].filter(Boolean).join(" | ") || null,
      },
      include: transferInclude,
    });
    await tx.productRequest.updateMany({ where: { transferId: existing.id, status: "sent" }, data: { status: "received" } });
    await audit(tx, { user: req.user, action: "receive", entity: "productTransfer", entityId: existing.id });
    return updated;
  });
  ok(res, transfer);
});

router.use("/product-transfers", crud({
  router: transferRouter,
  resource: "productTransfers",
  model: "productTransfer",
  fields: {},
  include: transferInclude,
  dateField: "date",
  filters: ["status"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  beforeDelete: async (transfer, { tx }) => {
    if (transfer.status !== "sent") throw conflict("A received transfer cannot be deleted");
    if (transfer.allocationId) throw conflict("This came from the day's L.Sale allocation. Change the allocation instead.");
    // A transfer that answered a request from Sales puts the request back in the queue.
    const request = await tx.productRequest.findUnique({ where: { transferId: transfer.id } });
    if (request) {
      await tx.productRequest.update({ where: { id: request.id }, data: { status: "pending", transferId: null, handledById: null, handledAt: null } });
      await tx.productRequestItem.updateMany({ where: { requestId: request.id }, data: { quantityGiven: 0 } });
    }
    const items = await tx.productTransferItem.findMany({ where: { transferId: transfer.id } });
    for (const line of items) {
      await moveStock(tx, {
        productId: line.productId,
        location: "mva",
        quantity: Number(line.quantity),
        movementType: "transfer_cancelled",
        referenceType: "productTransfer",
        referenceId: transfer.id,
        date: transfer.date,
        notes: `${transfer.transferNumber} cancelled`,
      });
    }
  },
}));

export default router;
