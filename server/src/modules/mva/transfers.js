import { RAW_MILK } from "../../config/catalog.js";
import { badRequest } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { moveStock, productByCode } from "../../lib/stock.js";

// Products MVA sends to Sales: out of MVA stock now, into Sales stock once
// Sales receives them. Used by MVA's own "Send to Sales" and when MVA answers
// a request from Sales.

export const productBrief = { select: { id: true, code: true, name: true, unit: true } };
export const transferInclude = { items: { include: { product: productBrief } } };

/**
 * Create a transfer to Sales and take the products out of MVA stock.
 * items: [{ productId, quantity }] with quantities above zero, one line per product.
 */
export const sendToSales = async (tx, { date, notes, items }) => {
  if (!items.length) throw badRequest("Enter a quantity for at least one product");
  if (new Set(items.map((i) => i.productId)).size !== items.length) throw badRequest("List each product only once");
  const rawMilk = await productByCode(tx, RAW_MILK);
  if (items.some((line) => line.productId === rawMilk.id)) throw badRequest("Raw milk goes to Sales through the L.Sale allocation");
  const created = await tx.productTransfer.create({
    data: { date, notes, transferNumber: await nextNumber(tx, "PTR", date), items: { create: items } },
    include: transferInclude,
  });
  for (const line of items) {
    await moveStock(tx, {
      productId: line.productId,
      location: "mva",
      quantity: -line.quantity,
      movementType: "transfer_to_sales",
      referenceType: "productTransfer",
      referenceId: created.id,
      date,
      notes: created.transferNumber,
    });
  }
  return created;
};
