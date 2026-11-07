import { optionLabel } from "../../config/catalog.js";
import { stockSummary } from "../../lib/stock.js";
import { round2 } from "../../lib/validate.js";

// Each builder returns:
//   { title, summary: [{ label, value }], sections: [{ title, columns, rows, totals? }] }
// columns: [{ key, label, type? ("number" | "money" | "date") }]

const DAY_MS = 86400000;
const dayRange = (day) => ({ gte: day, lt: new Date(day.getTime() + DAY_MS) });
const sum = (rows, key) => round2(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
const name = (person) => (person ? `${person.firstName} ${person.lastName}` : "");
const col = (key, label, type) => ({ key, label, ...(type ? { type } : {}) });

const section = (title, columns, rows, totalKeys = []) => ({
  title,
  columns,
  rows,
  ...(totalKeys.length && rows.length ? { totals: Object.fromEntries(totalKeys.map((key) => [key, sum(rows, key)])) } : {}),
});

// ---------------------------------------------------------------------
const hr = async (db, day) => {
  const range = dayRange(day);
  const [hires, contracts, reviews, cases, terminations, members, headcount, expiring] = await Promise.all([
    db.employee.findMany({ where: { dateHired: range } }),
    db.contract.findMany({ where: { startDate: range }, include: { employee: true } }),
    db.salaryReview.findMany({ where: { effectiveDate: range }, include: { employee: true } }),
    db.disciplinaryCase.findMany({ where: { incidentDate: range }, include: { employee: true } }),
    db.termination.findMany({ where: { terminationDate: range }, include: { employee: true } }),
    db.member.findMany({ where: { OR: [{ joinDate: range }, { successionDate: range }] }, include: { predecessor: true } }),
    db.employee.groupBy({ by: ["department"], where: { status: "active" }, _count: true }),
    db.contract.count({ where: { status: "active", endDate: { gte: day, lt: new Date(day.getTime() + 30 * DAY_MS) } } }),
  ]);
  const activeStaff = headcount.reduce((total, row) => total + row._count, 0);
  return {
    title: "HR",
    summary: [
      { label: "Active staff", value: activeStaff },
      { label: "New hires today", value: hires.length },
      { label: "Disciplinary cases today", value: cases.length },
      { label: "Terminations today", value: terminations.length },
      { label: "Contracts ending in 30 days", value: expiring },
    ],
    sections: [
      section("Headcount by department", [col("department", "Department"), col("staff", "Active staff", "number")],
        headcount.map((row) => ({ department: optionLabel("departments", row.department), staff: row._count })), ["staff"]),
      section("New staff", [col("staffNumber", "Staff no."), col("name", "Name"), col("department", "Department"), col("jobTitle", "Job title"), col("basicSalary", "Salary", "money")],
        hires.map((e) => ({ staffNumber: e.staffNumber, name: name(e), department: optionLabel("departments", e.department), jobTitle: e.jobTitle, basicSalary: Number(e.basicSalary) }))),
      section("Contracts starting", [col("contractNumber", "Contract"), col("employee", "Staff"), col("type", "Type"), col("endDate", "Ends", "date"), col("salary", "Salary", "money")],
        contracts.map((c) => ({ contractNumber: c.contractNumber, employee: name(c.employee), type: optionLabel("contractTypes", c.contractType), endDate: c.endDate, salary: Number(c.salary) }))),
      section("Salary reviews and promotions", [col("employee", "Staff"), col("type", "Type"), col("from", "Previous", "money"), col("to", "New", "money"), col("title", "New title")],
        reviews.map((r) => ({ employee: name(r.employee), type: optionLabel("salaryReviewTypes", r.reviewType), from: Number(r.previousSalary), to: Number(r.newSalary), title: r.newJobTitle }))),
      section("Disciplinary cases", [col("caseNumber", "Case"), col("employee", "Staff"), col("offence", "Offence"), col("action", "Action"), col("letter", "Letter served")],
        cases.map((c) => ({ caseNumber: c.caseNumber, employee: name(c.employee), offence: c.offence, action: optionLabel("disciplinaryActions", c.actionTaken), letter: c.letterServed ? "Yes" : "No" }))),
      section("Terminations", [col("employee", "Staff"), col("type", "Type"), col("reason", "Reason"), col("finalDues", "Final dues", "money")],
        terminations.map((t) => ({ employee: name(t.employee), type: optionLabel("terminationTypes", t.terminationType), reason: t.reason, finalDues: Number(t.finalDues) }))),
      section("Members registered / succeeded", [col("memberNumber", "Member no."), col("name", "Name"), col("successorOf", "Successor of"), col("relationship", "Relationship")],
        members.map((m) => ({ memberNumber: m.memberNumber, name: name(m), successorOf: m.predecessor ? `${m.predecessor.memberNumber} ${name(m.predecessor)}` : "Pioneer", relationship: m.relationship || "" }))),
    ],
  };
};

// ---------------------------------------------------------------------
const livestock = async (db, day) => {
  const range = dayRange(day);
  const [milk, transfers, lactations, vaccinations, health, herd] = await Promise.all([
    db.milkRecord.findMany({ where: { date: day }, include: { animal: true }, orderBy: { animal: { tagNumber: "asc" } } }),
    db.milkTransfer.findMany({ where: { date: day }, orderBy: { createdAt: "asc" } }),
    db.lactation.findMany({ where: { calvingDate: range }, include: { animal: true } }),
    db.vaccination.findMany({ where: { date: range }, include: { animal: true } }),
    db.healthRecord.findMany({ where: { date: range }, include: { animal: true } }),
    db.animal.groupBy({ by: ["sex"], where: { status: "active" }, _count: true }),
  ]);
  const bySession = ["morning", "midday", "evening"].map((session) => ({
    session: optionLabel("milkSessions", session),
    cows: milk.filter((m) => m.session === session).length,
    litres: sum(milk.filter((m) => m.session === session), "litres"),
    sent: sum(transfers.filter((t) => t.session === session), "litres"),
  })).filter((row) => row.cows || row.sent);
  const perCow = new Map();
  for (const record of milk) {
    const entry = perCow.get(record.animalId) || { tag: record.animal.tagNumber, name: record.animal.name || "", morning: 0, midday: 0, evening: 0, total: 0 };
    entry[record.session] = Number(record.litres);
    entry.total = round2(entry.total + Number(record.litres));
    perCow.set(record.animalId, entry);
  }
  const totalMilk = sum(milk, "litres");
  const totalSent = sum(transfers, "litres");
  const calvings = await Promise.all(lactations.map(async (l) => {
    const calf = l.calfId ? await db.animal.findUnique({ where: { id: l.calfId } }) : null;
    return { dam: `${l.animal.tagNumber} ${l.animal.name || ""}`.trim(), lactation: l.lactationNumber, calf: calf ? `${calf.tagNumber} (${calf.sex})` : "", sire: calf?.sireDetails || "" };
  }));
  return {
    title: "Livestock",
    summary: [
      { label: "Milk recorded (litres)", value: totalMilk },
      { label: "Sent to MVA (litres)", value: totalSent },
      { label: "Not yet sent (litres)", value: round2(totalMilk - totalSent) },
      { label: "Calvings", value: lactations.length },
      { label: "Vaccinations", value: vaccinations.length },
      { label: "Health records", value: health.length },
      { label: "Active herd", value: herd.reduce((t, r) => t + r._count, 0) },
    ],
    sections: [
      section("Milk by session", [col("session", "Session"), col("cows", "Cows", "number"), col("litres", "Litres", "number"), col("sent", "Sent to MVA", "number")], bySession, ["cows", "litres", "sent"]),
      section("Milk per cow", [col("tag", "Tag"), col("name", "Name"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("total", "Total", "number")],
        [...perCow.values()], ["morning", "midday", "evening", "total"]),
      section("Transfers to MVA", [col("transferNumber", "Transfer"), col("session", "Session"), col("litres", "Litres sent", "number"), col("received", "Received by MVA", "number"), col("status", "Status")],
        transfers.map((t) => ({ transferNumber: t.transferNumber, session: optionLabel("milkSessions", t.session), litres: Number(t.litres), received: t.receivedLitres == null ? "" : Number(t.receivedLitres), status: optionLabel("transferStatus", t.status) })), ["litres"]),
      section("Calvings", [col("dam", "Mother"), col("lactation", "Lactation no.", "number"), col("calf", "Calf"), col("sire", "Sire details")], calvings),
      section("Vaccinations", [col("animal", "Animal"), col("vaccine", "Vaccine"), col("dose", "Dose"), col("nextDue", "Next due", "date")],
        vaccinations.map((v) => ({ animal: v.animal.tagNumber, vaccine: v.vaccine, dose: v.dose || "", nextDue: v.nextDueDate }))),
      section("Disease and herd health", [col("animal", "Animal"), col("type", "Type"), col("condition", "Condition"), col("treatment", "Treatment"), col("outcome", "Outcome"), col("cost", "Cost", "money")],
        health.map((h) => ({ animal: h.animal?.tagNumber || "Whole herd", type: optionLabel("healthRecordTypes", h.recordType), condition: h.condition, treatment: h.treatment || "", outcome: optionLabel("healthOutcomes", h.outcome), cost: Number(h.cost) })), ["cost"]),
    ],
  };
};

// ---------------------------------------------------------------------
const mva = async (db, day) => {
  const [transfers, deliveries, batches, outgoing, stock] = await Promise.all([
    db.milkTransfer.findMany({ where: { date: day, status: "received" } }),
    db.milkDelivery.findMany({ where: { date: day }, include: { supplier: true }, orderBy: { supplier: { supplierNumber: "asc" } } }),
    db.processingBatch.findMany({ where: { date: day }, include: { outputs: { include: { product: true } } } }),
    db.productTransfer.findMany({ where: { date: day }, include: { items: { include: { product: true } } } }),
    stockSummary(db, "mva", { upTo: day }),
  ]);
  const fromLivestock = sum(transfers, "receivedLitres");
  const fromFarmers = sum(deliveries, "litres");
  const processed = sum(batches, "rawMilkInput");
  const perFarmer = new Map();
  for (const d of deliveries) {
    const entry = perFarmer.get(d.supplierId) || { number: d.supplier.supplierNumber, farmer: name(d.supplier), morning: 0, midday: 0, evening: 0, litres: 0, amount: 0 };
    entry[d.session] = round2(entry[d.session] + Number(d.litres));
    entry.litres = round2(entry.litres + Number(d.litres));
    entry.amount = round2(entry.amount + Number(d.amount));
    perFarmer.set(d.supplierId, entry);
  }
  const outputs = new Map();
  for (const batch of batches) {
    for (const o of batch.outputs) outputs.set(o.product.name, round2((outputs.get(o.product.name) || 0) + Number(o.quantity)));
  }
  const sent = new Map();
  for (const t of outgoing) {
    for (const item of t.items) sent.set(item.product.name, round2((sent.get(item.product.name) || 0) + Number(item.quantity)));
  }
  return {
    title: "Milk Value Addition",
    summary: [
      { label: "Milk from Livestock (litres)", value: fromLivestock },
      { label: "Milk from farmers (litres)", value: fromFarmers },
      { label: "Farmers delivering", value: perFarmer.size },
      { label: "Raw milk processed (litres)", value: processed },
      { label: "Transfers to Sales", value: outgoing.length },
      { label: "Farmer milk value", value: sum(deliveries, "amount"), type: "money" },
    ],
    sections: [
      section("Farmer deliveries", [col("number", "No."), col("farmer", "Farmer"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("litres", "Litres", "number"), col("amount", "Value", "money")],
        [...perFarmer.values()], ["morning", "midday", "evening", "litres", "amount"]),
      section("Received from Livestock", [col("transferNumber", "Transfer"), col("session", "Session"), col("sent", "Sent", "number"), col("received", "Received", "number")],
        transfers.map((t) => ({ transferNumber: t.transferNumber, session: optionLabel("milkSessions", t.session), sent: Number(t.litres), received: Number(t.receivedLitres) })), ["sent", "received"]),
      section("Processing batches", [col("batchNumber", "Batch"), col("input", "Raw milk in", "number"), col("outputs", "Products made")],
        batches.map((b) => ({ batchNumber: b.batchNumber, input: Number(b.rawMilkInput), outputs: b.outputs.map((o) => `${o.product.name} ${Number(o.quantity)}`).join(", ") })), ["input"]),
      section("Products made and sent to Sales", [col("product", "Product"), col("made", "Made today", "number"), col("sent", "Sent to Sales", "number")],
        [...new Set([...outputs.keys(), ...sent.keys()])].map((product) => ({ product, made: outputs.get(product) || 0, sent: sent.get(product) || 0 }))),
      section("MVA stock at end of day", [col("name", "Product"), col("unit", "Unit"), col("onHand", "On hand", "number")], stock),
    ],
  };
};

// ---------------------------------------------------------------------
const sales = async (db, day) => {
  const [received, localSales, dispatches, damages, payments, stock] = await Promise.all([
    db.productTransfer.findMany({ where: { date: day, status: "received" }, include: { items: { include: { product: true } } } }),
    db.sale.findMany({ where: { date: day }, include: { items: { include: { product: true } }, customer: true } }),
    db.vehicleDispatch.findMany({ where: { date: day }, include: { vehicle: true, items: { include: { product: true } } } }),
    db.damageReplacement.findMany({ where: { date: day }, include: { product: true, customer: true } }),
    db.salePayment.findMany({ where: { date: day }, include: { sale: true } }),
    stockSummary(db, "sales", { upTo: day }),
  ]);
  const products = new Map();
  const bump = (product, key, quantity) => {
    const entry = products.get(product.name) || { product: product.name, received: 0, local: 0, dispatched: 0, returned: 0, vehicleSold: 0, damaged: 0 };
    entry[key] = round2(entry[key] + Number(quantity));
    products.set(product.name, entry);
  };
  received.forEach((t) => t.items.forEach((i) => bump(i.product, "received", i.quantity)));
  localSales.forEach((s) => s.items.forEach((i) => bump(i.product, "local", i.quantity)));
  dispatches.forEach((d) => d.items.forEach((i) => {
    bump(i.product, "dispatched", i.quantityDispatched);
    bump(i.product, "returned", i.quantityReturned);
    bump(i.product, "vehicleSold", i.quantitySold);
  }));
  damages.forEach((d) => bump(d.product, "damaged", d.quantity));

  const reconciled = dispatches.filter((d) => d.status === "reconciled");
  const localTotal = sum(localSales, "totalAmount");
  const vehicleExpected = sum(reconciled, "expectedAmount");
  const vehicleCollected = round2(sum(reconciled, "cashReturned") + sum(reconciled, "mpesaReturned"));
  const collectedLocal = sum(payments, "amount");
  return {
    title: "Sales",
    summary: [
      { label: "Local sales", value: localTotal, type: "money" },
      { label: "Collected at counter", value: collectedLocal, type: "money" },
      { label: "Vehicle sales (expected)", value: vehicleExpected, type: "money" },
      { label: "Vehicle money handed in", value: vehicleCollected, type: "money" },
      { label: "Vehicle shortage / excess", value: round2(vehicleCollected - vehicleExpected), type: "money" },
      { label: "Vehicles not yet reconciled", value: dispatches.length - reconciled.length },
      { label: "Damage / replacement value", value: sum(damages, "value"), type: "money" },
    ],
    sections: [
      section("Product movement", [col("product", "Product"), col("received", "From MVA", "number"), col("local", "Local sales", "number"), col("dispatched", "To vehicles", "number"), col("returned", "Returned", "number"), col("vehicleSold", "Sold by vehicles", "number"), col("damaged", "Damaged / replaced", "number")],
        [...products.values()]),
      section("Vehicles", [col("dispatchNumber", "Dispatch"), col("vehicle", "Vehicle"), col("crew", "Crew"), col("status", "Status"), col("expected", "Expected", "money"), col("handedIn", "Handed in", "money"), col("variance", "Variance", "money")],
        dispatches.map((d) => ({
          dispatchNumber: d.dispatchNumber,
          vehicle: d.vehicle.registrationNumber,
          crew: `${d.driverName} / ${d.salesPersonName}`,
          status: optionLabel("dispatchStatus", d.status),
          expected: Number(d.expectedAmount),
          handedIn: round2(Number(d.cashReturned) + Number(d.mpesaReturned)),
          variance: Number(d.variance),
        })), ["expected", "handedIn", "variance"]),
      section("Local sales", [col("saleNumber", "Sale"), col("customer", "Customer"), col("items", "Items"), col("method", "Payment"), col("total", "Total", "money"), col("paid", "Paid", "money")],
        localSales.map((s) => ({
          saleNumber: s.saleNumber,
          customer: s.customer?.name || s.customerName || "Walk-in",
          items: s.items.map((i) => `${i.product.name} ${Number(i.quantity)}`).join(", "),
          method: optionLabel("paymentMethods", s.paymentMethod),
          total: Number(s.totalAmount),
          paid: Number(s.amountPaid),
        })), ["total", "paid"]),
      section("Damages and replacements", [col("recordNumber", "Record"), col("type", "Type"), col("product", "Product"), col("quantity", "Qty", "number"), col("customer", "Customer"), col("reason", "Reason"), col("value", "Value", "money")],
        damages.map((d) => ({ recordNumber: d.recordNumber, type: optionLabel("damageTypes", d.recordType), product: d.product.name, quantity: Number(d.quantity), customer: d.customer?.name || d.customerName || "", reason: d.reason, value: Number(d.value) })), ["value"]),
      section("Sales stock at end of day", [col("name", "Product"), col("unit", "Unit"), col("onHand", "On hand", "number"), col("unitPrice", "Price", "money")], stock),
    ],
  };
};

// ---------------------------------------------------------------------
const stores = async (db, day) => {
  const [receipts, issues, items] = await Promise.all([
    db.storeReceipt.findMany({ where: { date: day }, include: { item: true, supplier: true } }),
    db.storeIssue.findMany({ where: { date: day }, include: { item: true, requisition: true } }),
    db.storeItem.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  const low = items.filter((i) => Number(i.quantityOnHand) <= Number(i.reorderLevel));
  return {
    title: "Stores",
    summary: [
      { label: "Goods received (lines)", value: receipts.length },
      { label: "Value received", value: round2(receipts.reduce((t, r) => t + Number(r.quantity) * Number(r.unitCost), 0)), type: "money" },
      { label: "Issues to departments", value: issues.length },
      { label: "Items at or below reorder level", value: low.length },
    ],
    sections: [
      section("Goods received", [col("receiptNumber", "GRN"), col("item", "Item"), col("category", "Category"), col("quantity", "Qty", "number"), col("source", "Source"), col("supplier", "Supplier"), col("value", "Value", "money")],
        receipts.map((r) => ({ receiptNumber: r.receiptNumber, item: r.item.name, category: optionLabel("storeCategories", r.item.category), quantity: Number(r.quantity), source: optionLabel("receiptSources", r.source), supplier: r.supplier?.name || "", value: round2(Number(r.quantity) * Number(r.unitCost)) })), ["value"]),
      section("Issued to departments", [col("issueNumber", "Issue"), col("department", "Department"), col("item", "Item"), col("quantity", "Qty", "number"), col("issuedTo", "Received by"), col("requisition", "Requisition")],
        issues.map((i) => ({ issueNumber: i.issueNumber, department: optionLabel("departments", i.department), item: `${i.item.name} (${i.item.unit})`, quantity: Number(i.quantity), issuedTo: i.issuedTo, requisition: i.requisition?.requisitionNumber || "" }))),
      section("Low stock", [col("code", "Code"), col("name", "Item"), col("category", "Category"), col("onHand", "On hand", "number"), col("reorderLevel", "Reorder level", "number")],
        low.map((i) => ({ code: i.code, name: i.name, category: optionLabel("storeCategories", i.category), onHand: Number(i.quantityOnHand), reorderLevel: Number(i.reorderLevel) }))),
      section("Stock on hand", [col("code", "Code"), col("name", "Item"), col("category", "Category"), col("unit", "Unit"), col("onHand", "On hand", "number")],
        items.map((i) => ({ code: i.code, name: i.name, category: optionLabel("storeCategories", i.category), unit: i.unit, onHand: Number(i.quantityOnHand) }))),
    ],
  };
};

// ---------------------------------------------------------------------
const crops = async (db, day) => {
  const [harvests, statusLogs, farms] = await Promise.all([
    db.cropHarvest.findMany({ where: { harvestDate: day }, include: { farm: true } }),
    db.cropStatusLog.findMany({ where: { date: day }, include: { farm: true } }),
    db.cropFarm.findMany({ orderBy: [{ cropType: "asc" }, { farmNumber: "asc" }] }),
  ]);
  const byCrop = ["sugarcane", "tea", "coffee"].map((crop) => {
    const list = farms.filter((f) => f.cropType === crop);
    return { crop: optionLabel("cropTypes", crop), farms: list.length, acreage: sum(list, "acreage") };
  });
  return {
    title: "Crops",
    summary: [
      { label: "Harvests today", value: harvests.length },
      { label: "Harvest value", value: sum(harvests, "amount"), type: "money" },
      { label: "Farm status updates", value: statusLogs.length },
      { label: "Total farms", value: farms.length },
      { label: "Total acreage", value: sum(farms, "acreage") },
    ],
    sections: [
      section("Farms by crop", [col("crop", "Crop"), col("farms", "Farms", "number"), col("acreage", "Acres", "number")], byCrop, ["farms", "acreage"]),
      section("Harvests", [col("farm", "Farm"), col("crop", "Crop"), col("quantity", "Quantity", "number"), col("unit", "Unit"), col("buyer", "Buyer"), col("amount", "Value", "money")],
        harvests.map((h) => ({ farm: h.farm.farmNumber, crop: optionLabel("cropTypes", h.farm.cropType), quantity: Number(h.quantity), unit: h.unit, buyer: h.buyer || "", amount: Number(h.amount) })), ["amount"]),
      section("Status updates", [col("farm", "Farm"), col("crop", "Crop"), col("status", "New status"), col("note", "Note")],
        statusLogs.map((s) => ({ farm: s.farm.farmNumber, crop: optionLabel("cropTypes", s.farm.cropType), status: optionLabel("farmStatus", s.status), note: s.note || "" }))),
      section("All farms", [col("farmNumber", "Farm no."), col("crop", "Crop"), col("location", "Location"), col("acreage", "Acres", "number"), col("ratoon", "Ratoon", "number"), col("status", "Status")],
        farms.map((f) => ({ farmNumber: f.farmNumber, crop: optionLabel("cropTypes", f.cropType), location: f.location, acreage: Number(f.acreage), ratoon: f.ratoonCount, status: optionLabel("farmStatus", f.status) }))),
    ],
  };
};

// ---------------------------------------------------------------------
const accounts = async (db, day) => {
  const [transactions, accountsList, requisitions] = await Promise.all([
    db.transaction.findMany({ where: { date: day, status: "posted" }, include: { account: true }, orderBy: { createdAt: "asc" } }),
    db.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.requisition.findMany({ where: { decidedAt: dayRange(day) }, include: { decidedBy: true } }),
  ]);
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const byCategory = (rows, list) => {
    const map = new Map();
    for (const row of rows) map.set(row.category, round2((map.get(row.category) || 0) + Number(row.amount)));
    return [...map.entries()].map(([category, amount]) => ({ category: optionLabel(list, category), amount }));
  };
  const balances = [];
  for (const account of accountsList) {
    const sums = await db.transaction.groupBy({
      by: ["type"],
      where: { accountId: account.id, status: "posted", date: { lte: day } },
      _sum: { amount: true },
    });
    const total = (type) => Number(sums.find((s) => s.type === type)?._sum.amount || 0);
    balances.push({ account: account.name, type: optionLabel("accountTypes", account.accountType), balance: round2(Number(account.openingBalance) + total("income") - total("expense")) });
  }
  const totalIncome = sum(income, "amount");
  const totalExpenses = sum(expenses, "amount");
  const entry = (t) => ({ reference: t.reference, category: optionLabel(t.type === "income" ? "incomeCategories" : "expenseCategories", t.category), description: t.description, party: t.party || "", account: t.account.name, amount: Number(t.amount) });
  const entryColumns = [col("reference", "Ref"), col("category", "Category"), col("description", "Description"), col("party", "Paid to / from"), col("account", "Account"), col("amount", "Amount", "money")];
  return {
    title: "Accounts",
    summary: [
      { label: "Income", value: totalIncome, type: "money" },
      { label: "Expenses", value: totalExpenses, type: "money" },
      { label: "Net", value: round2(totalIncome - totalExpenses), type: "money" },
      { label: "Requisitions decided", value: requisitions.length },
    ],
    sections: [
      section("Income by category", [col("category", "Category"), col("amount", "Amount", "money")], byCategory(income, "incomeCategories"), ["amount"]),
      section("Expenses by category", [col("category", "Category"), col("amount", "Amount", "money")], byCategory(expenses, "expenseCategories"), ["amount"]),
      section("Income entries", entryColumns, income.map(entry), ["amount"]),
      section("Expense entries", entryColumns, expenses.map(entry), ["amount"]),
      section("Account balances at end of day", [col("account", "Account"), col("type", "Type"), col("balance", "Balance", "money")], balances, ["balance"]),
      section("Requisitions decided", [col("number", "Requisition"), col("department", "Department"), col("title", "Title"), col("status", "Decision"), col("by", "By"), col("amount", "Estimated", "money")],
        requisitions.map((r) => ({ number: r.requisitionNumber, department: optionLabel("departments", r.department), title: r.title, status: optionLabel("requisitionStatus", r.status), by: r.decidedBy?.name || "", amount: Number(r.totalAmount) }))),
    ],
  };
};

export const BUILDERS = { hr, livestock, mva, sales, stores, crops, accounts };
