import prisma from "../../config/prisma.js";
import { optionLabel } from "../../config/catalog.js";
import { badRequest, ok } from "../../lib/http.js";
import { round2 } from "../../lib/validate.js";
import { toCsv, toPdf } from "../reports/render.js";

// Crop performance over a month, quarter, half year or year, laid out like
// the cooperative's paper reports: the tea farm report (daily kgs against
// target), the end-year tea report (month by month, kgs to date, average per
// day) and the cane status report (hectares, age, cycle, expected yield and
// tonnage achieved).

const ORGANISATION = "Keiyian Farmers Cooperative Society Ltd";
const MOTTO = "Nuru ya Jamii";
const SIGNATURES = ["Prepared by", "Checked by", "Confirmed by"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const ACRES_PER_HECTARE = 2.471;
const DAY_MS = 86400000;

// period -> [periods in a year, months in each]
const SPANS = { month: [12, 1], quarter: [4, 3], half: [2, 6], year: [1, 12] };

const utc = (year, month, day = 1) => new Date(Date.UTC(year, month, day));
const isoDay = (date) => date.toISOString().slice(0, 10);
const sum = (rows, pick) => round2(rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0));
const col = (key, label, type, weight) => ({ key, label, ...(type ? { type } : {}), ...(weight ? { weight } : {}) });

const periodName = (period, year, index, startMonth, months) => {
  const span = `${SHORT[startMonth]} - ${SHORT[startMonth + months - 1]}`;
  if (period === "month") return `${MONTHS[startMonth]} ${year}`;
  if (period === "quarter") return `Q${index} ${year} (${span})`;
  if (period === "half") return `${index === 1 ? "First" : "Second"} half ${year} (${span})`;
  return `Year ${year}`;
};

/** The dates a report covers. `to` is exclusive. */
export const periodRange = (period, year, index, { withPrevious = true } = {}) => {
  const [count, months] = SPANS[period] || [];
  if (!count) throw badRequest("Period must be month, quarter, half or year");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest("Choose a valid year");
  const i = period === "year" ? 1 : index;
  if (!Number.isInteger(i) || i < 1 || i > count) throw badRequest(`Choose a ${period} between 1 and ${count}`);
  const startMonth = (i - 1) * months;
  const from = utc(year, startMonth);
  const to = utc(year, startMonth + months);
  // Status and crop age are "as at" the end of the period, or today if the
  // period is still running.
  const todayStart = new Date(`${isoDay(new Date())}T00:00:00.000Z`);
  const lastDay = new Date(to.getTime() - DAY_MS);
  const range = {
    period, year, index: i, months, startMonth, from, to, lastDay,
    asAt: lastDay < todayStart ? lastDay : todayStart,
    yearStart: utc(year, 0),
    label: periodName(period, year, i, startMonth, months),
    shortLabel: period === "month" ? `${SHORT[startMonth]} ${year}` : period === "year" ? String(year) : `${period === "quarter" ? "Q" : "H"}${i} ${year}`,
  };
  if (withPrevious) {
    range.previous = i > 1 ? periodRange(period, year, i - 1, { withPrevious: false }) : periodRange(period, year - 1, count, { withPrevious: false });
  }
  return range;
};

/** Which period "now" falls in, used when none is chosen. */
const currentIndex = (period, date = new Date()) => {
  const [, months] = SPANS[period] || [1, 1];
  return Math.floor(date.getUTCMonth() / months) + 1;
};

const kilograms = (h) => Number(h.quantity) * (h.unit === "tonnes" ? 1000 : 1);
const tonnes = (h) => Number(h.quantity) / (h.unit === "kg" ? 1000 : 1);
const hectaresOf = (farm) => (farm.hectares != null ? Number(farm.hectares) : round2(Number(farm.acreage) / ACRES_PER_HECTARE));
const between = (from, to) => (h) => h.harvestDate >= from && h.harvestDate < to;
const change = (current, previous) => (previous > 0 ? round2(((current - previous) / previous) * 100) : null);

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** 0 harvests = plant crop (PC), 1 = first ratoon (RI), 2 = RII ... */
export const cycleName = (harvests) => (harvests <= 0 ? "PC" : `R${ROMAN[harvests - 1] || harvests}`);

/** Whole months from start to end (age of the standing crop). */
export const monthsBetween = (start, end) => {
  if (!start || start > end) return null;
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() - (end.getUTCDate() < start.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
};

const statusText = (farm, log) => {
  const status = log?.status ?? farm.status;
  const note = log ? log.note : farm.statusNote;
  return [optionLabel("farmStatus", status), note].filter(Boolean).join(" - ");
};

const loadHarvests = (crop, from, to) => prisma.cropHarvest.findMany({
  where: { harvestDate: { gte: from, lt: to }, farm: { cropType: crop } },
  include: { farm: true },
  orderBy: [{ harvestDate: "asc" }, { createdAt: "asc" }],
});

const loadFarms = (crop, range) => prisma.cropFarm.findMany({
  where: { cropType: crop },
  include: { statusLogs: { where: { date: { lt: range.to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1 } },
  orderBy: { farmNumber: "asc" },
});

/** Each month of the period with the harvests that fell in it. */
const monthsOf = (range, harvests) => Array.from({ length: range.months }, (_, i) => {
  const from = utc(range.year, range.startMonth + i);
  const to = utc(range.year, range.startMonth + i + 1);
  return { month: MONTHS[range.startMonth + i], from, to, harvests: harvests.filter(between(from, to)) };
});

const changeItem = (range, current, previous) => ({
  label: `Change vs ${range.previous.shortLabel}`,
  value: change(current, previous) ?? "No data",
  type: change(current, previous) == null ? "text" : "percent",
});

// ---------------------------------------------------------------------
// Tea and coffee: plucking days against a daily target.
// ---------------------------------------------------------------------
const plucking = (crop) => async (range) => {
  const earliest = range.previous.from < range.yearStart ? range.previous.from : range.yearStart;
  const [farms, all] = await Promise.all([loadFarms(crop, range), loadHarvests(crop, earliest, range.to)]);
  const current = all.filter(between(range.from, range.to));
  const previous = all.filter(between(range.previous.from, range.previous.to));
  const yearToDate = all.filter(between(range.yearStart, range.to));

  const byDay = new Map();
  for (const h of current) {
    const key = isoDay(h.harvestDate);
    const day = byDay.get(key) || { date: h.harvestDate, target: null, kgs: 0, value: 0 };
    day.kgs += kilograms(h);
    day.value += Number(h.amount || 0);
    if (h.target != null) day.target = (day.target || 0) + Number(h.target);
    byDay.set(key, day);
  }
  const days = [...byDay.values()].sort((a, b) => a.date - b.date).map((d) => ({
    date: d.date,
    target: d.target == null ? null : round2(d.target),
    kgs: round2(d.kgs),
    variance: d.target == null ? null : round2(d.kgs - d.target),
    value: round2(d.value),
  }));
  const kgs = sum(days, (d) => d.kgs);
  const hasTarget = days.some((d) => d.target != null);
  const target = sum(days, (d) => d.target);
  const variance = sum(days, (d) => d.variance);
  const value = sum(days, (d) => d.value);
  const previousKgs = sum(previous, kilograms);
  const label = optionLabel("cropTypes", crop);

  const summary = [
    { label: "Kgs plucked", value: kgs },
    ...(hasTarget ? [
      { label: "Target (kg)", value: target },
      { label: "Variance (kg)", value: variance },
      { label: "Achieved against target", value: target > 0 ? round2((sum(days.filter((d) => d.target != null), (d) => d.kgs) / target) * 100) : 0, type: "percent" },
    ] : []),
    { label: "Plucking days", value: days.length },
    { label: "Average per plucking day (kg)", value: days.length ? round2(kgs / days.length) : 0 },
    { label: `Kgs plucked Jan - ${SHORT[range.startMonth + range.months - 1]} ${range.year}`, value: sum(yearToDate, kilograms) },
    changeItem(range, kgs, previousKgs),
    ...(value > 0 ? [{ label: "Value", value, type: "money" }] : []),
  ];

  const sections = [];
  if (range.months === 1) {
    sections.push({
      title: `Daily plucking - ${range.label}`,
      columns: [col("date", "Date", "date"), col("target", "Target (kg)", "number"), col("kgs", "Kgs plucked", "number"), col("variance", "Variance (kg)", "number"), ...(value > 0 ? [col("value", "Value", "money")] : [])],
      rows: days,
      ...(days.length ? { totals: { target: hasTarget ? target : null, kgs, variance: hasTarget ? variance : null, value } } : {}),
    });
  } else {
    let toDate = sum(yearToDate.filter((h) => h.harvestDate < range.from), kilograms);
    const rows = monthsOf(range, current).map((m) => {
      const monthDays = days.filter((d) => d.date >= m.from && d.date < m.to);
      const monthKgs = sum(monthDays, (d) => d.kgs);
      toDate = round2(toDate + monthKgs);
      return {
        month: m.month,
        days: monthDays.length,
        target: monthDays.some((d) => d.target != null) ? sum(monthDays, (d) => d.target) : null,
        kgs: monthKgs,
        variance: monthDays.some((d) => d.variance != null) ? sum(monthDays, (d) => d.variance) : null,
        toDate,
        average: monthDays.length ? round2(monthKgs / monthDays.length) : null,
      };
    });
    sections.push({
      title: `Monthly performance - ${range.label}`,
      columns: [col("month", "Month"), col("days", "Plucking days", "number"), col("target", "Target (kg)", "number"), col("kgs", "Kgs plucked", "number"), col("variance", "Variance (kg)", "number"), col("toDate", "Kgs plucked to date", "number"), col("average", "Average per day (kg)", "number")],
      rows,
      totals: { days: days.length, target: hasTarget ? target : null, kgs, variance: hasTarget ? variance : null, average: days.length ? round2(kgs / days.length) : null },
    });
  }
  sections.push({
    title: "Performance by farm",
    columns: [col("farmNumber", "Farm no."), col("variety", "Clone / variety"), col("acreage", "Acres", "number"), col("kgs", "Kgs plucked", "number"), col("perAcre", "Kg per acre", "number"), col("target", "Target (kg)", "number"), col("variance", "Variance (kg)", "number")],
    rows: farms.map((farm) => {
      const list = current.filter((h) => h.farmId === farm.id);
      const farmKgs = sum(list, kilograms);
      const farmTarget = list.some((h) => h.target != null) ? sum(list, (h) => h.target) : null;
      return {
        farmNumber: farm.farmNumber,
        variety: farm.variety || "",
        acreage: Number(farm.acreage),
        kgs: farmKgs,
        perAcre: Number(farm.acreage) > 0 ? round2(farmKgs / Number(farm.acreage)) : null,
        target: farmTarget,
        variance: farmTarget == null ? null : round2(sum(list.filter((h) => h.target != null), kilograms) - farmTarget),
      };
    }),
    totals: { acreage: sum(farms, (f) => f.acreage), kgs, target: hasTarget ? target : null, variance: hasTarget ? variance : null },
  });

  return {
    title: label,
    heading: `${label} farm report - ${range.label}`,
    summary,
    sections,
    chart: {
      unit: "kg",
      series: [{ key: "kgs", label: "Kgs plucked" }, ...(hasTarget ? [{ key: "target", label: "Target" }] : [])],
      points: range.months === 1
        ? days.map((d) => ({ key: isoDay(d.date), date: isoDay(d.date), values: { kgs: d.kgs, target: d.target } }))
        : sections[0].rows.map((r) => ({ key: r.month, label: r.month.slice(0, 3), values: { kgs: r.kgs, target: r.target } })),
    },
    counts: { farms: farms.length, records: current.length },
  };
};

// ---------------------------------------------------------------------
// Sugarcane: cane status as at the end of the period, plus tonnage cut.
// ---------------------------------------------------------------------
const sugarcane = async (range) => {
  const earliest = range.previous.from < range.yearStart ? range.previous.from : range.yearStart;
  const [farms, all, lastCuts, laterCuts] = await Promise.all([
    loadFarms("sugarcane", range),
    loadHarvests("sugarcane", earliest, range.to),
    prisma.cropHarvest.groupBy({ by: ["farmId"], where: { harvestDate: { lt: range.to }, farm: { cropType: "sugarcane" } }, _max: { harvestDate: true } }),
    prisma.cropHarvest.groupBy({ by: ["farmId"], where: { harvestDate: { gte: range.to }, farm: { cropType: "sugarcane" } }, _count: true }),
  ]);
  const current = all.filter(between(range.from, range.to));
  const previous = all.filter(between(range.previous.from, range.previous.to));
  const yearToDate = all.filter(between(range.yearStart, range.to));
  const lastCut = new Map(lastCuts.map((c) => [c.farmId, c._max.harvestDate]));
  const cutsSince = new Map(laterCuts.map((c) => [c.farmId, c._count]));

  const statusRows = farms.map((farm, i) => {
    const hectares = hectaresOf(farm);
    const tch = farm.expectedTch == null ? null : Number(farm.expectedTch);
    // The crop standing at the end of the period started at its last cut,
    // or at planting / the recorded cycle start, whichever is latest.
    const starts = [lastCut.get(farm.id), farm.cycleStartDate, farm.plantingDate].filter((d) => d && d <= range.asAt);
    const start = starts.length ? new Date(Math.max(...starts.map((d) => d.getTime()))) : null;
    return {
      sNo: i + 1,
      farmNumber: farm.farmNumber,
      longFarmNumber: farm.longFarmNumber || "",
      hectares,
      acreage: Number(farm.acreage),
      age: monthsBetween(start, range.asAt),
      cycle: cycleName(farm.ratoonCount - (cutsSince.get(farm.id) || 0)),
      tch,
      expectedYield: tch == null ? null : round2(hectares * tch),
      achieved: sum(current.filter((h) => h.farmId === farm.id), tonnes) || null,
      yearToDate: sum(yearToDate.filter((h) => h.farmId === farm.id), tonnes) || null,
      remarks: statusText(farm, farm.statusLogs[0]),
    };
  });

  const cut = current.map((h) => {
    const hectares = hectaresOf(h.farm);
    const t = round2(tonnes(h));
    return { date: h.harvestDate, farmNumber: h.farm.farmNumber, hectares, tonnes: t, tch: hectares > 0 ? round2(t / hectares) : null, buyer: h.buyer || "", value: Number(h.amount || 0) };
  });
  const totalTonnes = sum(cut, (c) => c.tonnes);
  const cutFarmIds = [...new Set(current.map((h) => h.farmId))];
  const cutHectares = sum(cutFarmIds.map((id) => current.find((h) => h.farmId === id).farm), hectaresOf);
  const value = sum(cut, (c) => c.value);

  const sections = [
    {
      title: `Cane status as at ${isoDay(range.asAt)}`,
      columns: [
        col("sNo", "S.No.", "number", 0.6), col("farmNumber", "F.No.", null, 1.1), col("longFarmNumber", "Long F/No.", null, 1.4),
        col("hectares", "Hectares", "number"), col("acreage", "Acres", "number"), col("age", "Age (months)", "number"),
        col("cycle", "Cycle", null, 0.8), col("tch", "Expected TCH", "number"), col("expectedYield", "Exp. yield (t)", "number"),
        col("achieved", "Achieved tonnage", "number"), col("yearToDate", "Harvest Jan to date (t)", "number"), col("remarks", "Remarks", null, 2.6),
      ],
      rows: statusRows,
      totals: { hectares: sum(statusRows, (r) => r.hectares), acreage: sum(statusRows, (r) => r.acreage), expectedYield: sum(statusRows, (r) => r.expectedYield), achieved: totalTonnes, yearToDate: sum(yearToDate, tonnes) },
    },
    {
      title: `Harvests - ${range.label}`,
      columns: [col("date", "Date", "date"), col("farmNumber", "F.No."), col("hectares", "Hectares", "number"), col("tonnes", "Tonnes", "number"), col("tch", "TCH achieved", "number"), col("buyer", "Delivered to"), col("value", "Value", "money")],
      rows: cut,
      ...(cut.length ? { totals: { tonnes: totalTonnes, value } } : {}),
    },
  ];
  if (range.months > 1) {
    let toDate = sum(yearToDate.filter((h) => h.harvestDate < range.from), tonnes);
    sections.push({
      title: `Monthly harvests - ${range.label}`,
      columns: [col("month", "Month"), col("farms", "Farms cut", "number"), col("tonnes", "Tonnes", "number"), col("value", "Value", "money"), col("toDate", "Tonnes to date", "number")],
      rows: monthsOf(range, current).map((m) => {
        const t = sum(m.harvests, tonnes);
        toDate = round2(toDate + t);
        return { month: m.month, farms: new Set(m.harvests.map((h) => h.farmId)).size, tonnes: t, value: sum(m.harvests, (h) => h.amount), toDate };
      }),
      totals: { tonnes: totalTonnes, value },
    });
  }

  return {
    title: "Sugarcane",
    heading: `Sugarcane report - ${range.label}`,
    summary: [
      { label: "Cane farms", value: farms.length },
      { label: "Hectares under cane", value: sum(statusRows, (r) => r.hectares) },
      { label: "Expected yield (t)", value: sum(statusRows, (r) => r.expectedYield) },
      { label: "Tonnes harvested", value: totalTonnes },
      { label: "Average TCH achieved", value: cutHectares > 0 ? round2(totalTonnes / cutHectares) : 0 },
      { label: `Tonnes Jan - ${SHORT[range.startMonth + range.months - 1]} ${range.year}`, value: sum(yearToDate, tonnes) },
      changeItem(range, totalTonnes, sum(previous, tonnes)),
      ...(value > 0 ? [{ label: "Value", value, type: "money" }] : []),
    ],
    sections,
    chart: range.months > 1
      ? { unit: "t", series: [{ key: "tonnes", label: "Tonnes harvested" }], points: sections[2].rows.map((r) => ({ key: r.month, label: r.month.slice(0, 3), values: { tonnes: r.tonnes } })) }
      : null,
    counts: { farms: farms.length, records: current.length },
  };
};

// ---------------------------------------------------------------------
// Fodder: plots, acreage and status, plus anything cut in the period.
// ---------------------------------------------------------------------
const fodder = async (range) => {
  const [farms, current] = await Promise.all([loadFarms("fodder", range), loadHarvests("fodder", range.from, range.to)]);
  const rows = farms.map((farm, i) => ({ sNo: i + 1, fodder: farm.variety || farm.farmNumber, farmNumber: farm.farmNumber, acreage: Number(farm.acreage), location: farm.location, status: statusText(farm, farm.statusLogs[0]) }));
  return {
    title: "Fodder",
    heading: `Fodder status report - ${range.label}`,
    summary: [
      { label: "Fodder plots", value: farms.length },
      { label: "Acres under fodder", value: sum(rows, (r) => r.acreage) },
      { label: "Harvests recorded", value: current.length },
    ],
    sections: [
      {
        title: `Fodder status as at ${isoDay(range.asAt)}`,
        columns: [col("sNo", "S.No.", "number", 0.6), col("fodder", "Fodder"), col("farmNumber", "F.No."), col("acreage", "Acres", "number"), col("location", "Location"), col("status", "Status", null, 3)],
        rows,
        ...(rows.length ? { totals: { acreage: sum(rows, (r) => r.acreage) } } : {}),
      },
      {
        title: `Harvests - ${range.label}`,
        columns: [col("date", "Date", "date"), col("fodder", "Fodder"), col("quantity", "Quantity", "number"), col("unit", "Unit"), col("buyer", "Used by / sold to"), col("value", "Value", "money")],
        rows: current.map((h) => ({ date: h.harvestDate, fodder: h.farm.variety || h.farm.farmNumber, quantity: Number(h.quantity), unit: optionLabel("harvestUnits", h.unit), buyer: h.buyer || "", value: Number(h.amount || 0) })),
      },
    ],
    chart: null,
    counts: { farms: farms.length, records: current.length },
  };
};

const BUILDERS = { tea: plucking("tea"), sugarcane, coffee: plucking("coffee"), fodder };
export const CROP_ORDER = Object.keys(BUILDERS);

/** GET /api/crops/reports?crop=tea|sugarcane|coffee|fodder|all&period=month&year=2024&index=5&format=json|pdf|csv */
export const cropReport = async (req, res) => {
  const crop = String(req.query.crop || "tea");
  const crops = crop === "all" ? CROP_ORDER : [crop];
  if (crops.some((c) => !BUILDERS[c])) throw badRequest("Choose a crop");
  const format = String(req.query.format || "json");
  if (!["json", "csv", "pdf"].includes(format)) throw badRequest("Format must be json, csv or pdf");
  const period = String(req.query.period || "month");
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
  const index = req.query.index ? Number(req.query.index) : currentIndex(period, now);
  const range = periodRange(period, year, index);

  let reports = [];
  for (const c of crops) reports.push({ crop: c, ...(await BUILDERS[c](range)) });
  // "All crops" leaves out crops the cooperative has no farms or records for.
  if (crop === "all") {
    const active = reports.filter((r) => r.counts.farms || r.counts.records);
    if (active.length) reports = active;
  }

  const slug = { month: `${year}-${String(range.index).padStart(2, "0")}`, quarter: `${year}-Q${range.index}`, half: `${year}-H${range.index}`, year: `${year}` }[period];
  const fileBase = `keiyian-${crop === "all" ? "crops" : crop}-report-${slug}`;
  const meta = {
    organisation: ORGANISATION,
    motto: MOTTO,
    reportName: "Crop report",
    periodText: range.label,
    emptyText: "No records for this period.",
    signatures: SIGNATURES,
    signEachReport: true,
    preparedBy: req.user.name,
  };
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    return res.send(toCsv(reports, meta));
  }
  if (format === "pdf") {
    const pdf = await toPdf(reports, meta);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.inline === "true" ? "inline" : "attachment"}; filename="${fileBase}.pdf"`);
    return res.send(pdf);
  }

  const first = await prisma.cropHarvest.aggregate({ _min: { harvestDate: true } });
  const firstYear = Math.min(first._min.harvestDate?.getUTCFullYear() ?? now.getUTCFullYear(), year);
  const years = Array.from({ length: now.getUTCFullYear() - firstYear + 1 }, (_, i) => now.getUTCFullYear() - i);
  return ok(res, {
    period: { period, year, index: range.index, label: range.label, from: isoDay(range.from), to: isoDay(range.lastDay), asAt: isoDay(range.asAt), previous: range.previous.label },
    years,
    reports,
  });
};
