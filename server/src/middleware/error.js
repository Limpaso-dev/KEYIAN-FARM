const PRISMA_ERRORS = {
  P2000: [400, "A value is too long"],
  P2002: [409, "A record with this value already exists"],
  P2003: [409, "This record is linked to other records and cannot be changed this way"],
  P2025: [404, "Record not found"],
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const prisma = PRISMA_ERRORS[err.code];
  let status = err.status || err.statusCode || prisma?.[0] || 500;
  let message = err.status ? err.message : prisma?.[1] || "Something went wrong on the server";

  if (err.code === "P2002") {
    const target = err.meta?.target || err.meta?.driverAdapterError?.cause?.constraint?.fields;
    if (target) message = `A record with this ${[].concat(target).join(", ")} already exists`;
  }
  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "The request body is not valid JSON";
  }
  if (status >= 500) console.error(err);

  res.status(status).json({ success: false, message, ...(err.details ? { details: err.details } : {}) });
};
