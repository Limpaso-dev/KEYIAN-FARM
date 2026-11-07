import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { moveStock } from "../../lib/stock.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";

const router = express.Router();
const productBrief = { select: { id: true, code: true, name: true, unit: true } };

const loadProducts = async (tx, ids) => {
  const products = await tx.product.findMany({ where: { id: { in: ids } } });
  if (products.length !== new Set(ids).size) throw badRequest("One of the products does not exist");
  if (products.some((p) => !p.isActive)) throw badRequest("One of the products is no longer sold");
  return new Map(products.map((p) => [p.id, p]));
};

const uniqueProducts = (items) => {
  if (new Set(items.map((i) => i.productId)).size !== items.length) throw badRequest("List each product only once");
};

// ---------------------------------------------------------------------
// Products (names and selling prices)
// ---------------------------------------------------------------------
router.use("/products", crud({
  resource: "products",
  model: "product",
  fields: { code: "string!", name: "string!", unit: "string!", unitPrice: "decimal!", isActive: "bool" },
  updateFields: { name: "string!", unit: "string!", unitPrice: "decimal!", isActive: "bool" },
  orderBy: { name: "asc" },
  prepare: (data) => {
    if (data.code) data.code = data.code.toUpperCase().replace(/\s+/g, "_");
  },
  remove: false,
}));

// ---------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------
router.use("/customers", crud({
  resource: "customers",
  model: "customer",
  fields: { name: "string!", phone: "string", customerType: "option:customerTypes", location: "string" },
  search: ["name", "phone", "location"],
  filters: ["customerType"],
  orderBy: { name: "asc" },
  beforeDelete: async (customer, { tx }) => {
    if (await tx.sale.count({ where: { customerId: customer.id } })) throw conflict("This customer has sales and cannot be deleted");
  },
}));

// ---------------------------------------------------------------------
// Local sales (counter sales from the Sales store)
// ---------------------------------------------------------------------
const saleInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { include: { product: productBrief } },
  payments: true,
};
const saleStatus = (total, paid) => (paid >= total - 0.001 ? "paid" : paid > 0 ? "partial" : "credit");

const saleRouter = express.Router();
saleRouter.post("/", allow("sales", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    customerId: "id",
    customerName: "string",
    paymentMethod: "option:paymentMethods!",
    amountPaid: "decimal",
    notes: "text",
  }, req.body);
  const items = parseItems(req.body.items, { productId: "id!", quantity: "decimal!", unitPrice: "decimal" }, { label: "products sold" })
    .filter((line) => line.quantity > 0);
  if (!items.length) throw badRequest("Enter a quantity for at least one product");
  uniqueProducts(items);

  const sale = await inTransaction(async (tx) => {
    const products = await loadProducts(tx, items.map((i) => i.productId));
    const lines = items.map((line) => {
      const unitPrice = line.unitPrice ?? Number(products.get(line.productId).unitPrice);
      return { productId: line.productId, quantity: line.quantity, unitPrice, total: round2(unitPrice * line.quantity) };
    });
    const totalAmount = round2(lines.reduce((sum, line) => sum + line.total, 0));
    const paid = data.paymentMethod === "credit" ? round2(data.amountPaid || 0) : round2(data.amountPaid ?? totalAmount);
    if (paid > totalAmount) throw badRequest("Amount paid is more than the sale total");
    if (paid < totalAmount && !data.customerId && !data.customerName) {
      throw badRequest("Name the customer for a sale that is not fully paid");
    }
    const saleNumber = await nextNumber(tx, "SAL", data.date);
    const created = await tx.sale.create({
      data: {
        ...data,
        saleNumber,
        totalAmount,
        amountPaid: paid,
        status: saleStatus(totalAmount, paid),
        items: { create: lines },
        ...(paid > 0 ? { payments: { create: { date: data.date, amount: paid, paymentMethod: data.paymentMethod === "credit" ? "cash" : data.paymentMethod } } } : {}),
      },
      include: saleInclude,
    });
    for (const line of lines) {
      await moveStock(tx, {
        productId: line.productId,
        location: "sales",
        quantity: -line.quantity,
        movementType: "local_sale",
        referenceType: "sale",
        referenceId: created.id,
        date: data.date,
        notes: saleNumber,
      });
    }
    await audit(tx, { user: req.user, action: "create", entity: "sale", entityId: created.id, after: created });
    return created;
  });
  ok(res, sale, 201);
});

// Payment against a credit sale.
saleRouter.post("/:id/payments", allow("sales", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", amount: "decimal!", paymentMethod: "option:paymentMethods!", reference: "string" }, req.body);
  if (!(data.amount > 0)) throw badRequest("Amount must be more than zero");
  if (data.paymentMethod === "credit") throw badRequest("Choose how the customer paid");
  const sale = await inTransaction(async (tx) => {
    const existing = await tx.sale.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Sale");
    const balance = round2(Number(existing.totalAmount) - Number(existing.amountPaid));
    if (data.amount > balance + 0.001) throw badRequest(`The balance on this sale is ${balance}`);
    await tx.salePayment.create({ data: { ...data, saleId: existing.id } });
    const amountPaid = round2(Number(existing.amountPaid) + data.amount);
    const updated = await tx.sale.update({
      where: { id: existing.id },
      data: { amountPaid, status: saleStatus(Number(existing.totalAmount), amountPaid) },
      include: saleInclude,
    });
    await audit(tx, { user: req.user, action: "payment", entity: "sale", entityId: existing.id, metadata: data });
    return updated;
  });
  ok(res, sale, 201);
});

router.use("/sales", crud({
  router: saleRouter,
  resource: "sales",
  model: "sale",
  fields: {},
  include: saleInclude,
  dateField: "date",
  filters: ["status", "customerId", "paymentMethod"],
  search: ["saleNumber", "customerName"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  // Deleting a sale (head only) puts the stock back.
  beforeDelete: async (sale, { tx }) => {
    const items = await tx.saleItem.findMany({ where: { saleId: sale.id } });
    for (const line of items) {
      await moveStock(tx, {
        productId: line.productId,
        location: "sales",
        quantity: Number(line.quantity),
        movementType: "sale_reversal",
        referenceType: "sale",
        referenceId: sale.id,
        date: sale.date,
        notes: `${sale.saleNumber} deleted`,
      });
    }
    await tx.salePayment.deleteMany({ where: { saleId: sale.id } });
  },
}));

// ---------------------------------------------------------------------
// Vehicles and their crew
// ---------------------------------------------------------------------
router.use("/vehicles", crud({
  resource: "vehicles",
  model: "vehicle",
  fields: {
    registrationNumber: "string!",
    description: "string",
    driverName: "string!",
    driverPhone: "string",
    salesPersonName: "string!",
    salesPersonPhone: "string",
    status: "option:vehicleStatus",
  },
  search: ["registrationNumber", "driverName", "salesPersonName"],
  filters: ["status"],
  orderBy: { registrationNumber: "asc" },
  prepare: (data) => {
    if (data.registrationNumber) data.registrationNumber = data.registrationNumber.toUpperCase();
  },
  beforeDelete: async (vehicle, { tx }) => {
    if (await tx.vehicleDispatch.count({ where: { vehicleId: vehicle.id } })) {
      throw conflict("This vehicle has dispatch records. Mark it inactive instead.");
    }
  },
}));

// ---------------------------------------------------------------------
// Vehicle dispatch (morning) and reconciliation (evening)
// ---------------------------------------------------------------------
const dispatchInclude = {
  vehicle: { select: { id: true, registrationNumber: true } },
  items: { include: { product: productBrief } },
};
const dispatchRouter = express.Router();

dispatchRouter.post("/", allow("dispatches", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", vehicleId: "id!", driverName: "string", salesPersonName: "string", notes: "text" }, req.body);
  const items = parseItems(req.body.items, { productId: "id!", quantityDispatched: "decimal!" }, { label: "products loaded" })
    .filter((line) => line.quantityDispatched > 0);
  if (!items.length) throw badRequest("Enter a quantity for at least one product");
  uniqueProducts(items);

  const dispatch = await inTransaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle || vehicle.status !== "active") throw badRequest("Choose an active vehicle");
    const open = await tx.vehicleDispatch.findFirst({ where: { vehicleId: vehicle.id, status: "dispatched" } });
    if (open) throw conflict(`${vehicle.registrationNumber} has not been reconciled for ${open.dispatchNumber} yet`);
    const products = await loadProducts(tx, items.map((i) => i.productId));
    const lines = items.map((line) => ({ ...line, unitPrice: Number(products.get(line.productId).unitPrice) }));
    const created = await tx.vehicleDispatch.create({
      data: {
        date: data.date,
        vehicleId: vehicle.id,
        driverName: data.driverName || vehicle.driverName,
        salesPersonName: data.salesPersonName || vehicle.salesPersonName,
        notes: data.notes,
        dispatchNumber: await nextNumber(tx, "DSP", data.date),
        expectedAmount: round2(lines.reduce((sum, line) => sum + line.quantityDispatched * line.unitPrice, 0)),
        items: { create: lines },
      },
      include: dispatchInclude,
    });
    for (const line of lines) {
      await moveStock(tx, {
        productId: line.productId,
        location: "sales",
        quantity: -line.quantityDispatched,
        movementType: "vehicle_dispatch",
        referenceType: "vehicleDispatch",
        referenceId: created.id,
        date: data.date,
        notes: `${created.dispatchNumber} ${vehicle.registrationNumber}`,
      });
    }
    await audit(tx, { user: req.user, action: "create", entity: "vehicleDispatch", entityId: created.id, after: created });
    return created;
  });
  ok(res, dispatch, 201);
});

dispatchRouter.post("/:id/reconcile", allow("dispatches", "reconcile"), async (req, res) => {
  const money = parseBody({ cashReturned: "decimal!", mpesaReturned: "decimal", notes: "text" }, req.body);
  const lines = parseItems(req.body.items, { itemId: "id!", quantityReturned: "decimal", quantityDamaged: "decimal" }, { label: "returns" });

  const dispatch = await inTransaction(async (tx) => {
    const existing = await tx.vehicleDispatch.findUnique({ where: { id: req.params.id }, include: { items: true, vehicle: true } });
    if (!existing) throw notFound("Dispatch");
    if (existing.status !== "dispatched") throw conflict("This dispatch has already been reconciled");
    const byId = new Map(lines.map((line) => [line.itemId, line]));
    let expected = 0;
    for (const item of existing.items) {
      const line = byId.get(item.id) || {};
      const returned = round2(line.quantityReturned || 0);
      const damaged = round2(line.quantityDamaged || 0);
      const dispatched = Number(item.quantityDispatched);
      if (returned + damaged > dispatched + 0.001) {
        throw badRequest("Returned plus damaged cannot be more than what was loaded");
      }
      const sold = round2(dispatched - returned - damaged);
      expected += sold * Number(item.unitPrice);
      await tx.dispatchItem.update({
        where: { id: item.id },
        data: { quantityReturned: returned, quantityDamaged: damaged, quantitySold: sold },
      });
      const ref = { referenceType: "vehicleDispatch", referenceId: existing.id, date: existing.date };
      if (returned > 0) {
        await moveStock(tx, { ...ref, productId: item.productId, location: "sales", quantity: returned, movementType: "vehicle_return", notes: `${existing.dispatchNumber} returned` });
      }
      if (damaged > 0) {
        await tx.damageReplacement.create({
          data: {
            recordNumber: await nextNumber(tx, "DMG", existing.date),
            date: existing.date,
            recordType: "damage",
            productId: item.productId,
            quantity: damaged,
            value: round2(damaged * Number(item.unitPrice)),
            reason: `Damaged on vehicle ${existing.vehicle.registrationNumber} (${existing.dispatchNumber})`,
          },
        });
      }
    }
    const expectedAmount = round2(expected);
    const handedIn = round2(money.cashReturned + (money.mpesaReturned || 0));
    const updated = await tx.vehicleDispatch.update({
      where: { id: existing.id },
      data: {
        status: "reconciled",
        expectedAmount,
        cashReturned: money.cashReturned,
        mpesaReturned: money.mpesaReturned || 0,
        variance: round2(handedIn - expectedAmount),
        reconciledAt: new Date(),
        notes: [existing.notes, money.notes].filter(Boolean).join(" | ") || null,
      },
      include: dispatchInclude,
    });
    await audit(tx, { user: req.user, action: "reconcile", entity: "vehicleDispatch", entityId: existing.id, before: existing, after: updated });
    return updated;
  });
  ok(res, dispatch);
});

router.use("/dispatches", crud({
  router: dispatchRouter,
  resource: "dispatches",
  model: "vehicleDispatch",
  fields: {},
  include: dispatchInclude,
  dateField: "date",
  filters: ["status", "vehicleId"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  beforeDelete: async (dispatch, { tx }) => {
    if (dispatch.status !== "dispatched") throw conflict("A reconciled dispatch cannot be deleted");
    const items = await tx.dispatchItem.findMany({ where: { dispatchId: dispatch.id } });
    for (const item of items) {
      await moveStock(tx, {
        productId: item.productId,
        location: "sales",
        quantity: Number(item.quantityDispatched),
        movementType: "dispatch_cancelled",
        referenceType: "vehicleDispatch",
        referenceId: dispatch.id,
        date: dispatch.date,
        notes: `${dispatch.dispatchNumber} cancelled`,
      });
    }
  },
}));

// ---------------------------------------------------------------------
// Damages and customer replacements
// ---------------------------------------------------------------------
const damageRouter = express.Router();
damageRouter.post("/", allow("damages", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    recordType: "option:damageTypes!",
    productId: "id!",
    quantity: "decimal!",
    customerId: "id",
    customerName: "string",
    reason: "text!",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  if (data.recordType === "replacement" && !data.customerId && !data.customerName) {
    throw badRequest("Name the customer receiving the replacement");
  }
  const record = await inTransaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw notFound("Product");
    const created = await tx.damageReplacement.create({
      data: {
        ...data,
        recordNumber: await nextNumber(tx, data.recordType === "damage" ? "DMG" : "RPL", data.date),
        value: round2(data.quantity * Number(product.unitPrice)),
      },
      include: { product: productBrief, customer: { select: { id: true, name: true } } },
    });
    await moveStock(tx, {
      productId: product.id,
      location: "sales",
      quantity: -data.quantity,
      movementType: data.recordType,
      referenceType: "damageReplacement",
      referenceId: created.id,
      date: data.date,
      notes: data.reason,
    });
    await audit(tx, { user: req.user, action: "create", entity: "damageReplacement", entityId: created.id, after: created });
    return created;
  });
  ok(res, record, 201);
});
router.use("/damages", crud({
  router: damageRouter,
  resource: "damages",
  model: "damageReplacement",
  fields: {},
  include: { product: productBrief, customer: { select: { id: true, name: true } } },
  dateField: "date",
  filters: ["recordType", "productId"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

// Quick figures for the Sales screen.
router.get("/summary", allow("sales", "read"), async (req, res) => {
  const outstanding = await prisma.sale.findMany({
    where: { status: { in: ["credit", "partial"] } },
    select: { totalAmount: true, amountPaid: true },
  });
  const openDispatches = await prisma.vehicleDispatch.count({ where: { status: "dispatched" } });
  ok(res, {
    creditOutstanding: round2(outstanding.reduce((sum, s) => sum + Number(s.totalAmount) - Number(s.amountPaid), 0)),
    creditSales: outstanding.length,
    openDispatches,
  });
});

export default router;
