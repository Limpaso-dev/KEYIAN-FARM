import express from "express";
import prisma from "../../config/prisma.js";
import { canReadReport } from "../../config/access.js";
import { optionValues } from "../../config/catalog.js";
import { badRequest, forbidden, ok } from "../../lib/http.js";
import { toDate } from "../../lib/validate.js";
import { BUILDERS } from "./builders.js";
import { toCsv, toPdf } from "./render.js";

const router = express.Router();
const ORGANISATION = "Keiyian Farmers Cooperative Society";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * GET /api/reports/daily?department=mva&date=2026-11-06&format=json|csv|pdf
 * department=all combines every department the user may see.
 */
router.get("/daily", async (req, res) => {
  const date = String(req.query.date || today());
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? toDate(date) : null;
  if (!day) throw badRequest("Date must be in the form YYYY-MM-DD");
  const format = String(req.query.format || "json");
  if (!["json", "csv", "pdf"].includes(format)) throw badRequest("Format must be json, csv or pdf");

  const requested = String(req.query.department || req.user.department || "");
  const departments = requested === "all"
    ? optionValues("departments").filter((d) => canReadReport(req.user, d))
    : [requested];
  if (!departments.length || departments.some((d) => !BUILDERS[d])) throw badRequest("Choose a department");
  if (departments.some((d) => !canReadReport(req.user, d))) throw forbidden("You can only view your own department's report");

  const reports = [];
  for (const department of departments) reports.push({ department, ...(await BUILDERS[department](prisma, day)) });

  const fileBase = `keiyian-${requested}-eod-${date}`;
  const meta = { date, organisation: ORGANISATION, preparedBy: `${req.user.name}` };
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    return res.send(toCsv(reports, meta));
  }
  if (format === "pdf") {
    const pdf = await toPdf(reports, meta);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.pdf"`);
    return res.send(pdf);
  }
  return ok(res, { date, reports });
});

export default router;
