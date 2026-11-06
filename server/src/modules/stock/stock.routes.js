import express from "express";
import prisma from "../../config/prisma.js";
import { can } from "../../config/access.js";
import { audit } from "../../lib/audit.js";
import { dateRange, inTransaction } from "../../lib/crud.js";
import { badRequest, forbidden, ok } from "../../lib/http.js";
import { LOCATIONS, moveStock, stockSummary } from "../../lib/stock.js";
import { parseBody } from "../../lib/validate.js";

const router = express.Router();
const RESOURCE = { mva: "mvaStock", sales: "salesStock" };

const checkLocation = (req, action) => {
  const { location } = req.params;
  if (!LOCATIONS.includes(location)) throw badRequest("Location must be mva or sales");
  if (!can(req.user, RESOURCE[location], action)) throw forbidden();
  return location;
};

router.get("/:location", async (req, res) => {
  const location = checkLocation(req, "read");
  ok(res, await stockSummary(prisma, location));
});

router.get("/:location/movements", async (req, res) => {
  const location = checkLocation(req, "read");
  const rows = await prisma.stockMovement.findMany({
    where: { location, ...dateRange("date", req.query), ...(req.query.productId ? { productId: req.query.productId } : {}) },
    include: { product: { select: { code: true, name: true, unit: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: Math.min(Number(req.query.limit) || 500, 2000),
  });
  ok(res, rows);
});

// Correct stock after a physical count. Head of department only.
router.post("/:location/adjustments", async (req, res) => {
  const location = checkLocation(req, "adjust");
  const data = parseBody({ productId: "id!", quantity: "signed!", date: "date!", reason: "text!" }, req.body);
  if (data.quantity === 0) throw badRequest("Enter a quantity to add (positive) or remove (negative)");
  const movement = await inTransaction(async (tx) => {
    const created = await moveStock(tx, {
      productId: data.productId,
      location,
      quantity: data.quantity,
      movementType: "adjustment",
      date: data.date,
      notes: data.reason,
    });
    await audit(tx, { user: req.user, action: "stock_adjustment", entity: "stockMovement", entityId: created.id, after: created });
    return created;
  });
  ok(res, movement, 201);
});

export default router;
