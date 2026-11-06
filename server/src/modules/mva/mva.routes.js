import express from "express";
import prisma from "../../config/prisma.js";
import { RAW_MILK } from "../../config/catalog.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { moveStock, productByCode } from "../../lib/stock.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";

const router = express.Router();
const supplierBrief = { select: { id: true, supplierNumber: true, firstName: true, lastName: true } };
const productBrief = { select: { id: true, code: true, name: true, unit: true } };

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
  fields: {
    supplierNumber: "int",
    firstName: "string!",
    lastName: "string!",
    nationalId: "string",
    phone: "string",
    location: "string",
    paymentMethod: "option:paymentMethods",
    paymentDetails: "string",
    status: "option:supplierStatus",
  },
  search: ["firstName", "lastName", "phone", "nationalId", "location"],
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
  const suppliers = await prisma.milkSupplier.findMany({ where: { id: { in: groups.map((g) => g.supplierId) } } });
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
// Processing: raw milk in, Fresh milk / Mala / Yoghurt out.
// ---------------------------------------------------------------------
const batchRouter = express.Router();
batchRouter.post("/", allow("processingBatches", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", rawMilkInput: "decimal!", notes: "text" }, req.body);
  if (!(data.rawMilkInput > 0)) throw badRequest("Raw milk input must be more than zero");
  const outputs = parseItems(req.body.outputs, { productId: "id!", quantity: "decimal!" }, { label: "products made" })
    .filter((line) => line.quantity > 0);
  if (!outputs.length) throw badRequest("Enter the quantity made for at least one product");
  const batch = await inTransaction(async (tx) => {
    const rawMilk = await productByCode(tx, RAW_MILK);
    if (outputs.some((line) => line.productId === rawMilk.id)) throw badRequest("Raw milk cannot be a processing output");
    const created = await tx.processingBatch.create({
      data: {
        ...data,
        batchNumber: await nextNumber(tx, "BAT", data.date),
        outputs: { create: outputs },
      },
      include: { outputs: { include: { product: productBrief } } },
    });
    const ref = { referenceType: "processingBatch", referenceId: created.id, date: data.date, notes: created.batchNumber };
    await moveStock(tx, { ...ref, productId: rawMilk.id, location: "mva", quantity: -data.rawMilkInput, movementType: "processing_input" });
    for (const line of outputs) {
      await moveStock(tx, { ...ref, productId: line.productId, location: "mva", quantity: line.quantity, movementType: "processing_output" });
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
  fields: {},
  include: { outputs: { include: { product: productBrief } } },
  dateField: "date",
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Transfers of products (including unprocessed raw milk) to Sales.
// ---------------------------------------------------------------------
const transferInclude = { items: { include: { product: productBrief } } };
const transferRouter = express.Router();

transferRouter.post("/", allow("productTransfers", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", notes: "text" }, req.body);
  const items = parseItems(req.body.items, { productId: "id!", quantity: "decimal!" }, { label: "products" })
    .filter((line) => line.quantity > 0);
  if (!items.length) throw badRequest("Enter a quantity for at least one product");
  if (new Set(items.map((i) => i.productId)).size !== items.length) throw badRequest("List each product only once");
  const transfer = await inTransaction(async (tx) => {
    const created = await tx.productTransfer.create({
      data: { ...data, transferNumber: await nextNumber(tx, "PTR", data.date), items: { create: items } },
      include: transferInclude,
    });
    for (const line of items) {
      await moveStock(tx, {
        productId: line.productId,
        location: "mva",
        quantity: -line.quantity,
        movementType: "transfer_to_sales",
        referenceType: "productTransfer",
        referenceId: created.id,
        date: data.date,
        notes: created.transferNumber,
      });
    }
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
