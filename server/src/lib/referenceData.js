import { DEFAULT_PRODUCTS } from "../config/catalog.js";

/**
 * Make sure the records the system cannot work without exist:
 * the four milk products and a Cash on Hand account. Safe to run on every
 * start; existing records (and edited prices) are left alone.
 */
export const ensureReferenceData = async (prisma) => {
  for (const product of DEFAULT_PRODUCTS) {
    await prisma.product.upsert({ where: { code: product.code }, update: {}, create: product });
  }
  await prisma.account.upsert({
    where: { name: "Cash on Hand" },
    update: {},
    create: { name: "Cash on Hand", accountType: "cash", openingBalance: 0 },
  });
};
