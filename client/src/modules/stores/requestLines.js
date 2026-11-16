import { number } from "../../lib/format";

/** "Gloves 4 pairs, Cement 2 bags"; once dispatched, what was given of what was asked: "Gloves 4 of 4 pairs". */
export const requestLines = (row) => row.items
  .map((i) => (row.status === "issued"
    ? `${i.item?.name} ${number(i.quantityGiven)} of ${number(i.quantity)} ${i.item?.unit || ""}`
    : `${i.item?.name} ${number(i.quantity)} ${i.item?.unit || ""}`).trim())
  .join(", ");
