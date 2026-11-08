import express from "express";
import prisma from "../../config/prisma.js";
import { canReadReport } from "../../config/access.js";
import { optionValues } from "../../config/catalog.js";
import { badRequest, forbidden, ok } from "../../lib/http.js";
import { periodInfo, resolvePeriod } from "../../lib/periods.js";
import { BUILDERS } from "./builders.js";
import { MOTTO, ORGANISATION, toCsv, toPdf } from "./render.js";

const router = express.Router();

/**
 * Department reports for any period.
 *
 * GET /api/reports/department?department=sales&period=month&date=2026-11-01&format=json|csv|pdf
 *   period: day (default) | week | fortnight | month | quarter | half | year | custom
 *   date:   any day inside the period (today when left out)
 *   from, to: for period=custom
 * department=all combines every department the user may see.
 * /api/reports/daily is the same report (it defaults to a single day).
 */
const departmentReport = async (req, res) => {
  const range = resolvePeriod({ period: "day", ...req.query });
  const format = String(req.query.format || "json");
  if (!["json", "csv", "pdf"].includes(format)) throw badRequest("Format must be json, csv or pdf");

  const requested = String(req.query.department || req.user.department || "");
  const departments = requested === "all"
    ? optionValues("departments").filter((d) => canReadReport(req.user, d))
    : [requested];
  if (!departments.length || departments.some((d) => !BUILDERS[d])) throw badRequest("Choose a department");
  if (departments.some((d) => !canReadReport(req.user, d))) throw forbidden("You can only view your own department's report");

  const reports = [];
  for (const department of departments) {
    const report = await BUILDERS[department](prisma, range);
    reports.push({ department, ...report, heading: `${report.title} report - ${range.label}` });
  }

  const generatedAt = new Date().toISOString();
  const meta = { organisation: ORGANISATION, motto: MOTTO, generatedBy: req.user.name, generatedAt };
  const fileBase = `keiyian-${requested}-report-${range.slug}`;
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
  return ok(res, { ...meta, period: periodInfo(range), reports });
};

router.get("/department", departmentReport);
router.get("/daily", departmentReport);

export default router;
