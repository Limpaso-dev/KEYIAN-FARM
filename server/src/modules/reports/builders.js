import { DAIRY_SESSIONS, optionLabel, optionValues, RAW_MILK, REPORT_PARTS } from "../../config/catalog.js";
import { addDays, bucketsOf, dayText } from "../../lib/periods.js";
import { productOrder } from "../../lib/stock.js";
import { round2 } from "../../lib/validate.js";
import { ageText as cropAge, cycleName, standingSince } from "../crops/cropCycle.js";
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
const col = (key, label, type, weight) => ({ key, label, ...(type ? { type } : {}), ...(weight ? { weight } : {}) });
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
// Livestock: the herd, milk, calvings, vaccinations and health, which print
// together or one at a time (?part=herd|milk|calvings|vaccinations|health).
// Milk is in litres.

/** Under a year old is a calf. */
const CALF_DAYS = 365;
/** A cow with no calving on record counts as milking if milked in the last week. */
const RECENTLY_MILKED_DAYS = 7;
const HERD_CLASSES = [
  ["milking", "Milking cows", "Milking cow"],
  ["dry", "Dry cows", "Dry cow"],
  ["heifer", "Heifers", "Heifer"],
  ["femaleCalf", "Female calves", "Female calf"],
  ["bull", "Bulls", "Bull"],
  ["maleCalf", "Male calves", "Male calf"],
];
/** Where the herd table counts the males: they are not kept in a dairy. */
const NO_DAIRY = "Not in a dairy";
const CLASS_NAME = Object.fromEntries(HERD_CLASSES.map(([key, , one]) => [key, one]));

const tagOf = (animal) => (animal ? `${animal.tagNumber}${animal.name ? ` ${animal.name}` : ""}` : "");

/** When an animal joined the herd: born on the farm, or bought / received. Not known: it has always been there. */
const joinedOn = (animal) => (animal.source === "born_on_farm" ? animal.dateOfBirth : animal.acquiredDate) || null;

/** Whether the animal was in the herd at the end of the day before `end`. */
const inHerdAt = (animal, end) => {
  const joined = joinedOn(animal);
  if (joined && joined >= end) return false;
  if (animal.exitDate) return animal.exitDate >= end;
  return animal.status === "active";
};

/** Milking cow, dry cow, heifer, bull or calf, at the end of the day before `end`. */
const herdClass = (animal, end, calvings, lastMilked) => {
  const calf = animal.dateOfBirth && (end - animal.dateOfBirth) / DAY_MS <= CALF_DAYS;
  if (animal.sex === "male") return calf ? "maleCalf" : "bull";
  if (calf) return "femaleCalf";
  const calved = calvings.filter((c) => c.calvingDate < end);
  if (calved.length) {
    const latest = calved[calved.length - 1];
    return !latest.dryOffDate || latest.dryOffDate >= end ? "milking" : "dry";
  }
  if (lastMilked) return (end - lastMilked) / DAY_MS <= RECENTLY_MILKED_DAYS ? "milking" : "dry";
  return "heifer";
};

/** "3 yr 2 mo", "5 mo", "12 days" */
const ageText = (born, asAt) => {
  if (!born || born > asAt) return "";
  let months = (asAt.getUTCFullYear() - born.getUTCFullYear()) * 12 + asAt.getUTCMonth() - born.getUTCMonth();
  if (asAt.getUTCDate() < born.getUTCDate()) months -= 1;
  if (months < 1) {
    const days = Math.round((asAt - born) / DAY_MS);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const years = Math.floor(months / 12);
  return [years && `${years} yr`, months % 12 && `${months % 12} mo`].filter(Boolean).join(" ");
};

const JOINED = { born_on_farm: "Born", purchased: "Bought", donated: "Donated" };
const LEFT = { sold: "Sold", dead: "Died", culled: "Culled" };

const livestock = async (db, range) => {
  const span = within(range);
  const end = addDays(range.asAt, 1);
  const inPeriod = (date) => Boolean(date) && date >= range.from && date < end;
  const [milk, transfers, lactations, vaccinations, health, animals, calvingHistory, lastMilk] = await Promise.all([
    db.milkRecord.findMany({ where: { date: span }, include: { animal: true }, orderBy: [{ date: "asc" }, { animal: { tagNumber: "asc" } }] }),
    db.milkTransfer.findMany({ where: { date: span }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.lactation.findMany({ where: { calvingDate: span }, include: { animal: true, calf: { include: { sire: true } }, twinCalf: true }, orderBy: { calvingDate: "asc" } }),
    db.vaccination.findMany({ where: { date: span }, include: { animal: true }, orderBy: { date: "asc" } }),
    db.healthRecord.findMany({ where: { date: span }, include: { animal: true }, orderBy: { date: "asc" } }),
    db.animal.findMany({ include: { dam: true, sire: true }, orderBy: { tagNumber: "asc" } }),
    db.lactation.findMany({ where: { calvingDate: { lt: end } }, select: { animalId: true, calvingDate: true, dryOffDate: true }, orderBy: { calvingDate: "asc" } }),
    db.milkRecord.groupBy({ by: ["animalId"], where: { date: { lt: end } }, _max: { date: true } }),
  ]);
  const dairies = optionValues("dairies");
  const dairyName = (dairy) => (dairy ? optionLabel("dairies", dairy) : "");

  // ---- Herd: as it stood at the end of the period, and what changed in it.
  const calvingsOf = new Map();
  for (const calving of calvingHistory) calvingsOf.set(calving.animalId, [...(calvingsOf.get(calving.animalId) || []), calving]);
  const lastMilkedOn = new Map(lastMilk.map((row) => [row.animalId, row._max.date]));
  const herd = animals.filter((a) => inHerdAt(a, end))
    .map((animal) => ({ animal, cls: herdClass(animal, end, calvingsOf.get(animal.id) || [], lastMilkedOn.get(animal.id)) }))
    // By dairy, then the males (in no dairy), each by tag.
    .sort((a, b) => Number(!a.animal.dairy) - Number(!b.animal.dairy) || (a.animal.dairy || "").localeCompare(b.animal.dairy || "") || a.animal.tagNumber.localeCompare(b.animal.tagNumber));
  const count = (rows, cls) => rows.filter((row) => row.cls === cls).length;
  // Each dairy, then the bulls and bull calves, which are not kept in a dairy.
  const byDairy = [...dairies, null].map((dairy) => {
    const rows = herd.filter((row) => (row.animal.dairy || null) === dairy);
    return { dairy: dairy ? dairyName(dairy) : NO_DAIRY, ...Object.fromEntries(HERD_CLASSES.map(([key]) => [key, count(rows, key)])), total: rows.length };
  });
  const joined = animals.filter((a) => inPeriod(joinedOn(a))).map((a) => ({ date: joinedOn(a), change: JOINED[a.source] || "Joined", animal: a }));
  const left = animals.filter((a) => inPeriod(a.exitDate)).map((a) => ({ date: a.exitDate, change: LEFT[a.status] || "Left", animal: a }));
  const changes = [...joined, ...left].sort((a, b) => a.date - b.date || a.animal.tagNumber.localeCompare(b.animal.tagNumber));

  // ---- Milk: by dairy and milking, per day (or month), per cow, and what went to MVA.
  const sessionRows = dairies.flatMap((dairy) => DAIRY_SESSIONS[dairy].map((session) => {
    const records = milk.filter((m) => m.dairy === dairy && m.session === session);
    return {
      dairy: dairyName(dairy),
      session: optionLabel("milkSessions", session),
      cows: new Set(records.map((m) => m.animalId)).size,
      litres: sum(records, "litres"),
      sent: sum(transfers.filter((t) => t.dairy === dairy && t.session === session), "litres"),
    };
  }));
  const perCow = new Map();
  for (const record of milk) {
    const key = `${record.animalId}|${record.dairy}`;
    const sessions = DAIRY_SESSIONS[record.dairy] || [];
    const entry = perCow.get(key) || {
      tag: record.animal.tagNumber,
      name: record.animal.name || "",
      dairy: dairyName(record.dairy),
      ...Object.fromEntries(["morning", "midday", "evening"].map((s) => [s, sessions.includes(s) ? 0 : ""])),
      total: 0,
    };
    entry[record.session] = round2(Number(entry[record.session] || 0) + Number(record.litres));
    entry.total = round2(entry.total + Number(record.litres));
    perCow.set(key, entry);
  }
  const totalMilk = sum(milk, "litres");
  const totalSent = sum(transfers, "litres");
  const milkAt = (dairy) => sum(milk.filter((m) => m.dairy === dairy), "litres");

  // ---- Calvings, vaccinations, health.
  const calfText = (calf) => (calf ? `${calf.tagNumber} (${optionLabel("animalSex", calf.sex)})` : "");
  const twins = lactations.filter((l) => l.twinCalfId).length;
  const vaccineName = (vaccine) => optionLabel("vaccines", vaccine);
  // Every vaccine on the list, then any other name typed before the list existed.
  const vaccineRows = [...new Set([...optionValues("vaccines"), ...vaccinations.map((v) => v.vaccine)])].map((vaccine) => {
    const given = vaccinations.filter((v) => v.vaccine === vaccine);
    return { vaccine: vaccineName(vaccine), given: given.length, animals: new Set(given.map((v) => v.animalId)).size };
  });
  const diseaseRows = [...new Set(health.filter((h) => h.disease).map((h) => h.disease))]
    .sort((a, b) => optionValues("diseases").indexOf(a) - optionValues("diseases").indexOf(b))
    .map((disease) => {
      const cases = health.filter((h) => h.disease === disease);
      const outcome = (value) => cases.filter((h) => h.outcome === value).length;
      return { disease: optionLabel("diseases", disease), cases: cases.length, treating: outcome("under_treatment"), recovered: outcome("recovered"), died: outcome("died"), cost: sum(cases, "cost") };
    });
  const healthCases = health.filter((h) => h.recordType === "disease");

  return {
    title: "Livestock",
    parts: REPORT_PARTS.livestock,
    summary: [
      inPart("herd", { label: "Animals in the herd", value: herd.length }),
      inPart("herd", { label: "Milking cows", value: count(herd, "milking") }),
      inPart("herd", { label: "Dry cows", value: count(herd, "dry") }),
      inPart("herd", { label: "Joined the herd", value: joined.length }),
      inPart("herd", { label: "Left the herd", value: left.length }),
      inPart("milk", { label: "Milk recorded (litres)", value: totalMilk }),
      ...dairies.map((dairy) => inPart("milk", { label: `${dairyName(dairy)} (litres)`, value: milkAt(dairy) })),
      inPart("milk", { label: "Sent to MVA (litres)", value: totalSent }),
      inPart("milk", { label: "Not yet sent (litres)", value: round2(totalMilk - totalSent) }),
      inPart("calvings", { label: "Calvings", value: lactations.length }),
      inPart("calvings", { label: "Calves born", value: lactations.filter((l) => l.calfId).length + twins }),
      inPart("calvings", { label: "Twin births", value: twins }),
      inPart("vaccinations", { label: "Vaccinations given", value: vaccinations.length }),
      inPart("vaccinations", { label: "Animals vaccinated", value: new Set(vaccinations.map((v) => v.animalId)).size }),
      inPart("health", { label: "Health records", value: health.length }),
      inPart("health", { label: "Disease cases", value: healthCases.length }),
      inPart("health", { label: "Treatment cost", value: sum(health, "cost"), type: "money" }),
    ],
    sections: [
      inPart("herd", section(`Herd at ${dayText(range.asAt)}`, [col("dairy", "Dairy"), ...HERD_CLASSES.map(([key, label]) => col(key, label, "number")), col("total", "Total", "number")],
        byDairy, [...HERD_CLASSES.map(([key]) => key), "total"])),
      inPart("herd", section("Herd register", [col("tag", "Tag"), col("name", "Name"), col("dairy", "Dairy"), col("cls", "Class"), col("breed", "Breed"), col("born", "Born", "date"), col("age", "Age"), col("mother", "Mother"), col("father", "Father"), { ...col("calvings", "Calvings", "number"), weight: 1.5 }],
        herd.map(({ animal: a, cls }) => ({
          tag: a.tagNumber,
          name: a.name || "",
          dairy: dairyName(a.dairy),
          cls: CLASS_NAME[cls],
          breed: a.breed || "",
          born: a.dateOfBirth,
          age: ageText(a.dateOfBirth, range.asAt),
          mother: tagOf(a.dam),
          father: tagOf(a.sire) || a.sireDetails || "",
          calvings: (calvingsOf.get(a.id) || []).length,
        })))),
      inPart("herd", section("Joined and left the herd", [col("date", "Date", "date"), col("change", "Change"), col("tag", "Tag"), col("name", "Name"), col("dairy", "Dairy"), col("sex", "Sex"), col("mother", "Mother")],
        changes.map(({ date, change, animal: a }) => ({ date, change, tag: a.tagNumber, name: a.name || "", dairy: dairyName(a.dairy), sex: optionLabel("animalSex", a.sex), mother: change === "Born" ? tagOf(a.dam) : "" })))),

      inPart("milk", section("Milk by dairy and session (litres)", [col("dairy", "Dairy"), col("session", "Session"), col("cows", "Cows milked", "number"), col("litres", "Litres", "number"), col("sent", "Sent to MVA (litres)", "number")], sessionRows, ["litres", "sent"])),
      inPart("milk", breakdown(range, "Milk (litres)", [...dairies.map((dairy) => col(dairy, dairyName(dairy), "number")), col("total", "Total", "number"), col("sent", "Sent to MVA", "number")],
        { milk: { rows: milk, date: "date" }, sent: { rows: transfers, date: "date" } },
        ({ milk: records, sent }) => ({
          ...Object.fromEntries(dairies.map((dairy) => [dairy, sum(records.filter((m) => m.dairy === dairy), "litres")])),
          total: sum(records, "litres"),
          sent: sum(sent, "litres"),
        }), [...dairies, "total", "sent"])),
      inPart("milk", section("Milk per cow (litres)", [col("tag", "Tag"), col("name", "Name"), col("dairy", "Dairy"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("total", "Total", "number")],
        [...perCow.values()].sort((a, b) => a.dairy.localeCompare(b.dairy) || a.tag.localeCompare(b.tag)), ["morning", "midday", "evening", "total"])),
      inPart("milk", listsEachRecord(range) && section("Milk sent to MVA", [col("date", "Date", "date"), col("transferNumber", "Transfer"), col("dairy", "Dairy"), col("session", "Session"), col("litres", "Litres sent", "number"), col("received", "Received by MVA", "number"), col("status", "Status")],
        transfers.map((t) => ({ date: t.date, transferNumber: t.transferNumber, dairy: dairyName(t.dairy), session: optionLabel("milkSessions", t.session), litres: Number(t.litres), received: t.receivedLitres == null ? "" : Number(t.receivedLitres), status: optionLabel("transferStatus", t.status) })), ["litres"])),

      inPart("calvings", section("Calvings", [col("date", "Date", "date"), col("dam", "Mother"), col("dairy", "Dairy"), col("lactation", "Lactation no.", "number"), col("calf", "Calf"), col("twin", "Twin"), col("sire", "Father")],
        lactations.map((l) => ({
          date: l.calvingDate,
          dam: tagOf(l.animal),
          dairy: dairyName(l.animal.dairy),
          lactation: l.lactationNumber,
          calf: calfText(l.calf),
          twin: calfText(l.twinCalf),
          sire: tagOf(l.calf?.sire) || l.calf?.sireDetails || "",
        })))),

      inPart("vaccinations", section("Vaccinations by vaccine", [col("vaccine", "Vaccine"), col("given", "Doses given", "number"), col("animals", "Animals", "number")], vaccineRows, ["given"])),
      inPart("vaccinations", listsEachRecord(range) && section("Vaccinations", [col("date", "Date", "date"), col("animal", "Animal"), col("vaccine", "Vaccine"), col("dose", "Dose"), col("by", "Given by"), col("nextDue", "Next due", "date")],
        vaccinations.map((v) => ({ date: v.date, animal: tagOf(v.animal), vaccine: vaccineName(v.vaccine), dose: v.dose || "", by: v.administeredBy || "", nextDue: v.nextDueDate })))),

      inPart("health", section("Cases by disease", [col("disease", "Disease"), col("cases", "Records", "number"), col("treating", "Under treatment", "number"), col("recovered", "Recovered", "number"), col("died", "Died", "number"), col("cost", "Cost", "money")],
        diseaseRows, ["cases", "treating", "recovered", "died", "cost"])),
      inPart("health", section("Disease and herd health", [col("date", "Date", "date"), col("animal", "Animal"), col("type", "Type"), col("disease", "Disease"), col("details", "Details"), col("treatment", "Treatment"), col("outcome", "Outcome"), col("cost", "Cost", "money")],
        health.map((h) => ({ date: h.date, animal: h.animal ? tagOf(h.animal) : "Whole herd", type: optionLabel("healthRecordTypes", h.recordType), disease: h.disease ? optionLabel("diseases", h.disease) : "", details: h.condition || "", treatment: h.treatment || "", outcome: optionLabel("healthOutcomes", h.outcome), cost: Number(h.cost) })), ["cost"])),
    ].filter((s) => s && s.title),
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

// MVA's product output, as on the department's sheet. Milk is in litres.
const OUTPUT_KEYS = ["malaLitres", "malaPieces", "bulkMala", "malaVariance", "yoghurtLitres", "yoghurt1000", "yoghurt500", "yoghurt250", "yoghurt150", "bulkYoghurt", "yoghurtVariance", "fresh250"];
const outputRegister = (range, figures) => {
  const rows = bucketsOf(range).flatMap((bucket) => {
    const inBucket = figures.filter((row) => row.date >= bucket.from && row.date < bucket.to);
    return inBucket.length ? [{ date: bucket.label, ...Object.fromEntries(OUTPUT_KEYS.map((key) => [key, sum(inBucket, key)])) }] : [];
  });
  return section("Product output", [
    dateColumn(range),
    col("malaLitres", "Mala processed (L)", "number"),
    col("malaPieces", "Mala output (pcs)", "number"),
    col("bulkMala", "Bulk Mala (L)", "number"),
    col("malaVariance", "Mala variance (L)", "number"),
    col("yoghurtLitres", "Yoghurt processed (L)", "number"),
    col("yoghurt1000", "Yog 1 litre", "number"),
    col("yoghurt500", "Yog 500 ml", "number"),
    col("yoghurt250", "Yog 250 ml", "number"),
    col("yoghurt150", "Yog 150 ml", "number"),
    col("bulkYoghurt", "Bulk Yoghurt (L)", "number"),
    col("yoghurtVariance", "Yoghurt variance (L)", "number"),
    col("fresh250", "Fresh Pasteurised Milk (packets)", "number"),
  ], rows, OUTPUT_KEYS);
};

/**
 * A stock register for the period: each item's opening stock, what came in
 * and went out (by kind of movement, see flows) and its closing stock.
 * before / within: the ledger summed by item (and movement type, within).
 */
const stockRegister = (title, items, before, within, flows, firstLabel) => {
  const opening = new Map(before.map((row) => [row.id, round2(Number(row._sum.quantity || 0))]));
  const columnOf = (type) => flows.find((flow) => flow.types.includes(type))?.key || "adjusted";
  const rows = items.flatMap((item) => {
    const moved = within.filter((row) => row.id === item.id);
    const totals = Object.fromEntries([...flows.map((flow) => flow.key), "adjusted"].map((key) => [key, 0]));
    for (const row of moved) {
      const key = columnOf(row.movementType);
      const sign = flows.find((flow) => flow.key === key)?.sign ?? 1;
      totals[key] = round2(totals[key] + sign * Number(row._sum.quantity || 0));
    }
    const start = opening.get(item.id) || 0;
    const closing = round2(start + moved.reduce((total, row) => total + Number(row._sum.quantity || 0), 0));
    return item.isActive || start !== 0 || moved.length ? [{ item: item.name, unit: item.unit, opening: start, ...totals, closing }] : [];
  });
  const adjusted = rows.some((row) => row.adjusted !== 0);
  return section(title, [
    col("item", firstLabel),
    col("unit", "Unit"),
    col("opening", "Opening stock", "number"),
    ...flows.map((flow) => col(flow.key, flow.label, "number")),
    ...(adjusted ? [col("adjusted", "Count adjustment", "number")] : []),
    col("closing", "Closing stock", "number"),
  ], rows);
};

// Raw materials: raw milk in and out at MVA, and the cups; then the products MVA makes.
const RAW_FLOWS = [
  { key: "received", label: "Received", sign: 1, types: ["farmer_delivery", "farmer_delivery_reversal", "livestock_transfer", "received"] },
  { key: "used", label: "Used / allocated", sign: -1, types: ["allocation", "transfer_to_sales", "processing_input", "production", "production_reversal"] },
];
const PRODUCT_FLOWS = [
  { key: "made", label: "Made", sign: 1, types: ["processing_output", "processing_reversal"] },
  { key: "sent", label: "Sent to Sales", sign: -1, types: ["transfer_to_sales", "transfer_cancelled"] },
];

const mva = async (db, range) => {
  const span = within(range);
  const [days, transfers, deliveries, batches, outgoing, products, materials, stockBefore, stockWithin, cupsBefore, cupsWithin] = await Promise.all([
    productionDays(db, { date: span }),
    db.milkTransfer.findMany({ where: { date: span, status: "received" }, orderBy: { date: "asc" } }),
    db.milkDelivery.findMany({ where: { date: span }, include: { supplier: true }, orderBy: [{ date: "asc" }, { supplier: { supplierNumber: "asc" } }] }),
    db.processingBatch.findMany({ where: { date: span }, include: { outputs: { include: { product: true } } }, orderBy: { date: "asc" } }),
    db.productTransfer.findMany({ where: { date: span }, include: { items: { include: { product: true } } } }),
    db.product.findMany({ orderBy: { name: "asc" } }),
    db.rawMaterial.findMany({ orderBy: { code: "asc" } }),
    db.stockMovement.groupBy({ by: ["productId"], where: { location: "mva", date: { lt: range.from } }, _sum: { quantity: true } }),
    db.stockMovement.groupBy({ by: ["productId", "movementType"], where: { location: "mva", date: span }, _sum: { quantity: true } }),
    db.rawMaterialMovement.groupBy({ by: ["materialId"], where: { date: { lt: range.from } }, _sum: { quantity: true } }),
    db.rawMaterialMovement.groupBy({ by: ["materialId", "movementType"], where: { date: span }, _sum: { quantity: true } }),
  ]);
  const figures = batches.map((batch) => ({ date: batch.date, ...outputFigures(batch) }));
  const fromLivestock = sum(transfers, "receivedLitres");
  const fromFarmers = sum(deliveries, "litres");
  // A delivery of 0 litres is milk that was all rejected; it carries the remarks.
  const rejected = deliveries.filter((d) => d.notes);
  const perFarmer = new Map();
  for (const d of deliveries.filter((delivery) => Number(delivery.litres) > 0)) {
    const entry = perFarmer.get(d.supplierId) || { number: d.supplier.supplierNumber, farmer: name(d.supplier), morning: 0, midday: 0, evening: 0, litres: 0, amount: 0 };
    entry[d.session] = round2(entry[d.session] + Number(d.litres));
    entry.litres = round2(entry.litres + Number(d.litres));
    entry.amount = round2(entry.amount + Number(d.amount));
    perFarmer.set(d.supplierId, entry);
  }
  // The stock registers: raw milk and the cups, then what MVA makes.
  const byProduct = (rows) => rows.map((row) => ({ ...row, id: row.productId }));
  const byMaterial = (rows) => rows.map((row) => ({ ...row, id: row.materialId }));
  const rawMilk = products.find((p) => p.code === RAW_MILK);
  const cupSize = (m) => Number(/_(\d+)$/.exec(m.usedFor || "")?.[1] || 0);
  const cups = [...materials].sort((a, b) => cupSize(a) - cupSize(b));
  const rawMaterials = stockRegister("Raw materials", [rawMilk, ...cups].filter(Boolean), [...byProduct(stockBefore), ...byMaterial(cupsBefore)], [...byProduct(stockWithin), ...byMaterial(cupsWithin)], RAW_FLOWS, "Item");
  return {
    title: "Milk Value Addition",
    parts: REPORT_PARTS.mva,
    summary: [
      inPart("production", { label: "Milk from Livestock (litres)", value: fromLivestock }),
      inPart("production", { label: "Milk from farmers (litres)", value: fromFarmers }),
      inPart("production", { label: "Farmers delivering", value: perFarmer.size }),
      inPart("production", { label: "Total intake (litres)", value: sum(days, "total") }),
      inPart("production", { label: "Milk allocated (litres)", value: sum(days, "allocated") }),
      inPart("production", { label: "Production variance (L)", value: sum(days, "variance") }),
      inPart("output", { label: "Product output variance (L)", value: round2(sum(figures, "malaVariance") + sum(figures, "yoghurtVariance")) }),
      { label: "Transfers to Sales", value: outgoing.length },
      { label: "Farmer milk value", value: sum(deliveries, "amount"), type: "money" },
      { label: "Milk rejected at collection", value: rejected.length },
    ],
    sections: [
      inPart("production", productionRegister(range, days)),
      inPart("output", outputRegister(range, figures)),
      section("Farmer deliveries", [col("number", "No."), col("farmer", "Farmer"), col("morning", "Morning", "number"), col("midday", "Midday", "number"), col("evening", "Evening", "number"), col("litres", "Litres", "number"), col("amount", "Value", "money")],
        [...perFarmer.values()], ["morning", "midday", "evening", "litres", "amount"]),
      section("Milk rejected at collection", [col("date", "Date", "date"), col("session", "Session"), col("number", "No."), col("farmer", "Farmer"), col("litres", "Litres accepted", "number"), col("remarks", "Remarks", undefined, 3)],
        rejected.map((d) => ({ date: d.date, session: optionLabel("milkSessions", d.session), number: d.supplier.supplierNumber, farmer: name(d.supplier), litres: Number(d.litres), remarks: d.notes }))),
      listsEachRecord(range) && section("Received from Livestock", [col("date", "Date", "date"), col("transferNumber", "Transfer"), col("dairy", "Dairy"), col("session", "Session"), col("sent", "Sent (litres)", "number"), col("received", "Received (litres)", "number")],
        transfers.map((t) => ({ date: t.date, transferNumber: t.transferNumber, dairy: optionLabel("dairies", t.dairy), session: optionLabel("milkSessions", t.session), sent: Number(t.litres), received: Number(t.receivedLitres) })), ["sent", "received"]),
      rawMaterials,
      stockRegister("Products", products.filter((p) => p.code !== RAW_MILK).sort(productOrder), byProduct(stockBefore), byProduct(stockWithin), PRODUCT_FLOWS, "Product"),
    ].filter(Boolean),
  };
};

// ---------------------------------------------------------------------
// Products always on the local sales register, in the order of the paper sheet.
const LOCAL_SHEET = ["MALA", "RAW_MILK", "YOGHURT_1000", "YOGHURT_500", "YOGHURT_250", "YOGHURT_150"];

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
    return [{ item: item.name, category: optionLabel("storeCategories", item.category), unit: item.unit, opening, received, out, remaining, note }];
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
  const remaining = section(`Stock remaining at ${dayText(range.asAt)}`, [col("item", "Item"), col("category", "Category"), col("unit", "Unit"), col("opening", "Opening", "number"), col("received", "Received", "number"), col("out", "Stock out", "number"), col("remaining", "Remaining", "number"), col("note", "Note")], stock);

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
// Crops: the summary (farms and acres by crop), then a report for each crop
// listing its farms as they stood at the end of the period: farm number,
// Field ID, location, age of the standing crop, acres, ratoon (sugarcane)
// and status.
// ---------------------------------------------------------------------
const naturalOrder = (a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

const crops = async (db, range) => {
  const span = within(range);
  const end = addDays(range.asAt, 1);
  const [harvests, statusUpdates, farms, lastHarvests, laterCuts] = await Promise.all([
    db.cropHarvest.findMany({ where: { harvestDate: span }, select: { amount: true } }),
    db.cropStatusLog.count({ where: { date: span } }),
    // The register as it stood: farms with a status by then (each is logged
    // from when its crop started), and any older ones registered without one.
    db.cropFarm.findMany({
      where: { OR: [{ statusLogs: { some: { date: { lt: end } } } }, { statusLogs: { none: {} }, createdAt: { lt: end } }] },
      include: { statusLogs: { where: { date: { lt: end } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1 } },
    }),
    db.cropHarvest.groupBy({ by: ["farmId"], where: { harvestDate: { lt: end } }, _max: { harvestDate: true } }),
    db.cropHarvest.groupBy({ by: ["farmId"], where: { harvestDate: { gte: end }, farm: { cropType: "sugarcane" } }, _count: true }),
  ]);
  farms.sort((a, b) => naturalOrder(a.farmNumber, b.farmNumber));
  const lastHarvest = new Map(lastHarvests.map((row) => [row.farmId, row._max.harvestDate]));
  // Each cut after the period moved the cane on to its next ratoon.
  const cutsSince = new Map(laterCuts.map((row) => [row.farmId, row._count]));
  const statusOf = (farm) => {
    const log = farm.statusLogs[0];
    return [optionLabel("farmStatus", log ? log.status : farm.status), log ? log.note : farm.statusNote].filter(Boolean).join(" - ");
  };

  const cropTypes = optionValues("cropTypes");
  const byCrop = cropTypes.map((crop) => {
    const list = farms.filter((f) => f.cropType === crop);
    return { crop: optionLabel("cropTypes", crop), farms: list.length, acreage: sum(list, "acreage") };
  });

  const asAt = dayText(range.asAt);
  const perCrop = cropTypes.map((crop) => {
    const label = optionLabel("cropTypes", crop);
    const cane = crop === "sugarcane";
    const list = farms.filter((f) => f.cropType === crop);
    const rows = list.map((farm) => ({
      farmNumber: farm.farmNumber,
      fieldId: farm.fieldId || "",
      location: farm.location,
      age: cropAge(standingSince(farm, lastHarvest.get(farm.id), range.asAt), range.asAt),
      acreage: Number(farm.acreage),
      ...(cane ? { ratoon: cycleName(farm.ratoonCount - (cutsSince.get(farm.id) || 0)) } : {}),
      status: statusOf(farm),
    }));
    const columns = [
      col("farmNumber", "Farm no.", null, 1),
      col("fieldId", "Field ID", null, 1.2),
      col("location", "Location", null, 1.4),
      col("age", "Age", null, 1.1),
      col("acreage", "Acres", "number", 0.8),
      ...(cane ? [col("ratoon", "Ratoon", null, 0.8)] : []),
      col("status", "Status", null, 2.6),
    ];
    return {
      // Shown with the crop's own report only; the summary has them by crop.
      summary: [
        inPart(crop, { label: `${label} farms`, value: list.length, partOnly: true }),
        inPart(crop, { label: "Acres", value: sum(list, "acreage"), partOnly: true }),
      ],
      section: inPart(crop, { ...section(`${label} farms as at ${asAt}`, columns, rows, ["acreage"]), emptyText: `No ${label.toLowerCase()} farms in the register as at ${asAt}.` }),
    };
  });

  return {
    title: "Crops",
    parts: REPORT_PARTS.crops,
    summary: [
      inPart("summary", { label: "Harvest records", value: harvests.length }),
      inPart("summary", { label: "Harvest value", value: sum(harvests, "amount"), type: "money" }),
      inPart("summary", { label: "Farm status updates", value: statusUpdates }),
      inPart("summary", { label: "Total farms", value: farms.length }),
      inPart("summary", { label: "Total acreage", value: sum(farms, "acreage") }),
      ...perCrop.flatMap((report) => report.summary),
    ],
    sections: [
      inPart("summary", section("Farms by crop", [col("crop", "Crop"), col("farms", "Farms", "number"), col("acreage", "Acres", "number")], byCrop, ["farms", "acreage"])),
      ...perCrop.map((report) => report.section),
    ],
  };
};

// ---------------------------------------------------------------------
// Accounts: requisitions raised, approved and declined; income and expenses
// by department - Accounts' own departments, with Crops as Tea, Sugarcane
// and Coffee, plus Dispensary and Rentals - and each department on its own.
// ---------------------------------------------------------------------
const NO_DEPARTMENT = "No department";
const EAT_MS = 3 * 3600 * 1000;
/** A moment (requisition raised, decided) as its calendar day in Nairobi. */
const eatDay = (moment) => (moment ? new Date(`${new Date(moment.getTime() + EAT_MS).toISOString().slice(0, 10)}T00:00:00.000Z`) : null);
/** The period's days as moments: from midnight in Nairobi. */
const withinEat = (range) => ({ gte: new Date(range.from.getTime() - EAT_MS), lt: new Date(range.to.getTime() - EAT_MS) });

const accounts = async (db, range) => {
  const [transactions, accountsList, raised, decided] = await Promise.all([
    db.transaction.findMany({ where: { date: within(range), status: "posted" }, include: { account: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.requisition.findMany({ where: { createdAt: withinEat(range) }, include: { requestedBy: true, decidedBy: true }, orderBy: { createdAt: "asc" } }),
    db.requisition.findMany({ where: { decidedAt: withinEat(range), status: { in: ["approved", "fulfilled", "rejected"] } }, include: { requestedBy: true, decidedBy: true }, orderBy: { decidedAt: "asc" } }),
  ]);
  const known = optionValues("accountDepartments");
  // Entries from before Accounts kept its own departments may name another (Crops).
  const departmentName = (key) => (!key ? NO_DEPARTMENT : known.includes(key) ? optionLabel("accountDepartments", key) : optionLabel("departments", key));
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = sum(income, "amount");
  const totalExpenses = sum(expenses, "amount");
  const entry = (t) => ({
    date: t.date,
    reference: t.reference,
    department: departmentName(t.department),
    category: optionLabel(t.type === "income" ? "incomeCategories" : "expenseCategories", t.category),
    description: t.description,
    party: t.party || "",
    account: t.account.name,
    amount: Number(t.amount),
  });
  const entryColumns = (party, withDepartment = true) => [
    col("date", "Date", "date"), col("reference", "Ref"), ...(withDepartment ? [col("department", "Department")] : []), col("category", "Category"),
    col("description", "Description"), col("party", party), col("account", "Account"), col("amount", "Amount", "money"),
  ];
  const flows = (rows) => ({ income: { rows: rows.filter((t) => t.type === "income"), date: "date" }, expenses: { rows: rows.filter((t) => t.type === "expense"), date: "date" } });
  const flowValues = (r) => ({ income: sum(r.income, "amount"), expenses: sum(r.expenses, "amount"), net: round2(sum(r.income, "amount") - sum(r.expenses, "amount")) });
  const flowColumns = [col("income", "Income", "money"), col("expenses", "Expenses", "money"), col("net", "Net", "money")];

  // ---- By department: every department, then any older entries outside the list or without one.
  const extra = [...new Set(transactions.map((t) => t.department).filter((d) => d && !known.includes(d)))];
  const departmentKeys = [...known, ...extra, ...(transactions.some((t) => !t.department) ? [null] : [])];
  const byDepartment = departmentKeys.map((key) => {
    const rows = transactions.filter((t) => (t.department || null) === key);
    return { department: departmentName(key), ...flowValues({ income: rows.filter((t) => t.type === "income"), expenses: rows.filter((t) => t.type === "expense") }) };
  });

  // ---- Each department on its own (its own report only).
  const perDepartment = known.map((key) => {
    const part = `dept-${key}`;
    const name = departmentName(key);
    const rows = transactions.filter((t) => t.department === key);
    const own = flowValues({ income: rows.filter((t) => t.type === "income"), expenses: rows.filter((t) => t.type === "expense") });
    const only = (item) => item && inPart(part, { ...item, partOnly: true });
    return {
      summary: [
        only({ label: "Income", value: own.income, type: "money" }),
        only({ label: "Expenses", value: own.expenses, type: "money" }),
        only({ label: "Net", value: own.net, type: "money" }),
      ],
      sections: [
        only(breakdown(range, `${name} income and expenses`, flowColumns, flows(rows), flowValues, ["income", "expenses", "net"])),
        only({ ...section(`${name} income`, entryColumns("Received from", false), rows.filter((t) => t.type === "income").map(entry), ["amount"]), emptyText: `No income recorded for ${name} in this period.` }),
        only({ ...section(`${name} expenses`, entryColumns("Paid to", false), rows.filter((t) => t.type === "expense").map(entry), ["amount"]), emptyText: `No expenses recorded for ${name} in this period.` }),
      ].filter(Boolean),
    };
  });

  // ---- Account balances at the end of the period.
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

  // ---- Requisitions: raised in the period; approved and declined in it.
  const approved = decided.filter((r) => r.status !== "rejected");
  const declined = decided.filter((r) => r.status === "rejected");
  const requisition = (r) => ({
    raised: eatDay(r.createdAt),
    number: r.requisitionNumber,
    department: optionLabel("departments", r.department),
    title: r.title,
    raisedBy: r.requestedBy?.name || "",
    decidedBy: r.decidedBy?.name || "",
    approved: ["approved", "fulfilled"].includes(r.status) ? eatDay(r.decidedAt) : null,
    declined: r.status === "rejected" ? eatDay(r.decidedAt) : null,
    status: optionLabel("requisitionStatus", r.status),
    reason: r.decisionComment || "",
    amount: Number(r.totalAmount),
  });
  const reqColumns = (...keys) => keys.map((key) => ({
    raised: col("raised", "Date raised", "date"),
    approved: col("approved", "Date approved", "date"),
    declined: col("declined", "Date declined", "date"),
    number: col("number", "Requisition"),
    department: col("department", "Department"),
    title: col("title", "Title"),
    raisedBy: col("raisedBy", "Raised by"),
    decidedBy: col("decidedBy", keys.includes("declined") && !keys.includes("approved") ? "Declined by" : "Approved by"),
    status: col("status", "Status"),
    reason: col("reason", "Reason"),
    amount: col("amount", "Estimate", "money"),
  })[key]);

  return {
    title: "Accounts",
    parts: REPORT_PARTS.accounts,
    summary: [
      inPart("departments", { label: "Income", value: totalIncome, type: "money" }),
      inPart("departments", { label: "Expenses", value: totalExpenses, type: "money" }),
      inPart("departments", { label: "Net", value: round2(totalIncome - totalExpenses), type: "money" }),
      inPart("raised", { label: "Requisitions raised", value: raised.length }),
      inPart("raised", { label: "Estimated value", value: sum(raised, "totalAmount"), type: "money", partOnly: true }),
      inPart("approved", { label: "Requisitions approved", value: approved.length }),
      inPart("approved", { label: "Estimated value", value: sum(approved, "totalAmount"), type: "money", partOnly: true }),
      inPart("declined", { label: "Requisitions declined", value: declined.length }),
      inPart("declined", { label: "Estimated value", value: sum(declined, "totalAmount"), type: "money", partOnly: true }),
      ...perDepartment.flatMap((d) => d.summary),
    ],
    sections: [
      inPart("departments", section("Income and expenses by department", [col("department", "Department"), ...flowColumns], byDepartment, ["income", "expenses", "net"])),
      inPart("departments", breakdown(range, "Income and expenses", flowColumns, flows(transactions), flowValues, ["income", "expenses", "net"])),
      listsEachRecord(range) && inPart("departments", section("Income entries", entryColumns("Received from"), income.map(entry), ["amount"])),
      listsEachRecord(range) && inPart("departments", section("Expense entries", entryColumns("Paid to"), expenses.map(entry), ["amount"])),
      section(`Account balances at ${dayText(range.asAt)}`, [col("account", "Account"), col("type", "Type"), col("balance", "Balance", "money")], balances, ["balance"]),
      inPart("raised", { ...section("Requisitions raised", reqColumns("raised", "number", "department", "title", "raisedBy", "amount", "status", "approved", "declined"), raised.map(requisition), ["amount"]), emptyText: "No requisitions were raised in this period." }),
      inPart("approved", { ...section("Requisitions approved", reqColumns("raised", "approved", "number", "department", "title", "decidedBy", "amount", "status"), approved.map(requisition), ["amount"]), emptyText: "No requisitions were approved in this period." }),
      inPart("declined", { ...section("Requisitions declined", reqColumns("raised", "declined", "number", "department", "title", "decidedBy", "reason", "amount"), declined.map(requisition), ["amount"]), emptyText: "No requisitions were declined in this period." }),
      ...perDepartment.flatMap((d) => d.sections),
    ].filter(Boolean),
  };
};

export const BUILDERS = { hr, livestock, mva, sales, stores, crops, accounts };

/**
 * A report as a whole: without the figures and tables meant for one part
 * only (a crop's own farms and acres, a department's own income and expenses).
 */
export const fullReport = (report) => ({ ...report, summary: report.summary.filter((item) => !item.partOnly), sections: report.sections.filter((s) => !s.partOnly) });
