import { MALA_YIELD, optionValues, PACK_LITRES, YOGHURT_YIELD } from "../../config/catalog.js";
import { isoDay } from "../../lib/periods.js";
import { round2 } from "../../lib/validate.js";

// The figures on MVA's production sheets, worked out the way the sheets do.
// All milk is in litres.

const round1 = (value) => Math.round((value + Number.EPSILON) * 10) / 10;

/**
 * One row per day with milk or an allocation: what came in (Dairy A, Dairy C,
 * farmers), where it went, and the variance left over. Oldest first.
 */
export const productionDays = async (db, where) => {
  const [transfers, deliveries, allocations] = await Promise.all([
    db.milkTransfer.findMany({ where: { ...where, status: "received" } }),
    db.milkDelivery.findMany({ where }),
    db.milkAllocation.findMany({ where, include: { lines: true, transfer: { select: { status: true } } } }),
  ]);
  const days = new Map();
  const dayOf = (date) => {
    const id = isoDay(date);
    if (!days.has(id)) days.set(id, { id, date, dairyA: 0, dairyC: 0, farmers: 0, allocationId: null, notes: null, localSaleReceived: false, lines: [] });
    return days.get(id);
  };
  for (const transfer of transfers) {
    const day = dayOf(transfer.date);
    const key = transfer.dairy === "dairy_c" ? "dairyC" : "dairyA";
    day[key] = round2(day[key] + Number(transfer.receivedLitres ?? transfer.litres));
  }
  for (const delivery of deliveries) {
    const day = dayOf(delivery.date);
    day.farmers = round2(day.farmers + Number(delivery.litres));
  }
  for (const allocation of allocations) {
    const day = dayOf(allocation.date);
    day.allocationId = allocation.id;
    day.notes = allocation.notes;
    day.localSaleReceived = allocation.transfer?.status === "received";
    day.lines = allocation.lines;
  }
  return [...days.values()].sort((a, b) => a.date - b.date).map(({ lines, ...day }) => {
    const going = Object.fromEntries(optionValues("allocationDestinations").map((destination) => [destination, Number(lines.find((line) => line.destination === destination)?.quantity || 0)]));
    const total = round2(day.dairyA + day.dairyC + day.farmers);
    const allocated = round2(Object.values(going).reduce((sum, quantity) => sum + quantity, 0));
    return { ...day, ...going, total, allocated, variance: round1(total - allocated) };
  });
};

const madeOf = (batch, code) => Number(batch.outputs.find((output) => output.product.code === code)?.quantity || 0);

/** The yoghurt pack sizes, largest first: the product code and the field it is entered in. */
export const YOGHURT_PACKS = [["YOGHURT_1000", "yoghurt1000"], ["YOGHURT_500", "yoghurt500"], ["YOGHURT_250", "yoghurt250"], ["YOGHURT_150", "yoghurt150"]];

/**
 * One batch's figures for the Product Output sheet. Needs outputs with their
 * product. The variance is what came out (packs and bulk litres) less what
 * the litres processed should have given.
 */
export const outputFigures = (batch) => {
  const malaLitres = Number(batch.malaLitres);
  const yoghurtLitres = Number(batch.yoghurtLitres);
  const malaPieces = madeOf(batch, "MALA");
  const bulkMala = madeOf(batch, "BULK_MALA");
  const packs = Object.fromEntries(YOGHURT_PACKS.map(([code, key]) => [key, madeOf(batch, code)]));
  const bulkYoghurt = madeOf(batch, "BULK_YOGHURT");
  const yoghurtOut = YOGHURT_PACKS.reduce((total, [code, key]) => total + packs[key] * PACK_LITRES[code], 0) + bulkYoghurt;
  return {
    malaLitres,
    malaPieces,
    bulkMala,
    malaVariance: round1(malaPieces * PACK_LITRES.MALA + bulkMala - malaLitres * MALA_YIELD),
    yoghurtLitres,
    ...packs,
    bulkYoghurt,
    yoghurtVariance: round1(yoghurtOut - yoghurtLitres * YOGHURT_YIELD),
    fresh250: batch.fresh250,
  };
};
