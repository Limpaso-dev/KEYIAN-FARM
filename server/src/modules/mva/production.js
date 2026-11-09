import { KG_TO_LITRES, MALA_YIELD, optionValues, PACK_LITRES, YOGHURT_YIELD } from "../../config/catalog.js";
import { isoDay } from "../../lib/periods.js";
import { round2 } from "../../lib/validate.js";

// The figures on MVA's production sheets, worked out the way the sheets do.

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

const piecesOf = (batch, code) => Number(batch.outputs.find((output) => output.product.code === code)?.quantity || 0);

/** One batch's figures for the Product Output sheet. Needs outputs with their product. */
export const outputFigures = (batch) => {
  const malaKg = Number(batch.malaKg);
  const yoghurtKg = Number(batch.yoghurtKg);
  const malaPieces = piecesOf(batch, "MALA");
  const yoghurt500 = piecesOf(batch, "YOGHURT_500");
  const yoghurt250 = piecesOf(batch, "YOGHURT_250");
  const yoghurt150 = piecesOf(batch, "YOGHURT_150");
  const yoghurtOut = yoghurt500 * PACK_LITRES.YOGHURT_500 + yoghurt250 * PACK_LITRES.YOGHURT_250 + yoghurt150 * PACK_LITRES.YOGHURT_150;
  return {
    malaKg,
    malaLitres: round1(malaKg * KG_TO_LITRES),
    malaPieces,
    malaVariance: round1(malaPieces * PACK_LITRES.MALA - malaKg * KG_TO_LITRES * MALA_YIELD),
    yoghurtKg,
    yoghurtLitres: round1(yoghurtKg * KG_TO_LITRES),
    yoghurt500,
    yoghurt250,
    yoghurt150,
    yoghurtVariance: round1(yoghurtOut - yoghurtKg * KG_TO_LITRES * YOGHURT_YIELD),
    fresh250: batch.fresh250,
  };
};
