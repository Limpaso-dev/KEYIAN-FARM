import express from "express";
import prisma from "../../config/prisma.js";
import { canReadReport, requisitionRules } from "../../config/access.js";
import { OPTIONS, optionValues } from "../../config/catalog.js";
import { ok } from "../../lib/http.js";
import { toDate } from "../../lib/validate.js";
import { BUILDERS } from "../reports/builders.js";

const router = express.Router();

// Reference lists for drop-downs.
router.get("/meta", (req, res) => ok(res, OPTIONS));

// Today's headline figures for the departments this user can see.
router.get("/dashboard", async (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  const day = toDate(date);
  const departments = req.user.department
    ? [req.user.department]
    : optionValues("departments").filter((d) => canReadReport(req.user, d));

  const cards = [];
  for (const department of departments) {
    const report = await BUILDERS[department](prisma, day);
    cards.push({ department, title: report.title, summary: report.summary });
  }

  const [toDecide, mine, approvedToFulfil] = await Promise.all([
    requisitionRules.canDecide(req.user)
      ? prisma.requisition.count({ where: { status: "pending", requestedById: { not: req.user.id } } })
      : 0,
    req.user.department
      ? prisma.requisition.groupBy({ by: ["status"], where: { department: req.user.department, status: { in: ["pending", "returned", "approved"] } }, _count: true })
      : [],
    requisitionRules.canFulfil(req.user) ? prisma.requisition.count({ where: { status: "approved" } }) : 0,
  ]);

  ok(res, {
    date,
    cards,
    requisitions: {
      toDecide,
      toFulfil: approvedToFulfil,
      department: Object.fromEntries(mine.map((row) => [row.status, row._count])),
    },
  });
});

export default router;
