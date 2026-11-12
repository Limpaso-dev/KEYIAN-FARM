import express from "express";
import prisma from "../../config/prisma.js";
import { RAW_MILK } from "../../config/catalog.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { nairobiToday } from "../../lib/periods.js";
import { moveStock, stillOnVehicle } from "../../lib/stock.js";
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

// Local sales and vehicles have separate price lists.
const PRICE = { local: ["localPrice", "local"], vehicle: ["vehiclePrice", "vehicle"] };
const priceOf = (product, channel) => {
  const [field, name] = PRICE[channel];
  const price = Number(product[field]);
  if (!(price > 0)) throw badRequest(`Set a ${name} price for ${product.name} under Prices first`);
  return price;
};

// ---------------------------------------------------------------------
// Products and their two prices. A price left blank (0) means the product
// is not sold that way.
// ---------------------------------------------------------------------
router.use("/products", crud({
  resource: "products",
  model: "product",
  fields: { code: "string!", name: "string!", unit: "string!", localPrice: "decimal", vehiclePrice: "decimal", isActive: "bool" },
  updateFields: { name: "string!", unit: "string!", localPrice: "decimal", vehiclePrice: "decimal", isActive: "bool" },
  orderBy: { name: "asc" },
  prepare: (data) => {
    if (data.code) data.code = data.code.toUpperCase().replace(/\s+/g, "_");
    if (data.localPrice === null) data.localPrice = 0;
    if (data.vehiclePrice === null) data.vehiclePrice = 0;
  },
  beforeDelete: async (product, { tx }) => {
    if (product.code === RAW_MILK) throw conflict("Raw milk is needed for recording milk intake and cannot be deleted");
    if (await tx.stockMovement.count({ where: { productId: product.id } })) {
      throw conflict(`${product.name} has stock or sales records, so it cannot be deleted. Edit it and turn off "Available for sale" to retire it.`);
    }
  },
}));

// ---------------------------------------------------------------------
// Local sales (counter sales from the Sales store)
// ---------------------------------------------------------------------
const saleInclude = {
  items: { include: { product: productBrief } },
  payments: true,
};
const saleStatus = (total, paid) => (paid >= total - 0.001 ? "paid" : paid > 0 ? "partial" : "credit");

const saleRouter = express.Router();
saleRouter.post("/", allow("sales", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    customerName: "string",
    reference: "string",
    paymentMethod: "option:paymentMethods!",
    amountPaid: "decimal",
    notes: "text",
  }, req.body);
  const items = parseItems(req.body.items, { productId: "id!", quantity: "decimal!" }, { label: "products sold" })
    .filter((line) => line.quantity > 0);
  if (!items.length) throw badRequest("Enter a quantity for at least one product");
  uniqueProducts(items);

  const sale = await inTransaction(async (tx) => {
    const products = await loadProducts(tx, items.map((i) => i.productId));
    const lines = items.map((line) => {
      const unitPrice = priceOf(products.get(line.productId), "local");
      return { productId: line.productId, quantity: line.quantity, unitPrice, total: round2(unitPrice * line.quantity) };
    });
    const totalAmount = round2(lines.reduce((sum, line) => sum + line.total, 0));
    const paid = data.paymentMethod === "credit" ? round2(data.amountPaid || 0) : round2(data.amountPaid ?? totalAmount);
    if (paid > totalAmount) throw badRequest("Amount paid is more than the sale total");
    if (paid < totalAmount && !data.customerName) {
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
  filters: ["status", "paymentMethod"],
  search: ["saleNumber", "customerName", "reference"],
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

/**
 * Save something that happened to a vehicle's load. A return goes back into
 * the store at once; damages and replacements come off the load (the stock
 * already left the store when the vehicle was loaded).
 */
const applyVehicleRecord = async (tx, dispatch, item, record) => {
  const created = await tx.damageReplacement.create({
    data: { ...record, dispatchId: dispatch.id, productId: item.productId, value: round2(record.quantity * Number(item.unitPrice)) },
  });
  if (record.recordType === "vehicle_return") {
    await moveStock(tx, {
      productId: item.productId,
      location: "sales",
      quantity: record.quantity,
      movementType: "vehicle_return",
      referenceType: "damageReplacement",
      referenceId: created.id,
      date: record.date,
      notes: `${dispatch.dispatchNumber} returned`,
    });
  }
  return created;
};

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
    const lines = items.map((line) => ({ ...line, unitPrice: priceOf(products.get(line.productId), "vehicle") }));
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
  // The crew's money comes back as cash, M-Pesa and bank deposits; together they are what was handed in.
  const money = parseBody({ cashReturned: "decimal!", mpesaReturned: "decimal", bankDeposit: "decimal", notes: "text" }, req.body);
  if ([money.cashReturned, money.mpesaReturned, money.bankDeposit].some((amount) => amount < 0)) throw badRequest("Amounts cannot be negative");
  const lines = parseItems(req.body.items, { itemId: "id!", quantityReturned: "decimal", quantityReplaced: "decimal", quantityDamaged: "decimal" }, { label: "returns" });

  const dispatch = await inTransaction(async (tx) => {
    const existing = await tx.vehicleDispatch.findUnique({ where: { id: req.params.id }, include: { items: true, vehicle: true } });
    if (!existing) throw notFound("Dispatch");
    if (existing.status !== "dispatched") throw conflict("This dispatch has already been reconciled");
    const byId = new Map(lines.map((line) => [line.itemId, line]));
    let expected = 0;
    for (const item of existing.items) {
      const line = byId.get(item.id) || {};
      // The form shows what was recorded during the day; only the extra is new.
      const total = (field) => round2(line[field] ?? Number(item[field]));
      const totals = { quantityReturned: total("quantityReturned"), quantityReplaced: total("quantityReplaced"), quantityDamaged: total("quantityDamaged") };
      for (const [field, value] of Object.entries(totals)) {
        if (value < Number(item[field]) - 0.001) throw badRequest(`${Number(item[field])} is already recorded for this trip. The figure cannot be lower.`);
      }
      const dispatched = Number(item.quantityDispatched);
      const sold = round2(dispatched - totals.quantityReturned - totals.quantityReplaced - totals.quantityDamaged);
      if (sold < -0.001) throw badRequest("Returned, replaced and damaged together cannot be more than what was loaded");
      expected += sold * Number(item.unitPrice);
      await tx.dispatchItem.update({ where: { id: item.id }, data: { ...totals, quantitySold: sold } });
      for (const [field, recordType, prefix] of [["quantityReturned", "vehicle_return", "RTN"], ["quantityReplaced", "replacement", "RPL"], ["quantityDamaged", "damage", "DMG"]]) {
        const extra = round2(totals[field] - Number(item[field]));
        if (extra > 0) {
          await applyVehicleRecord(tx, existing, item, {
            recordNumber: await nextNumber(tx, prefix, existing.date),
            date: existing.date,
            recordType,
            quantity: extra,
            reason: `Recorded when reconciling ${existing.dispatchNumber}`,
          });
        }
      }
    }
    const expectedAmount = round2(expected);
    const handedIn = round2(money.cashReturned + (money.mpesaReturned || 0) + (money.bankDeposit || 0));
    const updated = await tx.vehicleDispatch.update({
      where: { id: existing.id },
      data: {
        status: "reconciled",
        expectedAmount,
        cashReturned: money.cashReturned,
        mpesaReturned: money.mpesaReturned || 0,
        bankDeposit: money.bankDeposit || 0,
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
  // Trips still on the road come first. With includeActive, they stay on the
  // list whatever their date, and so does a trip closed today.
  orderBy: [{ status: "asc" }, { date: "desc" }, { createdAt: "desc" }],
  listWhere: (where, query) => {
    if (query.includeActive !== "true" || query.status) return where;
    const startOfToday = new Date(nairobiToday().getTime() - 3 * 60 * 60 * 1000);
    return { OR: [where, { status: "dispatched" }, { reconciledAt: { gte: startOfToday } }] };
  },
  create: false,
  update: false,
  beforeDelete: async (dispatch, { tx }) => {
    if (dispatch.status !== "dispatched") throw conflict("A reconciled dispatch cannot be deleted");
    if (await tx.damageReplacement.count({ where: { dispatchId: dispatch.id } })) throw conflict("This trip has returns or damages recorded and cannot be deleted. Reconcile it instead.");
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
// Damages, customer replacements, returns from vehicles and office use.
// Each one changes stock the moment it is saved, at any time of day. In the
// store it comes off store stock; on a vehicle it comes off the load, and a
// return from a vehicle goes back into store stock.
// ---------------------------------------------------------------------
const RECORD_PREFIX = { damage: "DMG", replacement: "RPL", vehicle_return: "RTN", office: "OFF" };
const recordInclude = {
  product: productBrief,
  dispatch: { select: { id: true, dispatchNumber: true, vehicle: { select: { registrationNumber: true } } } },
};

const damageRouter = express.Router();
damageRouter.post("/", allow("damages", "write"), async (req, res) => {
  const data = parseBody({
    date: "date!",
    recordType: "option:damageTypes!",
    productId: "id!",
    quantity: "decimal!",
    dispatchId: "id",
    customerName: "string",
    reason: "text",
  }, req.body);
  if (!(data.quantity > 0)) throw badRequest("Quantity must be more than zero");
  if (data.recordType === "vehicle_return" && !data.dispatchId) throw badRequest("Choose the vehicle the stock came back from");
  if (data.recordType === "office" && data.dispatchId) throw badRequest("Office use comes from the store, not a vehicle");
  if (data.recordType !== "vehicle_return" && !data.reason) throw badRequest("Give a reason");
  if (data.recordType !== "replacement") data.customerName = null;

  const record = await inTransaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw notFound("Product");
    const recordNumber = await nextNumber(tx, RECORD_PREFIX[data.recordType], data.date);

    if (data.dispatchId) {
      const dispatch = await tx.vehicleDispatch.findUnique({ where: { id: data.dispatchId }, include: { items: true } });
      if (!dispatch) throw notFound("Vehicle trip");
      if (dispatch.status !== "dispatched") throw conflict("That trip has already been closed");
      if (data.date < dispatch.date) throw badRequest("The date is before the vehicle was loaded");
      const item = dispatch.items.find((line) => line.productId === data.productId);
      if (!item) throw badRequest(`${product.name} was not loaded on this vehicle`);
      const left = stillOnVehicle(item);
      if (data.quantity > left + 0.001) throw conflict(`Only ${left} ${product.unit} of ${product.name} is left on this vehicle`);
      const created = await applyVehicleRecord(tx, dispatch, item, { ...data, recordNumber });
      const field = { vehicle_return: "quantityReturned", replacement: "quantityReplaced", damage: "quantityDamaged" }[data.recordType];
      const updated = { ...item, [field]: round2(Number(item[field]) + data.quantity) };
      await tx.dispatchItem.update({ where: { id: item.id }, data: { [field]: updated[field] } });
      // The money expected from the crew follows what is still on the vehicle.
      const expectedAmount = round2(dispatch.items.map((line) => (line.id === item.id ? updated : line)).reduce((total, line) => total + stillOnVehicle(line) * Number(line.unitPrice), 0));
      await tx.vehicleDispatch.update({ where: { id: dispatch.id }, data: { expectedAmount } });
      await audit(tx, { user: req.user, action: "create", entity: "damageReplacement", entityId: created.id, after: created });
      return tx.damageReplacement.findUnique({ where: { id: created.id }, include: recordInclude });
    }

    const created = await tx.damageReplacement.create({
      data: { ...data, recordNumber, value: round2(data.quantity * Number(product.localPrice)) },
      include: recordInclude,
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
  include: recordInclude,
  dateField: "date",
  filters: ["recordType", "productId", "dispatchId"],
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
