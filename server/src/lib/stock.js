import { conflict, notFound } from "./http.js";
import { round2 } from "./validate.js";

// Product stock at MVA and Sales is a ledger of signed StockMovement rows.
// Every change takes a per-product/location advisory lock first so two
// requests cannot both spend the same litres.

export const LOCATIONS = ["mva", "sales"];

/** What is left on a vehicle for one product of a trip. */
export const stillOnVehicle = (item) => round2(Number(item.quantityDispatched) - Number(item.quantityReturned) - Number(item.quantityDamaged) - Number(item.quantityReplaced));

const lock = (tx, productId, location) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${productId}:${location}`}))`;

export const stockOnHand = async (tx, productId, location) => {
  const result = await tx.stockMovement.aggregate({
    where: { productId, location },
    _sum: { quantity: true },
  });
  return round2(Number(result._sum.quantity || 0));
};

/**
 * Record a stock movement. Negative quantities are checked against stock
 * on hand unless allowNegative is set.
 */
export const moveStock = async (tx, { productId, location, quantity, movementType, referenceType, referenceId, date, notes, allowNegative = false }) => {
  const amount = round2(quantity);
  if (amount === 0) return null;
  await lock(tx, productId, location);
  if (amount < 0 && !allowNegative) {
    const onHand = await stockOnHand(tx, productId, location);
    if (onHand + amount < -0.001) {
      const product = await tx.product.findUnique({ where: { id: productId } });
      throw conflict(
        `Not enough ${product?.name || "stock"} at ${location === "mva" ? "MVA" : "Sales"}: ${onHand} ${product?.unit || ""} on hand, ${-amount} needed`,
      );
    }
  }
  return tx.stockMovement.create({
    data: { productId, location, quantity: amount, movementType, referenceType, referenceId, date, notes },
  });
};

export const productByCode = async (tx, code) => {
  const product = await tx.product.findUnique({ where: { code } });
  if (!product) throw notFound(`Product ${code}`);
  return product;
};

/**
 * Stock on hand at a location. Products no longer sold are left out once
 * their stock is gone. For Sales, onVehicles is what is out on open trips.
 */
export const stockSummary = async (tx, location, { upTo } = {}) => {
  const products = await tx.product.findMany({ orderBy: { name: "asc" } });
  const sums = await tx.stockMovement.groupBy({
    by: ["productId"],
    where: { location, ...(upTo ? { date: { lte: upTo } } : {}) },
    _sum: { quantity: true },
  });
  const byProduct = new Map(sums.map((row) => [row.productId, Number(row._sum.quantity || 0)]));
  const openItems = location === "sales"
    ? await tx.dispatchItem.findMany({ where: { dispatch: { status: "dispatched" } } })
    : [];
  return products.map((product) => ({
    productId: product.id,
    code: product.code,
    name: product.name,
    unit: product.unit,
    isActive: product.isActive,
    localPrice: Number(product.localPrice),
    vehiclePrice: Number(product.vehiclePrice),
    onHand: round2(byProduct.get(product.id) || 0),
    onVehicles: round2(openItems.filter((item) => item.productId === product.id).reduce((total, item) => total + stillOnVehicle(item), 0)),
  })).filter((row) => row.isActive || row.onHand !== 0);
};

/** Atomically reduce a store item, failing if there is not enough. */
export const takeStoreItem = async (tx, itemId, quantity) => {
  const result = await tx.storeItem.updateMany({
    where: { id: itemId, quantityOnHand: { gte: quantity } },
    data: { quantityOnHand: { decrement: quantity } },
  });
  if (result.count === 0) {
    const item = await tx.storeItem.findUnique({ where: { id: itemId } });
    if (!item) throw notFound("Store item");
    throw conflict(`Not enough ${item.name} in stores: ${Number(item.quantityOnHand)} ${item.unit} on hand, ${quantity} requested`);
  }
};
