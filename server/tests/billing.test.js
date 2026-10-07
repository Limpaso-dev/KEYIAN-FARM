import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateBillBalance,
  normalizeBillStatus,
} from "../src/utils/billing.js";

test("calculateBillBalance returns the remaining patient balance", () => {
  assert.equal(calculateBillBalance({ totalAmount: 5000, amountPaid: 1500 }), 3500);
});

test("normalizeBillStatus maps payment state to a valid HMIS billing state", () => {
  assert.equal(normalizeBillStatus({ totalAmount: 5000, amountPaid: 0, currentStatus: "approved" }), "approved");
  assert.equal(normalizeBillStatus({ totalAmount: 5000, amountPaid: 3000, currentStatus: "approved" }), "partially_paid");
  assert.equal(normalizeBillStatus({ totalAmount: 5000, amountPaid: 5000, currentStatus: "partially_paid" }), "paid");
});
