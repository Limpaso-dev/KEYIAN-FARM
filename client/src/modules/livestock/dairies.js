import { nairobiHour } from "../../lib/format";

// Each dairy's milkings come from the server (config/catalog.js DAIRY_SESSIONS):
// Dairy A milks in the morning and evening, Dairy C also at midday.

/** The sessions a dairy milks at. */
export const milkingsOf = (meta, dairy) => meta?.dairySessions?.[dairy] || [];

/** The session drop-down: only the chosen dairy's milkings. */
export const sessionField = {
  name: "session",
  label: "Session",
  type: "select",
  options: "milkSessions",
  required: true,
  optionFilter: (option, values, meta) => !values.dairy || milkingsOf(meta, values.dairy).includes(option.value),
};

/** A change of dairy keeps the session only if that dairy milks then. */
export const keepSession = (values, meta) => (milkingsOf(meta, values.dairy).includes(values.session) ? {} : { session: "" });

/** The dairy's milking at this hour: morning until 11, midday until 3 where it has one, then evening. */
export const currentSession = (meta, dairy) => {
  const milkings = milkingsOf(meta, dairy);
  const hour = nairobiHour();
  const now = hour < 11 ? "morning" : hour < 15 ? "midday" : "evening";
  const nearest = milkings.includes(now) ? now : hour < 13 ? "morning" : "evening";
  return milkings.includes(nearest) ? nearest : "";
};
