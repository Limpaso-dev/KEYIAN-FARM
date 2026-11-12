import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { parseBody, parseItems, round2 } from "../../lib/validate.js";
import { accountBalance, checkCategory, recordTransaction } from "./ledger.js";

const router = express.Router();
const accountBrief = { select: { id: true, name: true, accountType: true } };

// ---------------------------------------------------------------------
// Money accounts (cash, bank, M-Pesa) with live balances
// ---------------------------------------------------------------------
const accountRouter = express.Router();
accountRouter.get("/balances", allow("accounts", "read"), async (req, res) => {
  const accounts = await prisma.account.findMany({ orderBy: { name: "asc" } });
  const rows = [];
  for (const account of accounts) rows.push({ ...account, balance: await accountBalance(prisma, account.id) });
  ok(res, rows);
});
router.use("/accounts", crud({
  router: accountRouter,
  resource: "accounts",
  model: "account",
  fields: { name: "string!", accountType: "option:accountTypes!", accountNumber: "string", openingBalance: "decimal", isActive: "bool" },
  updateFields: { name: "string!", accountNumber: "string", isActive: "bool" },
  orderBy: { name: "asc" },
  beforeDelete: async (account, { tx }) => {
    if (await tx.transaction.count({ where: { accountId: account.id } })) throw conflict("This account has transactions. Deactivate it instead.");
  },
}));

// ---------------------------------------------------------------------
// Income and expenses
// ---------------------------------------------------------------------
const txInclude = { account: accountBrief, createdBy: { select: { id: true, name: true } } };
const transactionRouter = express.Router();

transactionRouter.post("/", allow("transactions", "write"), async (req, res) => {
  const data = parseBody({
    type: "option:transactionTypes!",
    category: "string!",
    accountId: "id!",
    date: "date!",
    amount: "decimal!",
    description: "text!",
    party: "string",
    department: "option:departments",
  }, req.body);
  checkCategory(data.type, data.category);
  const transaction = await inTransaction(async (tx) => {
    const created = await recordTransaction(tx, req.user, { ...data, sourceType: "manual" });
    await audit(tx, { user: req.user, action: "create", entity: "transaction", entityId: created.id, after: created });
    return tx.transaction.findUnique({ where: { id: created.id }, include: txInclude });
  });
  ok(res, transaction, 201);
});

// Entries are never deleted; the head of Accounts voids them with a reason.
transactionRouter.post("/:id/void", allow("transactions", "void"), async (req, res) => {
  const { reason } = parseBody({ reason: "text!" }, req.body);
  const transaction = await inTransaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Transaction");
    if (existing.status === "voided") throw conflict("This entry is already voided");
    if (existing.sourceType && existing.sourceType !== "manual") {
      throw conflict("This entry was created by a payment (payroll, milk or supplier). It cannot be voided here.");
    }
    const updated = await tx.transaction.update({ where: { id: existing.id }, data: { status: "voided", voidReason: reason }, include: txInclude });
    await audit(tx, { user: req.user, action: "void", entity: "transaction", entityId: existing.id, before: existing, after: updated });
    return updated;
  });
  ok(res, transaction);
});

// Totals by category for a period.
transactionRouter.get("/summary", allow("transactions", "read"), async (req, res) => {
  const where = { status: "posted", ...dateRange("date", req.query) };
  const groups = await prisma.transaction.groupBy({ by: ["type", "category"], where, _sum: { amount: true }, _count: true });
  const rows = groups.map((g) => ({ type: g.type, category: g.category, count: g._count, amount: Number(g._sum.amount || 0) }));
  const total = (type) => round2(rows.filter((r) => r.type === type).reduce((sum, r) => sum + r.amount, 0));
  ok(res, { rows, income: total("income"), expenses: total("expense"), net: round2(total("income") - total("expense")) });
});

router.use("/transactions", crud({
  router: transactionRouter,
  resource: "transactions",
  model: "transaction",
  fields: {},
  include: txInclude,
  dateField: "date",
  filters: ["type", "category", "accountId", "status", "department"],
  search: ["reference", "description", "party"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Farmers' ID and payment details. MVA registers the farmer (name and
// number); these details are kept by Accounts and hidden from MVA.
// ---------------------------------------------------------------------
router.use("/farmers", crud({
  resource: "farmerDetails",
  model: "milkSupplier",
  label: "Farmer",
  fields: {},
  updateFields: { nationalId: "string", phone: "string", location: "string", paymentMethod: "option:paymentMethods!", bankName: "string", accountNumber: "string" },
  create: false,
  remove: false,
  search: ["firstName", "lastName", "nationalId", "accountNumber"],
  filters: ["status", "paymentMethod"],
  orderBy: { supplierNumber: "asc" },
}));

// ---------------------------------------------------------------------
// Farmer milk payments (Members payment). A run collects every unpaid
// delivery in the period, totals it per farmer, and is paid in one go.
// ---------------------------------------------------------------------
const runInclude = {
  lines: {
    include: { supplier: { select: { id: true, supplierNumber: true, firstName: true, lastName: true, paymentMethod: true, bankName: true, accountNumber: true } } },
    orderBy: { supplier: { supplierNumber: "asc" } },
  },
};
const milkRouter = express.Router();

milkRouter.post("/", allow("milkPayments", "write"), async (req, res) => {
  const { periodStart, periodEnd } = parseBody({ periodStart: "date!", periodEnd: "date!" }, req.body);
  if (periodEnd < periodStart) throw badRequest("The period end is before its start");
  const run = await inTransaction(async (tx) => {
    const where = { date: { gte: periodStart, lte: periodEnd }, paymentRunId: null };
    const groups = await tx.milkDelivery.groupBy({ by: ["supplierId"], where, _sum: { litres: true, amount: true } });
    if (!groups.length) throw conflict("There are no unpaid milk deliveries in this period");
    const lines = groups.map((g) => {
      const amount = round2(Number(g._sum.amount || 0));
      return { supplierId: g.supplierId, litres: Number(g._sum.litres || 0), amount, deductions: 0, netAmount: amount };
    });
    const created = await tx.milkPaymentRun.create({
      data: {
        runNumber: await nextNumber(tx, "MPR", periodEnd),
        periodStart,
        periodEnd,
        totalLitres: round2(lines.reduce((s, l) => s + l.litres, 0)),
        totalAmount: round2(lines.reduce((s, l) => s + l.netAmount, 0)),
        lines: { create: lines },
      },
    });
    await tx.milkDelivery.updateMany({ where, data: { paymentRunId: created.id } });
    await audit(tx, { user: req.user, action: "create", entity: "milkPaymentRun", entityId: created.id, after: created });
    return tx.milkPaymentRun.findUnique({ where: { id: created.id }, include: runInclude });
  });
  ok(res, run, 201);
});

// Set deductions on a farmer's line (e.g. advances, feeds bought).
milkRouter.put("/:id/lines/:lineId", allow("milkPayments", "write"), async (req, res) => {
  const { deductions } = parseBody({ deductions: "decimal!" }, req.body);
  const run = await inTransaction(async (tx) => {
    const existing = await tx.milkPaymentRun.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Payment run");
    if (existing.status !== "draft") throw conflict("Only a draft payment run can be changed");
    const line = await tx.milkPaymentLine.findFirst({ where: { id: req.params.lineId, runId: existing.id } });
    if (!line) throw notFound("Payment line");
    if (deductions > Number(line.amount)) throw badRequest("Deductions cannot be more than the amount earned");
    await tx.milkPaymentLine.update({ where: { id: line.id }, data: { deductions, netAmount: round2(Number(line.amount) - deductions) } });
    const lines = await tx.milkPaymentLine.findMany({ where: { runId: existing.id } });
    await tx.milkPaymentRun.update({ where: { id: existing.id }, data: { totalAmount: round2(lines.reduce((s, l) => s + Number(l.netAmount), 0)) } });
    return tx.milkPaymentRun.findUnique({ where: { id: existing.id }, include: runInclude });
  });
  ok(res, run);
});

milkRouter.post("/:id/pay", allow("milkPayments", "pay"), async (req, res) => {
  const { accountId, date } = parseBody({ accountId: "id!", date: "date!" }, req.body);
  const run = await inTransaction(async (tx) => {
    const existing = await tx.milkPaymentRun.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Payment run");
    if (existing.status !== "draft") throw conflict("This payment run has already been paid");
    const transaction = await recordTransaction(tx, req.user, {
      type: "expense",
      category: "members_payment",
      accountId,
      date,
      amount: existing.totalAmount,
      description: `Farmer milk payment ${existing.runNumber}`,
      party: "Milk suppliers",
      department: "mva",
      sourceType: "milkPaymentRun",
      sourceId: existing.id,
    });
    const updated = await tx.milkPaymentRun.update({
      where: { id: existing.id },
      data: { status: "paid", paidAt: new Date(), transactionId: transaction.id },
      include: runInclude,
    });
    await audit(tx, { user: req.user, action: "pay", entity: "milkPaymentRun", entityId: existing.id });
    return updated;
  });
  ok(res, run);
});

router.use("/milk-payments", crud({
  router: milkRouter,
  resource: "milkPayments",
  model: "milkPaymentRun",
  fields: {},
  include: runInclude,
  dateField: "periodEnd",
  filters: ["status"],
  orderBy: { periodEnd: "desc" },
  create: false,
  update: false,
  beforeDelete: async (run, { tx }) => {
    if (run.status !== "draft") throw conflict("A paid run cannot be deleted");
    await tx.milkDelivery.updateMany({ where: { paymentRunId: run.id }, data: { paymentRunId: null } });
  },
}));

// ---------------------------------------------------------------------
// Payments to pioneer members / successors (dividends etc.)
// ---------------------------------------------------------------------
const memberInclude = { member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } } };
const memberPaymentRouter = express.Router();
memberPaymentRouter.post("/", allow("memberPayments", "write"), async (req, res) => {
  const data = parseBody({
    memberId: "id!",
    date: "date!",
    paymentType: "option:memberPaymentTypes!",
    amount: "decimal!",
    accountId: "id!",
    description: "text",
  }, req.body);
  const payment = await inTransaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: data.memberId } });
    if (!member) throw notFound("Member");
    if (member.status !== "active") throw conflict("Payments go to active members. This member has been succeeded or is inactive.");
    const { accountId, ...fields } = data;
    const created = await tx.memberPayment.create({ data: fields });
    const transaction = await recordTransaction(tx, req.user, {
      type: "expense",
      category: "members_payment",
      accountId,
      date: data.date,
      amount: data.amount,
      description: `${data.paymentType === "dividend" ? "Dividend" : "Payment"} to member ${member.memberNumber}`,
      party: `${member.memberNumber} ${member.firstName} ${member.lastName}`,
      department: "hr",
      sourceType: "memberPayment",
      sourceId: created.id,
    });
    const updated = await tx.memberPayment.update({ where: { id: created.id }, data: { transactionId: transaction.id }, include: memberInclude });
    await audit(tx, { user: req.user, action: "create", entity: "memberPayment", entityId: created.id, after: updated });
    return updated;
  });
  ok(res, payment, 201);
});
router.use("/member-payments", crud({
  router: memberPaymentRouter,
  resource: "memberPayments",
  model: "memberPayment",
  fields: {},
  include: memberInclude,
  dateField: "date",
  filters: ["memberId", "paymentType"],
  orderBy: { date: "desc" },
  create: false,
  update: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Procurement: suppliers and purchase orders
// ---------------------------------------------------------------------
router.use("/suppliers", crud({
  resource: "suppliers",
  model: "supplier",
  fields: {
    name: "string!",
    contactPerson: "string",
    phone: "string",
    email: "string",
    address: "string",
    kraPin: "string",
    status: "option:supplierStatus",
  },
  search: ["name", "contactPerson", "phone"],
  filters: ["status"],
  orderBy: { name: "asc" },
  beforeDelete: async (supplier, { tx }) => {
    if (await tx.purchaseOrder.count({ where: { supplierId: supplier.id } })) throw conflict("This supplier has purchase orders. Mark it inactive instead.");
  },
}));

const poInclude = {
  supplier: { select: { id: true, name: true } },
  requisition: { select: { id: true, requisitionNumber: true, department: true, title: true } },
  items: { include: { storeItem: { select: { id: true, code: true, name: true, unit: true } } } },
};
const poRouter = express.Router();

poRouter.post("/", allow("purchaseOrders", "write"), async (req, res) => {
  const data = parseBody({ date: "date!", supplierId: "id!", requisitionId: "id", notes: "text" }, req.body);
  const items = parseItems(req.body.items, {
    storeItemId: "id",
    description: "string!",
    quantity: "decimal!",
    unitPrice: "decimal!",
  }, { label: "order lines" });
  if (items.some((i) => !(i.quantity > 0))) throw badRequest("Each line needs a quantity more than zero");
  const order = await inTransaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier || supplier.status !== "active") throw badRequest("Choose an active supplier");
    if (data.requisitionId) {
      const requisition = await tx.requisition.findUnique({ where: { id: data.requisitionId } });
      if (!requisition || requisition.status !== "approved") throw conflict("Purchase orders can only be raised against approved requisitions");
    }
    const lines = items.map((i) => ({ ...i, total: round2(i.quantity * i.unitPrice) }));
    const created = await tx.purchaseOrder.create({
      data: {
        ...data,
        poNumber: await nextNumber(tx, "LPO", data.date),
        totalAmount: round2(lines.reduce((s, l) => s + l.total, 0)),
        items: { create: lines },
      },
      include: poInclude,
    });
    await audit(tx, { user: req.user, action: "create", entity: "purchaseOrder", entityId: created.id, after: created });
    return created;
  });
  ok(res, order, 201);
});

// Stores does not use purchase orders, so deliveries are not received against
// them: goods come into the store through Stores' own Goods received.

poRouter.post("/:id/pay", allow("purchaseOrders", "pay"), async (req, res) => {
  const data = parseBody({ accountId: "id!", date: "date!", amount: "decimal!", category: "string" }, req.body);
  const category = data.category || "purchases";
  checkCategory("expense", category);
  const order = await inTransaction(async (tx) => {
    const existing = await tx.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { supplier: true, requisition: true } });
    if (!existing) throw notFound("Purchase order");
    if (existing.status === "cancelled") throw conflict("This order was cancelled");
    const balance = round2(Number(existing.totalAmount) - Number(existing.amountPaid));
    if (data.amount > balance + 0.001) throw badRequest(`The unpaid balance on this order is ${balance}`);
    await recordTransaction(tx, req.user, {
      type: "expense",
      category,
      accountId: data.accountId,
      date: data.date,
      amount: data.amount,
      description: `Payment for ${existing.poNumber}`,
      party: existing.supplier.name,
      department: existing.requisition?.department,
      sourceType: "purchaseOrder",
      sourceId: existing.id,
    });
    const updated = await tx.purchaseOrder.update({
      where: { id: existing.id },
      data: { amountPaid: round2(Number(existing.amountPaid) + data.amount) },
      include: poInclude,
    });
    await audit(tx, { user: req.user, action: "pay", entity: "purchaseOrder", entityId: existing.id, metadata: data });
    return updated;
  });
  ok(res, order);
});

poRouter.post("/:id/cancel", allow("purchaseOrders", "write"), async (req, res) => {
  const order = await inTransaction(async (tx) => {
    const existing = await tx.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!existing) throw notFound("Purchase order");
    if (existing.status !== "ordered" || Number(existing.amountPaid) > 0) {
      throw conflict("Only orders with nothing received or paid can be cancelled");
    }
    const updated = await tx.purchaseOrder.update({ where: { id: existing.id }, data: { status: "cancelled" }, include: poInclude });
    await audit(tx, { user: req.user, action: "cancel", entity: "purchaseOrder", entityId: existing.id });
    return updated;
  });
  ok(res, order);
});

router.use("/purchase-orders", crud({
  router: poRouter,
  resource: "purchaseOrders",
  model: "purchaseOrder",
  fields: {},
  include: poInclude,
  dateField: "date",
  filters: ["status", "supplierId"],
  search: ["poNumber"],
  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  create: false,
  update: false,
  remove: false,
}));

export default router;
