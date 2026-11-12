import { optionLabel, optionValues, REPORT_PARTS } from "../../config/catalog.js";
import { bucketsOf, dayText } from "../../lib/periods.js";
import { stockSummary } from "../../lib/stock.js";
import { round2 } from "../../lib/validate.js";
import { outputFigures, productionDays } from "../mva/production.js";

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

/** Marks a section (or a summary figure) as belonging to one of the department's parts (config/catalog.js REPORT_PARTS). */
const inPart = (part, item) => item && { ...item, part };

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
// MVA's production report, as on the department's sheet.
const productionRegister = (range, days) => {
  const destinations = optionValues("allocationDestinations");
  const keys = ["dairyA", "dairyC", "farmers", "total", ...destinations, "variance"];
  const rows = bucketsOf(range).flatMap((bucket) => {
    const inBucket = days.filter((day) => day.date >= bucket.from && day.date < bucket.to);
    return inBucket.length ? [{ date: bucket.label, ...Object.fromEntries(keys.map((key) => [key, sum(inBucket, key)])) }] : [];
  });
  return section("Production report", [
    dateColumn(range),
    col("dairyA", "Dairy A", "number"),
    col("dairyC", "Dairy C", "number"),
    col("farmers", "Farmers", "number"),
    col("total", "Total", "number"),
    ...destinations.map((destination) => col(destination, optionLabel("allocationDestinations", destination), "number")),
    col("variance", "Variance", "number"),
  ], rows, keys);
};

// MVA's product output, as on the department's sheet.
const OUTPUT_KEYS = ["malaKg", "malaLitres", "malaPieces", "malaVariance", "yoghurtKg", "yoghurtLitres", "yoghurt500", "yoghurt250", "yoghurt150", "yoghurtVariance", "fresh250"];
const outputRegister = (range, figures) => {
  const rows = bucketsOf(range).flatMap((bucket) => {
    const inBucket = figures.filter((row) => row.date >= bucket.from && row.date < bucket.to);
    return inBucket.length ? [{ date: bucket.label, ...Object.fromEntries(OUTPUT_KEYS.map((key) => [key, sum(inBucket, key)])) }] : [];
  });
  return section("Product output", [
    dateColumn(range),
    col("malaKg", "Mala processed (kg)", "number"),
    col("malaLitres", "Mala processed (L)", "number"),
    col("malaPieces", "Mala output (pcs)", "number"),
    col("malaVariance", "Mala variance (L)", "number"),
    col("yoghurtKg", "Yoghurt processed (kg)", "number"),
    col("yoghurtLitres", "Yoghurt processed (L)", "number"),
    col("yoghurt500", "Yog 500", "number"),
    col("yoghurt250", "Yog 250", "number"),
    col("yoghurt150", "Yog 150", "number"),
    col("yoghurtVariance", "Yoghurt variance (L)", "number"),
    col("fresh250", "Fresh 250 (pcs)", "number"),
  ], rows, OUTPUT_KEYS);
};

const mva = async (db, range) => {
  const span = within(range);
  const [days, transfers, deliveries, batches, outgoing, stock] = await Promise.all([
    productionDays(db, { date: span }),
    db.milkTransfer.findMany({ where: { date: span, status: "received" }, orderBy: { date: "asc" } }),
    db.milkDelivery.findMany({ where: { date: span }, include: { supplier: true }, orderBy: [{ date: "asc" }, { supplier: { supplierNumber: "asc" } }] }),
    db.processingBatch.findMany({ where: { date: span }, include: { outputs: { include: { product: true } } }, orderBy: { date: "asc" } }),
    db.productTransfer.findMany({ where: { date: span }, include: { items: { include: { product: true } } } }),
    stockSummary(db, "mva", { upTo: range.asAt }),
  ]);
  const figures = batches.map((batch) => ({ date: batch.date, ...outputFigures(batch) }));
  const fromLivestock = sum(transfers, "receivedLitres");
  const fromFarmers = sum(deliveries, "litres");
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
    parts: REPORT_PARTS.mva,
    summary: [
      inPart("production", { label: "Milk from Livestock (litres)", value: fromLivestock }),
      inPart("production", { label: "Milk from farmers (litres)", value: fromFarmers }),
      inPart("production", { label: "Farmers delivering", value: perFarmer.size }),
      inPart("production", { label: "Total intake", value: sum(days, "total") }),
      inPart("production", { label: "Milk allocated", value: sum(days, "allocated") }),
      inPart("production", { label: "Production variance (L)", value: sum(days, "variance") }),
      inPart("output", { label: "Product output variance (L)", value: round2(sum(figures, "malaVariance") + sum(figures, "yoghurtVariance")) }),
      { label: "Transfers to Sales", value: outgoing.length },
      { label: "Farmer milk value", value: sum(deliveries, "amount"), type: "money" },
    ],
    sections: [
      inPart("production", productionRegister(range, days)),
      inPart("output", outputRegister(range, figures)),
      section("Farmer deliveries", [col("number", "No."), col("farmer", "Farmer"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("litres", "Litres", "number"), col("amount", "Value", "money")],
        [...perFarmer.values()], ["morning", "midday", "evening", "litres", "amount"]),
      listsEachRecord(range) && section("Received from Livestock", [col("date", "Date", "date"), col("transferNumber", "Transfer"), col("dairy", "Dairy"), col("session", "Session"), col("sent", "Sent", "number"), col("received", "Received", "number")],
        transfers.map((t) => ({ date: t.date, transferNumber: t.transferNumber, dairy: optionLabel("dairies", t.dairy), session: optionLabel("milkSessions", t.session), sent: Number(t.litres), received: Number(t.receivedLitres) })), ["sent", "received"]),
      section("Products made and sent to Sales", [col("product", "Product"), col("made", "Made", "number"), col("sent", "Sent to Sales", "number")],
        [...new Set([...outputs.keys(), ...sent.keys()])].map((product) => ({ product, made: outputs.get(product) || 0, sent: sent.get(product) || 0 }))),
      section(`MVA stock at ${dayText(range.asAt)}`, [col("name", "Product"), col("unit", "Unit"), col("onHand", "On hand", "number")], stock),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
// Products always on the local sales register, in the order of the paper sheet.
const LOCAL_SHEET = ["MALA", "RAW_MILK", "YOGHURT_500", "YOGHURT_250", "YOGHURT_150"];

// The Store column each kind of stock movement belongs to. Stock going out
// reads as a positive quantity in its column. Anything else (a count
// adjustment) has its own column, shown only when there is one.
const STORE_COLUMN = {
  received_from_mva: ["production", 1],
  vehicle_dispatch: ["packed", -1],
  dispatch_cancelled: ["packed", -1],
  local_sale: ["local", -1],
  sale_reversal: ["local", -1],
  office: ["office", -1],
  damage: ["damages", -1],
  replacement: ["damages", -1],
  vehicle_return: ["returned", 1],
};
const STORE_FLOWS = ["production", "packed", "local", "office", "damages", "returned", "adjusted"];

const dateColumn = (range) => col("date", range.bucket === "day" ? "Date" : "Month");

/** The Vehicles register: what each product did on the road, per day. */
const vehicleRegister = (range, dispatches) => {
  const rows = bucketsOf(range).flatMap((bucket) => {
    const byProduct = new Map();
    for (const dispatch of dispatches.filter((d) => d.date >= bucket.from && d.date < bucket.to)) {
      for (const item of dispatch.items) {
        const entry = byProduct.get(item.productId) || { date: bucket.label, product: item.product.name, dispatched: 0, replaced: 0, returned: 0, damaged: 0, sold: 0, amount: 0 };
        entry.dispatched = round2(entry.dispatched + Number(item.quantityDispatched));
        entry.replaced = round2(entry.replaced + Number(item.quantityReplaced));
        entry.returned = round2(entry.returned + Number(item.quantityReturned));
        entry.damaged = round2(entry.damaged + Number(item.quantityDamaged));
        entry.sold = round2(entry.sold + Number(item.quantitySold));
        entry.amount = round2(entry.amount + Number(item.quantitySold) * Number(item.unitPrice));
        byProduct.set(item.productId, entry);
      }
    }
    return [...byProduct.values()];
  });
  return section("Vehicles", [dateColumn(range), col("product", "Product"), col("dispatched", "Dispatch", "number"), col("replaced", "Replacement", "number"), col("returned", "Returns", "number"), col("damaged", "Damages", "number"), col("sold", "Day sales", "number"), col("amount", "Amount", "money")], rows, ["amount"]);
};

/**
 * The Store register, worked out from the stock ledger so that opening plus
 * what came in less what went out always equals closing. For longer periods
 * only days with movement are listed, followed by a total for each product.
 */
const storeRegister = (range, products, movements) => {
  const flow = (rows) => {
    const totals = Object.fromEntries(STORE_FLOWS.map((key) => [key, 0]));
    for (const row of rows) {
      const [key, sign] = STORE_COLUMN[row.movementType] || ["adjusted", 1];
      totals[key] = round2(totals[key] + sign * Number(row._sum.quantity || 0));
    }
    return totals;
  };
  const net = (rows) => round2(rows.reduce((total, row) => total + Number(row._sum.quantity || 0), 0));
  const forProduct = (product) => movements.filter((row) => row.productId === product.id);
  const openings = new Map(products.map((product) => [product.id, net(forProduct(product).filter((row) => row.date < range.from))]));

  const balance = new Map(openings);
  const rows = bucketsOf(range).flatMap((bucket) => products.flatMap((product) => {
    const moved = forProduct(product).filter((row) => row.date >= bucket.from && row.date < bucket.to);
    const opening = balance.get(product.id);
    const closing = round2(opening + net(moved));
    balance.set(product.id, closing);
    const show = moved.length > 0 || (range.days === 1 && (product.isActive || opening !== 0));
    return show ? [{ date: bucket.label, product: product.name, opening, ...flow(moved), closing }] : [];
  }));

  const hasAdjustments = movements.some((row) => row.date >= range.from && !STORE_COLUMN[row.movementType]);
  const columns = (first) => [
    ...first,
    col("product", "Product"),
    col("production", "Production", "number"),
    col("opening", "Opening Stock", "number"),
    col("packed", "Packed", "number"),
    col("local", "Local sales", "number"),
    col("office", "Office", "number"),
    col("damages", "Damages & replacements", "number"),
    col("returned", "Return", "number"),
    ...(hasAdjustments ? [col("adjusted", "Count adjustment", "number")] : []),
    col("closing", "Closing stock", "number"),
  ];

  const totals = range.days > 1 && section("Store totals for the period", columns([]), products.flatMap((product) => {
    const moved = forProduct(product).filter((row) => row.date >= range.from);
    const opening = openings.get(product.id);
    const closing = round2(opening + net(moved));
    return product.isActive || opening !== 0 || moved.length ? [{ product: product.name, opening, ...flow(moved), closing }] : [];
  }));
  return [section("Store", columns([dateColumn(range)]), rows), totals];
};

/** The Local sales register: one line per sale, or per month on long periods. */
const localRegister = (range, localSales, products) => {
  const sold = new Set(localSales.flatMap((sale) => sale.items.map((item) => item.product.code)));
  const known = new Map(products.map((product) => [product.code, product]));
  const codes = [...LOCAL_SHEET.filter((code) => known.has(code)), ...products.filter((p) => sold.has(p.code) && !LOCAL_SHEET.includes(p.code)).map((p) => p.code)];
  const columns = codes.map((code) => col(code, known.get(code).name, "number"));
  const quantities = (items) => Object.fromEntries(codes.map((code) => [code, round2(items.filter((item) => item.product.code === code).reduce((total, item) => total + Number(item.quantity), 0)) || ""]));
  if (listsEachRecord(range)) {
    return section("Local sales", [col("date", "Date", "date"), ...columns, col("amount", "Amount", "money"), col("reference", "Ref. Number")],
      localSales.map((sale) => ({ date: sale.date, ...quantities(sale.items), amount: Number(sale.totalAmount), reference: sale.reference || sale.saleNumber })),
      [...codes, "amount"]);
  }
  const rows = bucketsOf(range).map((bucket) => {
    const inBucket = localSales.filter((sale) => sale.date >= bucket.from && sale.date < bucket.to);
    return { date: bucket.label, ...quantities(inBucket.flatMap((sale) => sale.items)), amount: sum(inBucket, "totalAmount") };
  });
  return section("Local sales by month", [col("date", "Month"), ...columns, col("amount", "Amount", "money")], rows, [...codes, "amount"]);
};

const sales = async (db, range) => {
  const span = within(range);
  const [localSales, dispatches, records, payments, products, movements] = await Promise.all([
    db.sale.findMany({ where: { date: span }, include: { items: { include: { product: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.vehicleDispatch.findMany({ where: { date: span }, include: { vehicle: true, items: { include: { product: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.damageReplacement.findMany({ where: { date: span }, include: { product: true, dispatch: { include: { vehicle: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.salePayment.findMany({ where: { date: span }, include: { sale: true } }),
    db.product.findMany({ orderBy: { name: "asc" } }),
    db.stockMovement.groupBy({ by: ["productId", "date", "movementType"], where: { location: "sales", date: { lt: range.to } }, _sum: { quantity: true } }),
  ]);

  const reconciled = dispatches.filter((d) => d.status === "reconciled");
  // Money a crew hands in: cash, M-Pesa and bank deposits.
  const moneyIn = (d) => round2(Number(d.cashReturned) + Number(d.mpesaReturned) + Number(d.bankDeposit));
  const handedIn = (rows) => round2(rows.reduce((total, d) => total + moneyIn(d), 0));
  const localTotal = sum(localSales, "totalAmount");
  const vehicleExpected = sum(reconciled, "expectedAmount");
  const vehicleCollected = handedIn(reconciled);
  const collectedLocal = sum(payments, "amount");
  const losses = records.filter((r) => ["damage", "replacement"].includes(r.recordType));

  const perVehicle = new Map();
  for (const d of reconciled) {
    const entry = perVehicle.get(d.vehicleId) || { vehicle: d.vehicle.registrationNumber, trips: 0, expected: 0, bank: 0, handedIn: 0, variance: 0 };
    entry.bank = round2(entry.bank + Number(d.bankDeposit));
    entry.trips += 1;
    entry.expected = round2(entry.expected + Number(d.expectedAmount));
    entry.handedIn = round2(entry.handedIn + moneyIn(d));
    entry.variance = round2(entry.variance + Number(d.variance));
    perVehicle.set(d.vehicleId, entry);
  }

  return {
    title: "Sales",
    parts: REPORT_PARTS.sales,
    summary: [
      inPart("local", { label: "Local sales", value: localTotal, type: "money" }),
      inPart("local", { label: "Collected at counter", value: collectedLocal, type: "money" }),
      inPart("vehicles", { label: "Vehicle sales (expected)", value: vehicleExpected, type: "money" }),
      inPart("vehicles", { label: "Vehicle money handed in (cash, M-Pesa, bank)", value: vehicleCollected, type: "money" }),
      inPart("vehicles", { label: "Of which banked", value: sum(reconciled, "bankDeposit"), type: "money" }),
      inPart("vehicles", { label: "Vehicle shortage / excess", value: round2(vehicleCollected - vehicleExpected), type: "money" }),
      inPart("vehicles", { label: "Vehicles not yet reconciled", value: dispatches.length - reconciled.length }),
      inPart("store", { label: "Damage / replacement value", value: sum(losses, "value"), type: "money" }),
    ],
    sections: [
      inPart("vehicles", vehicleRegister(range, dispatches)),
      ...storeRegister(range, products, movements).map((s) => inPart("store", s)),
      inPart("local", localRegister(range, localSales, products)),
      breakdown(range, "Sales", [col("local", "Local sales", "money"), col("collected", "Collected at counter", "money"), col("expected", "Vehicle sales (expected)", "money"), col("handedIn", "Vehicle money handed in", "money")],
        { sales: { rows: localSales, date: "date" }, payments: { rows: payments, date: "date" }, vehicles: { rows: reconciled, date: "date" } },
        (r) => ({ local: sum(r.sales, "totalAmount"), collected: sum(r.payments, "amount"), expected: sum(r.vehicles, "expectedAmount"), handedIn: handedIn(r.vehicles) }),
        ["local", "collected", "expected", "handedIn"]),
      inPart("vehicles", listsEachRecord(range)
        ? section("Vehicle trips and money", [col("date", "Date", "date"), col("dispatchNumber", "Dispatch"), col("vehicle", "Vehicle"), col("crew", "Crew"), col("status", "Status"), col("expected", "Expected", "money"), col("cash", "Cash", "money"), col("mpesa", "M-Pesa", "money"), col("bank", "Bank deposit", "money"), col("handedIn", "Handed in", "money"), col("variance", "Variance", "money")],
          dispatches.map((d) => ({
            date: d.date,
            dispatchNumber: d.dispatchNumber,
            vehicle: d.vehicle.registrationNumber,
            crew: `${d.driverName} / ${d.salesPersonName}`,
            status: optionLabel("dispatchStatus", d.status),
            expected: Number(d.expectedAmount),
            cash: Number(d.cashReturned),
            mpesa: Number(d.mpesaReturned),
            bank: Number(d.bankDeposit),
            handedIn: moneyIn(d),
            variance: Number(d.variance),
          })), ["expected", "cash", "mpesa", "bank", "handedIn", "variance"])
        : section("Vehicle trips and money", [col("vehicle", "Vehicle"), col("trips", "Trips reconciled", "number"), col("expected", "Expected", "money"), col("bank", "Banked", "money"), col("handedIn", "Handed in", "money"), col("variance", "Variance", "money")],
          [...perVehicle.values()], ["trips", "expected", "bank", "handedIn", "variance"])),
      section("Damages, replacements, returns and office use", [col("date", "Date", "date"), col("recordNumber", "Record"), col("type", "Type"), col("where", "Where"), col("product", "Product"), col("quantity", "Qty", "number"), col("customer", "Customer"), col("reason", "Reason"), col("value", "Value", "money")],
        records.map((r) => ({
          date: r.date,
          recordNumber: r.recordNumber,
          type: optionLabel("damageTypes", r.recordType),
          where: r.dispatch ? r.dispatch.vehicle.registrationNumber : "Store",
          product: r.product.name,
          quantity: Number(r.quantity),
          customer: r.customerName || "",
          reason: r.reason || "",
          value: ["damage", "replacement"].includes(r.recordType) ? Number(r.value) : "",
        })), ["value"]),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
// Stores: stock out, goods received and stock remaining, which print together
// or one at a time (?part=out|received|stock). Quantities only - no costs.

/**
 * Each item's stock over the period: opening (what it held when the period
 * began, plus its opening quantity if it was added during the period), what
 * came in and went out, and what remains. Items added after the period, and
 * retired items with nothing to show, are left out.
 */
const storeStock = (range, items, receipts, issues, receivedBefore, issuedBefore) => {
  const before = (rows, itemId) => Number(rows.find((row) => row.itemId === itemId)?._sum.quantity || 0);
  const during = (rows, itemId) => rows.filter((row) => row.itemId === itemId).reduce((total, row) => total + Number(row.quantity), 0);
  return items.flatMap((item) => {
    const added = !item.openingDate || item.openingDate < range.to;
    const opening = round2((added ? Number(item.openingQuantity) : 0) + before(receivedBefore, item.id) - before(issuedBefore, item.id));
    const received = round2(during(receipts, item.id));
    const out = round2(during(issues, item.id));
    if (!(item.isActive && added) && !opening && !received && !out) return [];
    const remaining = round2(opening + received - out);
    const note = remaining <= 0 ? "Out of stock" : remaining <= Number(item.reorderLevel) ? "Reorder" : "";
    return [{ code: item.code, item: item.name, category: optionLabel("storeCategories", item.category), unit: item.unit, opening, received, out, remaining, note }];
  });
};

/** Long periods: one line per item (or department and item) instead of every record. */
const storeTotals = (rows, keyOf, start) => {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = map.get(key) || start(row);
    entry.count += 1;
    entry.quantity = round2(entry.quantity + Number(row.quantity));
    map.set(key, entry);
  }
  return [...map.values()];
};

const stores = async (db, range) => {
  const span = within(range);
  const [receipts, issues, items, receivedBefore, issuedBefore] = await Promise.all([
    db.storeReceipt.findMany({ where: { date: span }, include: { item: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.storeIssue.findMany({ where: { date: span }, include: { item: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.storeItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.storeReceipt.groupBy({ by: ["itemId"], where: { date: { lt: range.from } }, _sum: { quantity: true } }),
    db.storeIssue.groupBy({ by: ["itemId"], where: { date: { lt: range.from } }, _sum: { quantity: true } }),
  ]);
  const stock = storeStock(range, items, receipts, issues, receivedBefore, issuedBefore);
  const category = (item) => optionLabel("storeCategories", item.category);
  const department = (issue) => optionLabel("departments", issue.department);
  const each = listsEachRecord(range);

  const stockOut = each
    ? section("Stock out", [col("date", "Date", "date"), col("issueNumber", "No."), col("department", "Department"), col("item", "Item"), col("quantity", "Quantity", "number"), col("unit", "Unit"), col("issuedTo", "Received by"), col("purpose", "Purpose")],
      issues.map((i) => ({ date: i.date, issueNumber: i.issueNumber, department: department(i), item: i.item.name, quantity: Number(i.quantity), unit: i.item.unit, issuedTo: i.issuedTo, purpose: i.purpose || "" })))
    : section("Stock out by department", [col("department", "Department"), col("item", "Item"), col("unit", "Unit"), col("count", "Entries", "number"), col("quantity", "Quantity", "number")],
      storeTotals(issues, (i) => `${i.department}:${i.itemId}`, (i) => ({ department: department(i), item: i.item.name, unit: i.item.unit, count: 0, quantity: 0 }))
        .sort((a, b) => a.department.localeCompare(b.department) || a.item.localeCompare(b.item)), ["count"]);
  const received = each
    ? section("Goods received", [col("date", "Date", "date"), col("receiptNumber", "GRN No."), col("item", "Item"), col("category", "Category"), col("quantity", "Quantity", "number"), col("unit", "Unit"), col("source", "Source"), col("notes", "Notes")],
      receipts.map((r) => ({ date: r.date, receiptNumber: r.receiptNumber, item: r.item.name, category: category(r.item), quantity: Number(r.quantity), unit: r.item.unit, source: optionLabel("receiptSources", r.source), notes: r.notes || "" })))
    : section("Goods received by item", [col("item", "Item"), col("category", "Category"), col("unit", "Unit"), col("count", "Deliveries", "number"), col("quantity", "Quantity", "number")],
      storeTotals(receipts, (r) => r.itemId, (r) => ({ item: r.item.name, category: category(r.item), unit: r.item.unit, count: 0, quantity: 0 })), ["count"]);
  const remaining = section(`Stock remaining at ${dayText(range.asAt)}`, [col("code", "Code"), col("item", "Item"), col("category", "Category"), col("unit", "Unit"), col("opening", "Opening", "number"), col("received", "Received", "number"), col("out", "Stock out", "number"), col("remaining", "Remaining", "number"), col("note", "Note")], stock);

  return {
    title: "Stores",
    parts: REPORT_PARTS.stores,
    summary: [
      inPart("out", { label: "Stock out entries", value: issues.length }),
      inPart("out", { label: "Departments supplied", value: new Set(issues.map((i) => i.department)).size }),
      inPart("received", { label: "Deliveries received", value: receipts.length }),
      inPart("stock", { label: "Items in stock", value: stock.filter((row) => row.remaining > 0).length }),
      inPart("stock", { label: "Items low or out of stock", value: stock.filter((row) => row.note).length }),
    ],
    sections: [inPart("out", stockOut), inPart("received", received), inPart("stock", remaining)],
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
