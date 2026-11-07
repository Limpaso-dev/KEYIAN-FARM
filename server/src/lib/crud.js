import express from "express";
import prisma from "../config/prisma.js";
import { allow } from "../middleware/auth.js";
import { audit } from "./audit.js";
import { notFound, ok } from "./http.js";
import { nextCode, nextNumber } from "./numbers.js";
import { parseBody, toDate } from "./validate.js";

/** where-clause for ?from=YYYY-MM-DD&to=YYYY-MM-DD on a date column. */
export const dateRange = (field, { from, to } = {}) => {
  const range = {};
  const start = from && toDate(from);
  const end = to && toDate(to);
  if (start) range.gte = start;
  if (end) range.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return Object.keys(range).length ? { [field]: range } : {};
};

/** Read list filters from the query string. */
export const listQuery = (query, { search = [], dateField, filters = [] } = {}) => {
  const where = { ...(dateField ? dateRange(dateField, query) : {}) };
  for (const name of filters) {
    const value = query[name];
    if (value === undefined || value === "") continue;
    where[name] = value === "true" ? true : value === "false" ? false : value;
  }
  const term = String(query.search || "").trim();
  if (term && search.length) {
    where.OR = search.map((field) => ({ [field]: { contains: term, mode: "insensitive" } }));
  }
  const take = Math.min(Math.max(Number(query.limit) || 500, 1), 2000);
  return { where, take };
};

/**
 * Build a router with list/get/create/update/delete for one Prisma model.
 *
 * options:
 *   resource   permission key in config/access.js
 *   model      Prisma delegate name, e.g. "employee"
 *   fields     validation spec for create (see lib/validate.js)
 *   updateFields  spec for updates (defaults to fields)
 *   include, orderBy, search, dateField, filters
 *   numbering  { field, prefix, yearly }  generated when left blank
 *   prepare(data, { req, tx, existing })  adjust/validate before write
 *   afterWrite(record, { req, tx, existing, action })
 *   create/update/remove  set false to disable
 *   router     an existing router to add routes to
 */
export const crud = (options) => {
  const {
    resource,
    model,
    fields,
    updateFields = fields,
    include,
    orderBy = { createdAt: "desc" },
    search,
    dateField,
    filters,
    numbering,
    prepare,
    afterWrite,
    beforeDelete,
    create = true,
    update = true,
    remove = true,
    router = express.Router(),
  } = options;

  const label = options.label || model;

  router.get("/", allow(resource, "read"), async (req, res) => {
    const { where, take } = listQuery(req.query, { search, dateField, filters });
    const rows = await prisma[model].findMany({ where, include, orderBy, take });
    ok(res, rows, 200, { count: rows.length });
  });

  router.get("/:id", allow(resource, "read"), async (req, res) => {
    const row = await prisma[model].findUnique({ where: { id: req.params.id }, include });
    if (!row) throw notFound(label);
    ok(res, row);
  });

  if (create) {
    router.post("/", allow(resource, "write"), async (req, res) => {
      const data = parseBody(fields, req.body);
      const record = await prisma.$transaction(async (tx) => {
        if (numbering && !data[numbering.field]) {
          data[numbering.field] = numbering.yearly === false
            ? await nextCode(tx, numbering.prefix)
            : await nextNumber(tx, numbering.prefix, data[dateField] || new Date());
        }
        const prepared = prepare ? (await prepare(data, { req, tx })) ?? data : data;
        const created = await tx[model].create({ data: prepared, include });
        if (afterWrite) await afterWrite(created, { req, tx, action: "create" });
        await audit(tx, { user: req.user, action: "create", entity: model, entityId: created.id, after: created });
        return created;
      });
      ok(res, record, 201);
    });
  }

  if (update) {
    router.put("/:id", allow(resource, "write"), async (req, res) => {
      const data = parseBody(updateFields, req.body, { partial: true });
      const record = await prisma.$transaction(async (tx) => {
        const existing = await tx[model].findUnique({ where: { id: req.params.id } });
        if (!existing) throw notFound(label);
        const prepared = prepare ? (await prepare(data, { req, tx, existing })) ?? data : data;
        const updated = await tx[model].update({ where: { id: existing.id }, data: prepared, include });
        if (afterWrite) await afterWrite(updated, { req, tx, existing, action: "update" });
        await audit(tx, { user: req.user, action: "update", entity: model, entityId: existing.id, before: existing, after: updated });
        return updated;
      });
      ok(res, record);
    });
  }

  if (remove) {
    router.delete("/:id", allow(resource, "delete"), async (req, res) => {
      await prisma.$transaction(async (tx) => {
        const existing = await tx[model].findUnique({ where: { id: req.params.id } });
        if (!existing) throw notFound(label);
        if (beforeDelete) await beforeDelete(existing, { req, tx });
        await tx[model].delete({ where: { id: existing.id } });
        await audit(tx, { user: req.user, action: "delete", entity: model, entityId: existing.id, before: existing });
      });
      ok(res, { id: req.params.id });
    });
  }

  return router;
};

/** Small helper for one-off transactional endpoints with an audit row. */
export const inTransaction = (work) => prisma.$transaction(work, { timeout: 20000 });
