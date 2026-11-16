/**
 * The farmer number identifies a farmer across the cooperative, and it is
 * what farmers are searched by: ?search=131 finds farmer 131. Anything that
 * is not a farmer number finds no farmer.
 *
 * Returns the condition on the farmer (MilkSupplier), or null with no search.
 */
export const farmerNumberSearch = (query) => {
  const term = String(query.search || "").trim();
  if (!term) return null;
  const number = /^\d{1,9}$/.test(term) ? Number(term) : null;
  return { supplierNumber: number === null ? { in: [] } : number };
};
