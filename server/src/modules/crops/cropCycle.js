// The standing crop on a farm: when it started, how old it is and, for
// sugarcane, which ratoon it is. Used by the crop reports.

const DAY_MS = 86400000;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** 0 harvests = plant crop (PC), 1 = first ratoon (RI), 2 = RII ... */
export const cycleName = (harvests) => (harvests <= 0 ? "PC" : `R${ROMAN[harvests - 1] || harvests}`);

/** Whole months from start to end. */
export const monthsBetween = (start, end) => {
  if (!start || start > end) return null;
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() - (end.getUTCDate() < start.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
};

/**
 * Crops whose harvest starts the next crop: cane is cut and grows again as
 * the next ratoon, and fodder grows again after each cut. Tea and coffee are
 * picked from the same bushes, so their age counts from planting.
 */
export const REGROWS_AFTER_HARVEST = ["sugarcane", "fodder"];

/**
 * When the crop standing on the farm at the end of `asAt` started: the day it
 * was planted, or the latest harvest after it for crops that grow again (and,
 * for cane, the start of the current crop recorded at registration).
 */
export const standingSince = (farm, lastHarvest, asAt) => {
  const regrows = REGROWS_AFTER_HARVEST.includes(farm.cropType);
  const starts = [farm.plantingDate, regrows && farm.cycleStartDate, regrows && lastHarvest].filter((day) => day && day <= asAt);
  return starts.length ? new Date(Math.max(...starts.map((day) => day.getTime()))) : null;
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "12 days", "1 month", "16 months", "4 yr 5 mo": cane age reads in months, as on the cane sheets; older crops in years. */
export const ageText = (start, asAt) => {
  const months = monthsBetween(start, asAt);
  if (months === null) return "";
  if (months < 1) return plural(Math.round((asAt - start) / DAY_MS), "day");
  if (months < 24) return plural(months, "month");
  const years = Math.floor(months / 12);
  return months % 12 ? `${years} yr ${months % 12} mo` : `${years} yr`;
};
