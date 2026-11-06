import { badRequest } from "./http.js";
import { optionValues } from "../config/catalog.js";

// Field specs are short strings:
//   "string" "text" "int" "decimal" "date" "bool" "id"
//   "option:<listName>"  value must be in OPTIONS[listName]
// Append "!" for required, e.g. "decimal!" or "option:cropTypes!".

const parseSpec = (spec) => {
  const required = spec.endsWith("!");
  const body = required ? spec.slice(0, -1) : spec;
  const [type, list] = body.split(":");
  return { type, list, required };
};

const isBlank = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** Parse "YYYY-MM-DD" or an ISO string into a Date at UTC midnight-safe value. */
export const toDate = (value) => {
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00.000Z`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const convert = (name, value, { type, list }) => {
  switch (type) {
    case "string":
    case "text":
    case "id":
      return String(value).trim();
    case "int": {
      const number = Number(value);
      if (!Number.isInteger(number)) throw `${name} must be a whole number`;
      return number;
    }
    case "decimal": {
      const number = Number(value);
      if (!Number.isFinite(number)) throw `${name} must be a number`;
      if (number < 0) throw `${name} cannot be negative`;
      return number;
    }
    case "signed": {
      const number = Number(value);
      if (!Number.isFinite(number)) throw `${name} must be a number`;
      return number;
    }
    case "date": {
      const date = toDate(value);
      if (!date) throw `${name} must be a valid date`;
      return date;
    }
    case "bool":
      if (typeof value === "boolean") return value;
      if (["true", "false"].includes(value)) return value === "true";
      throw `${name} must be true or false`;
    case "option": {
      const text = String(value).trim();
      if (!optionValues(list).includes(text)) throw `${name} has an invalid value "${text}"`;
      return text;
    }
    default:
      throw new Error(`Unknown field type ${type}`);
  }
};

/**
 * Validate `body` against `fields` ({ name: spec }).
 * partial: true for updates - missing fields are left alone.
 * Returns only known fields, converted. Blank optional values become null.
 */
export const parseBody = (fields, body = {}, { partial = false } = {}) => {
  const data = {};
  const errors = [];
  for (const [name, spec] of Object.entries(fields)) {
    const parsed = parseSpec(spec);
    const present = Object.hasOwn(body, name);
    if (partial && !present) continue;
    const value = body[name];
    if (isBlank(value)) {
      if (parsed.required) errors.push(`${name} is required`);
      else if (present) data[name] = null;
      continue;
    }
    try {
      data[name] = convert(name, value, parsed);
    } catch (message) {
      errors.push(typeof message === "string" ? message : message.message);
    }
  }
  if (errors.length) throw badRequest(errors.join("; "), errors);
  return data;
};

/** Validate an array of line items with the same spec format. */
export const parseItems = (items, fields, { min = 1, label = "items" } = {}) => {
  if (!Array.isArray(items) || items.length < min) throw badRequest(`Add at least ${min} line in ${label}`);
  return items.map((item, index) => {
    try {
      return parseBody(fields, item);
    } catch (error) {
      throw badRequest(`Line ${index + 1}: ${error.message}`);
    }
  });
};

export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
