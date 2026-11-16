import { number } from "../../lib/format";

// A purchase order's lines as Stores sees them: names and quantities, no prices.

export const itemName = (line) => (line.storeItem ? line.storeItem.name : line.description);
export const unitOf = (line) => (line.storeItem?.unit ? ` ${line.storeItem.unit}` : "");
export const stillExpected = (line) => Math.max(0, Number(line.quantity) - Number(line.quantityReceived));

/** "Dairy meal 30 bags, Delivery charge 1"; once part has come, what came of what was ordered. */
export const deliveryLines = (row) => row.items
  .map((i) => (row.status === "ordered" ? `${itemName(i)} ${number(i.quantity)}${unitOf(i)}` : `${itemName(i)} ${number(i.quantityReceived)} of ${number(i.quantity)}${unitOf(i)}`))
  .join(", ");
