import test from "node:test";
import assert from "node:assert/strict";

import { authorizeHMIS } from "../src/middleware/role.middleware.js";

const authorize = (role, action) => {
  let statusCode = 200;
  let passed = false;
  const req = { user: { role } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  authorizeHMIS(action)(req, res, () => {
    passed = true;
  });

  return { statusCode, passed };
};

test("HMIS access separates doctor, pharmacy, laboratory, and cashier actions", () => {
  assert.equal(authorize("doctor", "prescriptionsCreate").passed, true);
  assert.equal(authorize("pharmacist", "prescriptionsCreate").statusCode, 403);
  assert.equal(authorize("pharmacist", "prescriptionsUpdate").passed, true);
  assert.equal(authorize("laboratory", "labWrite").passed, true);
  assert.equal(authorize("laboratory", "patientsRead").statusCode, 403);
  assert.equal(authorize("nurse", "patientsCreate").statusCode, 403);
  assert.equal(authorize("nurse", "visitsCreate").statusCode, 403);
  assert.equal(authorize("nurse", "visitsClinicalActions").statusCode, 403);
  assert.equal(authorize("cashier", "billsPay").passed, true);
  assert.equal(authorize("cashier", "billsCreate").statusCode, 403);
  assert.equal(authorize("receptionist", "visitsRead").passed, true);
  assert.equal(authorize("admin", "adminOnly").passed, true);
});
