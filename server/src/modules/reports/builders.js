import { optionLabel, optionValues } from "../../config/catalog.js";
import { bucketsOf, dayText } from "../../lib/periods.js";
import { stockSummary } from "../../lib/stock.js";
import { round2 } from "../../lib/validate.js";

// Department reports for any period (see lib/periods.js): a day, a week, two
// weeks, a month, a quarter, a half year, a year or a custom range.
//
// Each builder returns:
//   { title, summary: [{ label, value, type? }], sections: [{ title, columns, rows, totals? }] }
// columns: [{ key, label, type? ("number" | "money" | "date" | "percent"), weight? }]
//
// Periods of up to about two months list every record. Longer ones list
// totals per month (and per item, vehicle or category) instead, so a yearly
// report stays readable. Any period longer than a day gets a breakdown table,
// by day or by month.

const DAY_MS = 86400000;
const sum = (rows, key) => round2(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
const name = (person) => (person ? `${person.firstName} ${person.lastName}` : "");
const col = (key, label, type) => ({ key, label, ...(type ? { type } : {}) });
const within = (range) => ({ gte: range.from, lt: range.to });
const listsEachRecord = (range) => range.bucket === "day";

const section = (title, columns, rows, totalKeys = []) => ({
  title,
  columns,
  rows,
  ...(totalKeys.length && rows.length ? { totals: Object.fromEntries(totalKeys.map((key) => [key, sum(rows, key)])) } : {}),
});

/**
 * Breakdown of the period, one row per day (or per month on long periods).
 * sources: { name: { rows, date } } - the records and their date field.
 * values(recordsInRow) returns that row's figures.
 */
const breakdown = (range, title, columns, sources, values, totalKeys) => {
  if (range.days <= 1) return null;
  const byDay = range.bucket === "day";
  const rows = bucketsOf(range).map((bucket) => {
    const inBucket = Object.fromEntries(Object.entries(sources).map(([key, { rows: list, date }]) => [
      key,
      list.filter((row) => row[date] >= bucket.from && row[date] < bucket.to),
    ]));
    return { period: byDay ? bucket.from : bucket.label, ...values(inBucket) };
  });
  return section(`${title} by ${byDay ? "day" : "month"}`, [col("period", byDay ? "Date" : "Month", byDay ? "date" : undefined), ...columns], rows, totalKeys);
};

// ---------------------------------------------------------------------
const hr = async (db, range) => {
  const span = within(range);
  const [hires, contracts, reviews, cases, terminations, members, headcount, expiring] = await Promise.all([
    db.employee.findMany({ where: { dateHired: span }, orderBy: { dateHired: "asc" } }),
    db.contract.findMany({ where: { startDate: span }, include: { employee: true }, orderBy: { startDate: "asc" } }),
    db.salaryReview.findMany({ where: { effectiveDate: span }, include: { employee: true }, orderBy: { effectiveDate: "asc" } }),
    db.disciplinaryCase.findMany({ where: { incidentDate: span }, include: { employee: true }, orderBy: { incidentDate: "asc" } }),
    db.termination.findMany({ where: { terminationDate: span }, include: { employee: true }, orderBy: { terminationDate: "asc" } }),
    db.member.findMany({ where: { OR: [{ joinDate: span }, { successionDate: span }] }, include: { predecessor: true } }),
    db.employee.groupBy({ by: ["department"], where: { status: "active" }, _count: true }),
    db.contract.count({ where: { status: "active", endDate: { gte: range.asAt, lt: new Date(range.asAt.getTime() + 30 * DAY_MS) } } }),
  ]);
  const activeStaff = headcount.reduce((total, row) => total + row._count, 0);
  return {
    title: "HR",
    summary: [
      { label: "Active staff", value: activeStaff },
      { label: "New hires", value: hires.length },
      { label: "Disciplinary cases", value: cases.length },
      { label: "Terminations", value: terminations.length },
      { label: "Members registered / succeeded", value: members.length },
      { label: "Contracts ending in 30 days", value: expiring },
    ],
    sections: [
      section("Headcount by department", [col("department", "Department"), col("staff", "Active staff", "number")],
        headcount.map((row) => ({ department: optionLabel("departments", row.department), staff: row._count })), ["staff"]),
      section("New staff", [col("date", "Hired", "date"), col("staffNumber", "Staff no."), col("name", "Name"), col("department", "Department"), col("jobTitle", "Job title"), col("basicSalary", "Salary", "money")],
        hires.map((e) => ({ date: e.dateHired, staffNumber: e.staffNumber, name: name(e), department: optionLabel("departments", e.department), jobTitle: e.jobTitle, basicSalary: Number(e.basicSalary) }))),
      section("Contracts starting", [col("date", "Starts", "date"), col("contractNumber", "Contract"), col("employee", "Staff"), col("type", "Type"), col("endDate", "Ends", "date"), col("salary", "Salary", "money")],
        contracts.map((c) => ({ date: c.startDate, contractNumber: c.contractNumber, employee: name(c.employee), type: optionLabel("contractTypes", c.contractType), endDate: c.endDate, salary: Number(c.salary) }))),
      section("Salary reviews and promotions", [col("date", "Effective", "date"), col("employee", "Staff"), col("type", "Type"), col("from", "Previous", "money"), col("to", "New", "money"), col("title", "New title")],
        reviews.map((r) => ({ date: r.effectiveDate, employee: name(r.employee), type: optionLabel("salaryReviewTypes", r.reviewType), from: Number(r.previousSalary), to: Number(r.newSalary), title: r.newJobTitle }))),
      section("Disciplinary cases", [col("date", "Date", "date"), col("caseNumber", "Case"), col("employee", "Staff"), col("offence", "Offence"), col("action", "Action"), col("letter", "Letter served")],
        cases.map((c) => ({ date: c.incidentDate, caseNumber: c.caseNumber, employee: name(c.employee), offence: c.offence, action: optionLabel("disciplinaryActions", c.actionTaken), letter: c.letterServed ? "Yes" : "No" }))),
      section("Terminations", [col("date", "Date", "date"), col("employee", "Staff"), col("type", "Type"), col("reason", "Reason"), col("finalDues", "Final dues", "money")],
        terminations.map((t) => ({ date: t.terminationDate, employee: name(t.employee), type: optionLabel("terminationTypes", t.terminationType), reason: t.reason, finalDues: Number(t.finalDues) })), ["finalDues"]),
      section("Members registered / succeeded", [col("memberNumber", "Member no."), col("name", "Name"), col("successorOf", "Successor of"), col("relationship", "Relationship")],
        members.map((m) => ({ memberNumber: m.memberNumber, name: name(m), successorOf: m.predecessor ? `${m.predecessor.memberNumber} ${name(m.predecessor)}` : "Pioneer", relationship: m.relationship || "" }))),
    ],
  };
};

// ---------------------------------------------------------------------
const livestock = async (db, range) => {
  const span = within(range);
  const [milk, transfers, lactations, vaccinations, health, herd] = await Promise.all([
    db.milkRecord.findMany({ where: { date: span }, include: { animal: true }, orderBy: [{ date: "asc" }, { animal: { tagNumber: "asc" } }] }),
    db.milkTransfer.findMany({ where: { date: span }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.lactation.findMany({ where: { calvingDate: span }, include: { animal: true }, orderBy: { calvingDate: "asc" } }),
    db.vaccination.findMany({ where: { date: span }, include: { animal: true }, orderBy: { date: "asc" } }),
    db.healthRecord.findMany({ where: { date: span }, include: { animal: true }, orderBy: { date: "asc" } }),
    db.animal.groupBy({ by: ["sex"], where: { status: "active" }, _count: true }),
  ]);
  const sessions = ["morning", "midday", "evening"];
  const bySession = sessions.map((session) => {
    const records = milk.filter((m) => m.session === session);
    return {
      session: optionLabel("milkSessions", session),
      cows: new Set(records.map((m) => m.animalId)).size,
      litres: sum(records, "litres"),
      sent: sum(transfers.filter((t) => t.session === session), "litres"),
    };
  }).filter((row) => row.cows || row.sent);
  const perCow = new Map();
  for (const record of milk) {
    const entry = perCow.get(record.animalId) || { tag: record.animal.tagNumber, name: record.animal.name || "", morning: 0, midday: 0, evening: 0, total: 0 };
    entry[record.session] = round2(entry[record.session] + Number(record.litres));
    entry.total = round2(entry.total + Number(record.litres));
    perCow.set(record.animalId, entry);
  }
  const totalMilk = sum(milk, "litres");
  const totalSent = sum(transfers, "litres");
  const calvings = await Promise.all(lactations.map(async (l) => {
    const calf = l.calfId ? await db.animal.findUnique({ where: { id: l.calfId } }) : null;
    return { date: l.calvingDate, dam: `${l.animal.tagNumber} ${l.animal.name || ""}`.trim(), lactation: l.lactationNumber, calf: calf ? `${calf.tagNumber} (${calf.sex})` : "", sire: calf?.sireDetails || "" };
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
      section("Milk by session", [col("session", "Session"), col("cows", "Cows milked", "number"), col("litres", "Litres", "number"), col("sent", "Sent to MVA", "number")], bySession, ["litres", "sent"]),
      breakdown(range, "Milk", [col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("total", "Total", "number"), col("sent", "Sent to MVA", "number")],
        { milk: { rows: milk, date: "date" }, sent: { rows: transfers, date: "date" } },
        ({ milk: records, sent }) => ({
          ...Object.fromEntries(sessions.map((s) => [s, sum(records.filter((m) => m.session === s), "litres")])),
          total: sum(records, "litres"),
          sent: sum(sent, "litres"),
        }), ["morning", "midday", "evening", "total", "sent"]),
      section("Milk per cow", [col("tag", "Tag"), col("name", "Name"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("total", "Total", "number")],
        [...perCow.values()], ["morning", "midday", "evening", "total"]),
      listsEachRecord(range) && section("Transfers to MVA", [col("date", "Date", "date"), col("transferNumber", "Transfer"), col("session", "Session"), col("litres", "Litres sent", "number"), col("received", "Received by MVA", "number"), col("status", "Status")],
        transfers.map((t) => ({ date: t.date, transferNumber: t.transferNumber, session: optionLabel("milkSessions", t.session), litres: Number(t.litres), received: t.receivedLitres == null ? "" : Number(t.receivedLitres), status: optionLabel("transferStatus", t.status) })), ["litres"]),
      section("Calvings", [col("date", "Date", "date"), col("dam", "Mother"), col("lactation", "Lactation no.", "number"), col("calf", "Calf"), col("sire", "Sire details")], calvings),
      section("Vaccinations", [col("date", "Date", "date"), col("animal", "Animal"), col("vaccine", "Vaccine"), col("dose", "Dose"), col("nextDue", "Next due", "date")],
        vaccinations.map((v) => ({ date: v.date, animal: v.animal.tagNumber, vaccine: v.vaccine, dose: v.dose || "", nextDue: v.nextDueDate }))),
      section("Disease and herd health", [col("date", "Date", "date"), col("animal", "Animal"), col("type", "Type"), col("condition", "Condition"), col("treatment", "Treatment"), col("outcome", "Outcome"), col("cost", "Cost", "money")],
        health.map((h) => ({ date: h.date, animal: h.animal?.tagNumber || "Whole herd", type: optionLabel("healthRecordTypes", h.recordType), condition: h.condition, treatment: h.treatment || "", outcome: optionLabel("healthOutcomes", h.outcome), cost: Number(h.cost) })), ["cost"]),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
const mva = async (db, range) => {
  const span = within(range);
  const [transfers, deliveries, batches, outgoing, stock] = await Promise.all([
    db.milkTransfer.findMany({ where: { date: span, status: "received" }, orderBy: { date: "asc" } }),
    db.milkDelivery.findMany({ where: { date: span }, include: { supplier: true }, orderBy: [{ date: "asc" }, { supplier: { supplierNumber: "asc" } }] }),
    db.processingBatch.findMany({ where: { date: span }, include: { outputs: { include: { product: true } } }, orderBy: { date: "asc" } }),
    db.productTransfer.findMany({ where: { date: span }, include: { items: { include: { product: true } } } }),
    stockSummary(db, "mva", { upTo: range.asAt }),
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
      breakdown(range, "Milk received and processed", [col("farmers", "From farmers (litres)", "number"), col("livestock", "From Livestock (litres)", "number"), col("processed", "Processed (litres)", "number"), col("value", "Farmer milk value", "money")],
        { deliveries: { rows: deliveries, date: "date" }, transfers: { rows: transfers, date: "date" }, batches: { rows: batches, date: "date" } },
        (r) => ({ farmers: sum(r.deliveries, "litres"), livestock: sum(r.transfers, "receivedLitres"), processed: sum(r.batches, "rawMilkInput"), value: sum(r.deliveries, "amount") }),
        ["farmers", "livestock", "processed", "value"]),
      section("Farmer deliveries", [col("number", "No."), col("farmer", "Farmer"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("litres", "Litres", "number"), col("amount", "Value", "money")],
        [...perFarmer.values()], ["morning", "midday", "evening", "litres", "amount"]),
      listsEachRecord(range) && section("Received from Livestock", [col("date", "Date", "date"), col("transferNumber", "Transfer"), col("session", "Session"), col("sent", "Sent", "number"), col("received", "Received", "number")],
        transfers.map((t) => ({ date: t.date, transferNumber: t.transferNumber, session: optionLabel("milkSessions", t.session), sent: Number(t.litres), received: Number(t.receivedLitres) })), ["sent", "received"]),
      listsEachRecord(range) && section("Processing batches", [col("date", "Date", "date"), col("batchNumber", "Batch"), col("input", "Raw milk in", "number"), col("outputs", "Products made")],
        batches.map((b) => ({ date: b.date, batchNumber: b.batchNumber, input: Number(b.rawMilkInput), outputs: b.outputs.map((o) => `${o.product.name} ${Number(o.quantity)}`).join(", ") })), ["input"]),
      section("Products made and sent to Sales", [col("product", "Product"), col("made", "Made", "number"), col("sent", "Sent to Sales", "number")],
        [...new Set([...outputs.keys(), ...sent.keys()])].map((product) => ({ product, made: outputs.get(product) || 0, sent: sent.get(product) || 0 }))),
      section(`MVA stock at ${dayText(range.asAt)}`, [col("name", "Product"), col("unit", "Unit"), col("onHand", "On hand", "number")], stock),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
const sales = async (db, range) => {
  const span = within(range);
  const [received, localSales, dispatches, damages, payments, stock] = await Promise.all([
    db.productTransfer.findMany({ where: { date: span, status: "received" }, include: { items: { include: { product: true } } } }),
    db.sale.findMany({ where: { date: span }, include: { items: { include: { product: true } }, customer: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.vehicleDispatch.findMany({ where: { date: span }, include: { vehicle: true, items: { include: { product: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.damageReplacement.findMany({ where: { date: span }, include: { product: true, customer: true }, orderBy: { date: "asc" } }),
    db.salePayment.findMany({ where: { date: span }, include: { sale: true } }),
    stockSummary(db, "sales", { upTo: range.asAt }),
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
  const handedIn = (rows) => round2(sum(rows, "cashReturned") + sum(rows, "mpesaReturned"));
  const localTotal = sum(localSales, "totalAmount");
  const vehicleExpected = sum(reconciled, "expectedAmount");
  const vehicleCollected = handedIn(reconciled);
  const collectedLocal = sum(payments, "amount");

  const perVehicle = new Map();
  for (const d of reconciled) {
    const entry = perVehicle.get(d.vehicleId) || { vehicle: d.vehicle.registrationNumber, trips: 0, expected: 0, handedIn: 0, variance: 0 };
    entry.trips += 1;
    entry.expected = round2(entry.expected + Number(d.expectedAmount));
    entry.handedIn = round2(entry.handedIn + Number(d.cashReturned) + Number(d.mpesaReturned));
    entry.variance = round2(entry.variance + Number(d.variance));
    perVehicle.set(d.vehicleId, entry);
  }

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
      breakdown(range, "Sales", [col("local", "Local sales", "money"), col("collected", "Collected at counter", "money"), col("expected", "Vehicle sales (expected)", "money"), col("handedIn", "Vehicle money handed in", "money")],
        { sales: { rows: localSales, date: "date" }, payments: { rows: payments, date: "date" }, vehicles: { rows: reconciled, date: "date" } },
        (r) => ({ local: sum(r.sales, "totalAmount"), collected: sum(r.payments, "amount"), expected: sum(r.vehicles, "expectedAmount"), handedIn: handedIn(r.vehicles) }),
        ["local", "collected", "expected", "handedIn"]),
      section("Product movement", [col("product", "Product"), col("received", "From MVA", "number"), col("local", "Local sales", "number"), col("dispatched", "To vehicles", "number"), col("returned", "Returned", "number"), col("vehicleSold", "Sold by vehicles", "number"), col("damaged", "Damaged / replaced", "number")],
        [...products.values()]),
      listsEachRecord(range)
        ? section("Vehicles", [col("date", "Date", "date"), col("dispatchNumber", "Dispatch"), col("vehicle", "Vehicle"), col("crew", "Crew"), col("status", "Status"), col("expected", "Expected", "money"), col("handedIn", "Handed in", "money"), col("variance", "Variance", "money")],
          dispatches.map((d) => ({
            date: d.date,
            dispatchNumber: d.dispatchNumber,
            vehicle: d.vehicle.registrationNumber,
            crew: `${d.driverName} / ${d.salesPersonName}`,
            status: optionLabel("dispatchStatus", d.status),
            expected: Number(d.expectedAmount),
            handedIn: round2(Number(d.cashReturned) + Number(d.mpesaReturned)),
            variance: Number(d.variance),
          })), ["expected", "handedIn", "variance"])
        : section("Vehicles", [col("vehicle", "Vehicle"), col("trips", "Trips reconciled", "number"), col("expected", "Expected", "money"), col("handedIn", "Handed in", "money"), col("variance", "Variance", "money")],
          [...perVehicle.values()], ["trips", "expected", "handedIn", "variance"]),
      listsEachRecord(range) && section("Local sales", [col("date", "Date", "date"), col("saleNumber", "Sale"), col("customer", "Customer"), col("items", "Items"), col("method", "Payment"), col("total", "Total", "money"), col("paid", "Paid", "money")],
        localSales.map((s) => ({
          date: s.date,
          saleNumber: s.saleNumber,
          customer: s.customer?.name || s.customerName || "Walk-in",
          items: s.items.map((i) => `${i.product.name} ${Number(i.quantity)}`).join(", "),
          method: optionLabel("paymentMethods", s.paymentMethod),
          total: Number(s.totalAmount),
          paid: Number(s.amountPaid),
        })), ["total", "paid"]),
      section("Damages and replacements", [col("date", "Date", "date"), col("recordNumber", "Record"), col("type", "Type"), col("product", "Product"), col("quantity", "Qty", "number"), col("customer", "Customer"), col("reason", "Reason"), col("value", "Value", "money")],
        damages.map((d) => ({ date: d.date, recordNumber: d.recordNumber, type: optionLabel("damageTypes", d.recordType), product: d.product.name, quantity: Number(d.quantity), customer: d.customer?.name || d.customerName || "", reason: d.reason, value: Number(d.value) })), ["value"]),
      section(`Sales stock at ${dayText(range.asAt)}`, [col("name", "Product"), col("unit", "Unit"), col("onHand", "On hand", "number"), col("unitPrice", "Price", "money")], stock),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
const stores = async (db, range) => {
  const span = within(range);
  const [receipts, issues, items] = await Promise.all([
    db.storeReceipt.findMany({ where: { date: span }, include: { item: true, supplier: true }, orderBy: { date: "asc" } }),
    db.storeIssue.findMany({ where: { date: span }, include: { item: true, requisition: true }, orderBy: { date: "asc" } }),
    db.storeItem.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  const low = items.filter((i) => Number(i.quantityOnHand) <= Number(i.reorderLevel));
  const value = (r) => round2(Number(r.quantity) * Number(r.unitCost));
  const receivedValue = round2(receipts.reduce((t, r) => t + value(r), 0));

  // Long periods: totals per item instead of every delivery and issue.
  const totals = (rows, keyOf, start) => {
    const map = new Map();
    for (const row of rows) {
      const key = keyOf(row);
      const entry = map.get(key) || start(row);
      entry.quantity = round2(entry.quantity + Number(row.quantity));
      if (entry.value !== undefined) entry.value = round2(entry.value + value(row));
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.values()];
  };

  return {
    title: "Stores",
    summary: [
      { label: "Goods received (lines)", value: receipts.length },
      { label: "Value received", value: receivedValue, type: "money" },
      { label: "Issues to departments", value: issues.length },
      { label: "Items at or below reorder level", value: low.length },
    ],
    sections: [
      breakdown(range, "Stores movements", [col("receipts", "Goods received (lines)", "number"), col("value", "Value received", "money"), col("issues", "Issues to departments", "number")],
        { receipts: { rows: receipts, date: "date" }, issues: { rows: issues, date: "date" } },
        (r) => ({ receipts: r.receipts.length, value: round2(r.receipts.reduce((t, x) => t + value(x), 0)), issues: r.issues.length }),
        ["receipts", "value", "issues"]),
      listsEachRecord(range)
        ? section("Goods received", [col("date", "Date", "date"), col("receiptNumber", "GRN"), col("item", "Item"), col("category", "Category"), col("quantity", "Qty", "number"), col("source", "Source"), col("supplier", "Supplier"), col("value", "Value", "money")],
          receipts.map((r) => ({ date: r.date, receiptNumber: r.receiptNumber, item: r.item.name, category: optionLabel("storeCategories", r.item.category), quantity: Number(r.quantity), source: optionLabel("receiptSources", r.source), supplier: r.supplier?.name || "", value: value(r) })), ["value"])
        : section("Goods received by item", [col("item", "Item"), col("category", "Category"), col("count", "Deliveries", "number"), col("quantity", "Qty", "number"), col("value", "Value", "money")],
          totals(receipts, (r) => r.itemId, (r) => ({ item: `${r.item.name} (${r.item.unit})`, category: optionLabel("storeCategories", r.item.category), count: 0, quantity: 0, value: 0 })), ["value"]),
      listsEachRecord(range)
        ? section("Issued to departments", [col("date", "Date", "date"), col("issueNumber", "Issue"), col("department", "Department"), col("item", "Item"), col("quantity", "Qty", "number"), col("issuedTo", "Received by"), col("requisition", "Requisition")],
          issues.map((i) => ({ date: i.date, issueNumber: i.issueNumber, department: optionLabel("departments", i.department), item: `${i.item.name} (${i.item.unit})`, quantity: Number(i.quantity), issuedTo: i.issuedTo, requisition: i.requisition?.requisitionNumber || "" })))
        : section("Issued by department and item", [col("department", "Department"), col("item", "Item"), col("count", "Issues", "number"), col("quantity", "Qty", "number")],
          totals(issues, (i) => `${i.department}:${i.itemId}`, (i) => ({ department: optionLabel("departments", i.department), item: `${i.item.name} (${i.item.unit})`, count: 0, quantity: 0 }))),
      section("Low stock", [col("code", "Code"), col("name", "Item"), col("category", "Category"), col("onHand", "On hand", "number"), col("reorderLevel", "Reorder level", "number")],
        low.map((i) => ({ code: i.code, name: i.name, category: optionLabel("storeCategories", i.category), onHand: Number(i.quantityOnHand), reorderLevel: Number(i.reorderLevel) }))),
      section("Stock on hand", [col("code", "Code"), col("name", "Item"), col("category", "Category"), col("unit", "Unit"), col("onHand", "On hand", "number")],
        items.map((i) => ({ code: i.code, name: i.name, category: optionLabel("storeCategories", i.category), unit: i.unit, onHand: Number(i.quantityOnHand) }))),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
const crops = async (db, range) => {
  const span = within(range);
  const [harvests, statusLogs, farms] = await Promise.all([
    db.cropHarvest.findMany({ where: { harvestDate: span }, include: { farm: true }, orderBy: { harvestDate: "asc" } }),
    db.cropStatusLog.findMany({ where: { date: span }, include: { farm: true }, orderBy: { date: "asc" } }),
    db.cropFarm.findMany({ orderBy: [{ cropType: "asc" }, { farmNumber: "asc" }] }),
  ]);
  const byCrop = optionValues("cropTypes").map((crop) => {
    const list = farms.filter((f) => f.cropType === crop);
    return { crop: optionLabel("cropTypes", crop), farms: list.length, acreage: sum(list, "acreage") };
  });
  const harvestTotals = new Map();
  for (const h of harvests) {
    const key = `${h.farm.cropType}:${h.unit}`;
    const entry = harvestTotals.get(key) || { crop: optionLabel("cropTypes", h.farm.cropType), unit: optionLabel("harvestUnits", h.unit), records: 0, quantity: 0, amount: 0 };
    entry.records += 1;
    entry.quantity = round2(entry.quantity + Number(h.quantity));
    entry.amount = round2(entry.amount + Number(h.amount));
    harvestTotals.set(key, entry);
  }
  return {
    title: "Crops",
    summary: [
      { label: "Harvest records", value: harvests.length },
      { label: "Harvest value", value: sum(harvests, "amount"), type: "money" },
      { label: "Farm status updates", value: statusLogs.length },
      { label: "Total farms", value: farms.length },
      { label: "Total acreage", value: sum(farms, "acreage") },
    ],
    sections: [
      section("Farms by crop", [col("crop", "Crop"), col("farms", "Farms", "number"), col("acreage", "Acres", "number")], byCrop, ["farms", "acreage"]),
      section("Harvests by crop", [col("crop", "Crop"), col("unit", "Unit"), col("records", "Records", "number"), col("quantity", "Quantity", "number"), col("amount", "Value", "money")],
        [...harvestTotals.values()], ["records", "amount"]),
      listsEachRecord(range) && section("Harvests", [col("date", "Date", "date"), col("farm", "Farm"), col("crop", "Crop"), col("quantity", "Quantity", "number"), col("unit", "Unit"), col("buyer", "Buyer"), col("amount", "Value", "money")],
        harvests.map((h) => ({ date: h.harvestDate, farm: h.farm.farmNumber, crop: optionLabel("cropTypes", h.farm.cropType), quantity: Number(h.quantity), unit: h.unit, buyer: h.buyer || "", amount: Number(h.amount) })), ["amount"]),
      listsEachRecord(range) && section("Status updates", [col("date", "Date", "date"), col("farm", "Farm"), col("crop", "Crop"), col("status", "New status"), col("note", "Note")],
        statusLogs.map((s) => ({ date: s.date, farm: s.farm.farmNumber, crop: optionLabel("cropTypes", s.farm.cropType), status: optionLabel("farmStatus", s.status), note: s.note || "" }))),
      section("All farms", [col("farmNumber", "Farm no."), col("crop", "Crop"), col("location", "Location"), col("acreage", "Acres", "number"), col("ratoon", "Ratoon", "number"), col("status", "Status")],
        farms.map((f) => ({ farmNumber: f.farmNumber, crop: optionLabel("cropTypes", f.cropType), location: f.location, acreage: Number(f.acreage), ratoon: f.ratoonCount, status: optionLabel("farmStatus", f.status) }))),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
const accounts = async (db, range) => {
  const [transactions, accountsList, requisitions] = await Promise.all([
    db.transaction.findMany({ where: { date: within(range), status: "posted" }, include: { account: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.requisition.findMany({ where: { decidedAt: within(range) }, include: { decidedBy: true }, orderBy: { decidedAt: "asc" } }),
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
      where: { accountId: account.id, status: "posted", date: { lte: range.asAt } },
      _sum: { amount: true },
    });
    const total = (type) => Number(sums.find((s) => s.type === type)?._sum.amount || 0);
    balances.push({ account: account.name, type: optionLabel("accountTypes", account.accountType), balance: round2(Number(account.openingBalance) + total("income") - total("expense")) });
  }
  const totalIncome = sum(income, "amount");
  const totalExpenses = sum(expenses, "amount");
  const entry = (t) => ({ date: t.date, reference: t.reference, category: optionLabel(t.type === "income" ? "incomeCategories" : "expenseCategories", t.category), description: t.description, party: t.party || "", account: t.account.name, amount: Number(t.amount) });
  const entryColumns = [col("date", "Date", "date"), col("reference", "Ref"), col("category", "Category"), col("description", "Description"), col("party", "Paid to / from"), col("account", "Account"), col("amount", "Amount", "money")];
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
      breakdown(range, "Income and expenses", [col("income", "Income", "money"), col("expenses", "Expenses", "money"), col("net", "Net", "money")],
        { income: { rows: income, date: "date" }, expenses: { rows: expenses, date: "date" } },
        (r) => ({ income: sum(r.income, "amount"), expenses: sum(r.expenses, "amount"), net: round2(sum(r.income, "amount") - sum(r.expenses, "amount")) }),
        ["income", "expenses", "net"]),
      listsEachRecord(range) && section("Income entries", entryColumns, income.map(entry), ["amount"]),
      listsEachRecord(range) && section("Expense entries", entryColumns, expenses.map(entry), ["amount"]),
      section(`Account balances at ${dayText(range.asAt)}`, [col("account", "Account"), col("type", "Type"), col("balance", "Balance", "money")], balances, ["balance"]),
      section("Requisitions decided", [col("date", "Decided", "date"), col("number", "Requisition"), col("department", "Department"), col("title", "Title"), col("status", "Decision"), col("by", "By"), col("amount", "Estimated", "money")],
        requisitions.map((r) => ({ date: r.decidedAt, number: r.requisitionNumber, department: optionLabel("departments", r.department), title: r.title, status: optionLabel("requisitionStatus", r.status), by: r.decidedBy?.name || "", amount: Number(r.totalAmount) }))),
    ].filter(Boolean),
  };
};

export const BUILDERS = { hr, livestock, mva, sales, stores, crops, accounts };
