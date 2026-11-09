import { DEFAULT_PRODUCTS } from "../config/catalog.js";

const PRODUCTS_ADDED = "default_products_added";

/**
 * Make sure the records the system cannot work without exist: the milk
 * products and a Cash on Hand account. Safe to run on every start; existing
 * records (and edited prices) are left alone. The default products are added
 * only once, so a product Sales deletes stays deleted.
 */
export const ensureReferenceData = async (prisma) => {
  if (!(await prisma.sequence.findUnique({ where: { key: PRODUCTS_ADDED } }))) {
    for (const product of DEFAULT_PRODUCTS) {
      await prisma.product.upsert({ where: { code: product.code }, update: {}, create: product });
    }
    await prisma.sequence.create({ data: { key: PRODUCTS_ADDED, value: 1 } });
  }
  await prisma.account.upsert({
    where: { name: "Cash on Hand" },
    update: {},
    create: { name: "Cash on Hand", accountType: "cash", openingBalance: 0 },
  });
};
