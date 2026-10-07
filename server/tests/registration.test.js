import test from "node:test";
import assert from "node:assert/strict";

import {
  findPossibleDuplicates,
  generatePatientNumber,
  normalizePatientRegistration,
} from "../src/utils/patientRegistration.js";

test("generatePatientNumber creates a unique MRN pattern", () => {
  const number = generatePatientNumber();

  assert.match(number, /^P-/);
  assert.ok(number.length >= 10);
});

test("normalizePatientRegistration trims and validates required fields", () => {
  const patient = normalizePatientRegistration({
    firstName: "  Jane  ",
    lastName: " Doe ",
    phone: "0712345678",
    sex: "female",
    address: " Nairobi ",
    consentAcknowledged: true,
    dateOfBirth: "1990-01-01",
  });

  assert.equal(patient.firstName, "Jane");
  assert.equal(patient.lastName, "Doe");
  assert.equal(patient.phone, "0712345678");
  assert.equal(patient.address, "Nairobi");
  assert.equal(patient.consentAcknowledged, true);
});

test("findPossibleDuplicates flags a likely duplicate by phone and name", () => {
  const duplicates = findPossibleDuplicates(
    [
      {
        firstName: "Jane",
        lastName: "Doe",
        phone: "0712345678",
        nationalId: "12345678",
      },
    ],
    {
      firstName: "Jane",
      lastName: "Doe",
      phone: "0712345678",
      nationalId: "99999999",
    }
  );

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].lastName, "Doe");
});
