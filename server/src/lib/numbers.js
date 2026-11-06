// Human-readable document numbers: PREFIX-YYYY-0001. Counters live in the
// Sequence table and are incremented atomically inside the caller's
// transaction, so two clerks never get the same number.

export const nextNumber = async (tx, prefix, date = new Date()) => {
  const year = new Date(date).getUTCFullYear();
  const key = `${prefix}-${year}`;
  const [row] = await tx.$queryRaw`
    INSERT INTO "Sequence" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Sequence"."value" + 1
    RETURNING "value"`;
  return `${key}-${String(row.value).padStart(4, "0")}`;
};

/** Simple running code without a year, e.g. EMP-0007. */
export const nextCode = async (tx, prefix) => {
  const [row] = await tx.$queryRaw`
    INSERT INTO "Sequence" ("key", "value") VALUES (${prefix}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Sequence"."value" + 1
    RETURNING "value"`;
  return `${prefix}-${String(row.value).padStart(4, "0")}`;
};
