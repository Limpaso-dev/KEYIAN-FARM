export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const forbidden = (message = "You are not allowed to do this") => new HttpError(403, message);
export const notFound = (what = "Record") => new HttpError(404, `${what} not found`);
export const conflict = (message) => new HttpError(409, message);

/** Send `{ success: true, data }` with Decimals converted to numbers. */
export const ok = (res, data, status = 200, extra = {}) =>
  res.status(status).json({ success: true, ...extra, data: plain(data) });

/** Convert Prisma results (Decimal, nested) into JSON-friendly values. */
export const plain = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (typeof value.toNumber === "function" && typeof value.toFixed === "function") return value.toNumber();
    const out = {};
    for (const [key, inner] of Object.entries(value)) out[key] = plain(inner);
    return out;
  }
  return value;
};
