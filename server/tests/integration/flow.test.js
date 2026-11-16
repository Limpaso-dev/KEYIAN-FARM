// End-to-end test of every department's workflow through the real API.
//
//   TEST_DATABASE_URL=postgresql://... npm run test:integration
//
// The database must be EMPTY and migrated (npx prisma migrate deploy).
// It is never run against DATABASE_URL.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("integration tests skipped (set TEST_DATABASE_URL)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET ||= "integration-test-secret-integration-test-secret";

  const { default: app } = await import("../../src/app.js");
  const { default: prisma } = await import("../../src/config/prisma.js");
  const { ensureReferenceData } = await import("../../src/lib/referenceData.js");
  const bcrypt = (await import("bcryptjs")).default;

  let server;
  let base;
  const tokens = {};
  const today = new Date().toISOString().slice(0, 10);

  const call = async (who, method, path, body, { expect = [200, 201], raw = false } = {}) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(tokens[who] ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (raw) return response;
    const json = await response.json();
    const allowed = [].concat(expect);
    assert.ok(allowed.includes(response.status), `${method} ${path} as ${who}: expected ${allowed}, got ${response.status} ${json.message}`);
    return json.data ?? json;
  };

  before(async () => {
    const existing = await prisma.user.count();
    if (existing) throw new Error("TEST_DATABASE_URL must point at an empty database");
    await ensureReferenceData(prisma);
    await prisma.user.create({
      data: { name: "Root", email: "root@test.local", role: "super_admin", password: await bcrypt.hash("RootPass123", 4), mustChangePassword: false },
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
    tokens.root = (await call(null, "POST", "/auth/login", { email: "root@test.local", password: "RootPass123" })).token;
  });

  after(async () => {
    server?.close();
    await prisma.$disconnect();
  });

  const people = {
    gm: ["general_manager", null],
    hrHead: ["head", "hr"],
    livestock: ["officer", "livestock"],
    mva: ["officer", "mva"],
    mvaHead: ["head", "mva"],
    sales: ["officer", "sales"],
    stores: ["officer", "stores"],
    crops: ["officer", "crops"],
    accHead: ["head", "accounts"],
    accounts: ["officer", "accounts"],
  };

  test("admin creates accounts; users must change temporary passwords", async () => {
    for (const [key, [role, department]] of Object.entries(people)) {
      const created = await call("root", "POST", "/auth/users", { name: key, email: `${key}@test.local`, role, department });
      assert.match(created.temporaryPassword, /^Kfc-/);
      const login = await call(null, "POST", "/auth/login", { email: `${key}@test.local`, password: created.temporaryPassword });
      tokens[key] = login.token;
      assert.equal(login.user.mustChangePassword, true);
      await call(key, "GET", "/dashboard", null, { expect: 428 });
      await call(key, "POST", "/auth/change-password", { currentPassword: created.temporaryPassword, newPassword: "BetterPass2026" });
    }
    await call("root", "POST", "/auth/users", { name: "Bad", email: "bad@test.local", role: "officer" }, { expect: 400 });
    await call("hrHead", "GET", "/auth/users", null, { expect: 403 });
    const me = await call("livestock", "GET", "/auth/me");
    assert.equal(me.permissions.resources.animals.write, true);
    assert.equal(me.permissions.resources.employees.read, false);
  });

  test("permissions block other departments", async () => {
    await call("livestock", "POST", "/sales/vehicles", { registrationNumber: "X", driverName: "X", salesPersonName: "X" }, { expect: 403 });
    await call("crops", "GET", "/hr/employees", null, { expect: 403 });
    await call("gm", "POST", "/crops/farms", { farmNumber: "F", cropType: "tea", acreage: 1, location: "x" }, { expect: 403 });
    await call("gm", "GET", "/hr/employees");
  });

  let cashId;
  test("accounts: income, balances and voiding", async () => {
    const accounts = await call("accounts", "GET", "/accounts/accounts/balances");
    cashId = accounts.find((a) => a.name === "Cash on Hand").id;
    await call("accounts", "POST", "/accounts/transactions", { type: "income", category: "rentals", accountId: cashId, date: today, amount: 500000, description: "Shop rent" });
    await call("accounts", "POST", "/accounts/transactions", { type: "income", category: "salaries", accountId: cashId, date: today, amount: 1, description: "wrong" }, { expect: 400 });
    const wrong = await call("accounts", "POST", "/accounts/transactions", { type: "income", category: "coop_holding", accountId: cashId, date: today, amount: 10, description: "typo" });
    await call("accounts", "POST", `/accounts/transactions/${wrong.id}/void`, { reason: "typo" }, { expect: 403 });
    await call("accHead", "POST", `/accounts/transactions/${wrong.id}/void`, { reason: "typo" });
    await call("accounts", "POST", "/accounts/transactions", { type: "expense", category: "electricity", accountId: cashId, date: today, amount: 9_000_000, description: "too much" }, { expect: 409 });
    const after = await call("accounts", "GET", "/accounts/accounts/balances");
    assert.equal(after.find((a) => a.id === cashId).balance, 500000);
  });

  const registration = (overrides = {}) => ({
    firstName: "Mary", lastName: "Wanjiku", department: "sales", jobTitle: "Sales clerk", jobGroup: "G4", employmentType: "permanent",
    dateHired: today, basicSalary: 20000, nextOfKinName: "Peter Wanjiku", nextOfKinNationalId: "12345678", nextOfKinPhone: "0700000001", dependants: 3,
    contractType: "permanent", contractStart: today, ...overrides,
  });

  test("HR: staff, contract, promotion, payroll to Finance, discipline, members, termination", async () => {
    // Registration captures job group, next of kin, dependants and the first contract.
    await call("hrHead", "POST", "/hr/employees", registration({ jobGroup: "" }), { expect: 400 });
    await call("hrHead", "POST", "/hr/employees", registration({ nextOfKinNationalId: "" }), { expect: 400 });
    await call("hrHead", "POST", "/hr/employees", registration({ dependants: -1 }), { expect: 400 });
    await call("hrHead", "POST", "/hr/employees", registration({ contractType: "" }), { expect: 400 });
    await call("hrHead", "POST", "/hr/employees", registration({ contractType: "fixed_term" }), { expect: 400 });
    const employee = await call("hrHead", "POST", "/hr/employees", registration());
    assert.equal(employee.staffNumber, "EMP-0001");
    assert.equal(employee.dependants, 3);
    const [firstContract] = await call("hrHead", "GET", `/hr/contracts?employeeId=${employee.id}`);
    assert.equal(firstContract.salary, 20000);
    assert.equal(firstContract.status, "active");
    assert.equal(firstContract.contractType, "permanent");

    // Generating the month sends it straight to Finance.
    const period = today.slice(0, 7);
    await call("hrHead", "POST", "/hr/payroll/generate", { period });
    const [line] = await call("accounts", "GET", `/hr/payroll?status=with_finance&period=${period}`);
    assert.equal(line.employeeId, employee.id);
    await call("hrHead", "PUT", `/hr/payroll/${line.id}`, { allowances: 2000, deductions: 1000 });

    // A salary review reaches the staff record, the contract and unpaid payroll.
    await call("hrHead", "POST", "/hr/salary-reviews", { employeeId: employee.id, reviewType: "promotion", effectiveDate: "2099-01-01", newSalary: 90000, reason: "Too early" }, { expect: 400 });
    await call("hrHead", "POST", "/hr/salary-reviews", { employeeId: employee.id, reviewType: "promotion", effectiveDate: today, newSalary: 25000, newJobTitle: "Senior clerk", newJobGroup: "G5", reason: "Good work" });
    const promoted = await call("hrHead", "GET", `/hr/employees/${employee.id}`);
    assert.equal(promoted.basicSalary, 25000);
    assert.equal(promoted.jobTitle, "Senior clerk");
    assert.equal(promoted.jobGroup, "G5");
    assert.equal((await call("hrHead", "GET", `/hr/contracts/${firstContract.id}`)).salary, 25000);
    const repriced = await call("hrHead", "GET", `/hr/payroll/${line.id}`);
    assert.equal(repriced.basicSalary, 25000);
    assert.equal(repriced.netPay, 26000);

    const paid = await call("accounts", "POST", `/hr/payroll/${line.id}/pay`, { accountId: cashId, date: today });
    assert.equal(paid.status, "paid");
    assert.equal(paid.netPay, 26000);
    await call("accounts", "POST", `/hr/payroll/${line.id}/pay`, { accountId: cashId, date: today }, { expect: 409 });
    await call("hrHead", "PUT", `/hr/payroll/${line.id}`, { allowances: 1 }, { expect: 409 });
    await call("hrHead", "POST", "/hr/salary-reviews", { employeeId: employee.id, reviewType: "adjustment", effectiveDate: today, newSalary: 27000, reason: "Paid payroll stays as it was" });
    assert.equal((await call("hrHead", "GET", `/hr/payroll/${line.id}`)).netPay, 26000);

    // Contracts are renewed from the profile; the old one is marked renewed.
    await call("hrHead", "POST", "/hr/contracts", { employeeId: employee.id, contractType: "fixed_term", startDate: today }, { expect: 400 });
    const renewed = await call("hrHead", "POST", "/hr/contracts", { employeeId: employee.id, contractType: "fixed_term", startDate: today, endDate: "2030-12-31" });
    assert.equal(renewed.salary, 27000);
    assert.equal((await call("hrHead", "GET", `/hr/contracts/${firstContract.id}`)).status, "renewed");
    const corrected = await call("hrHead", "PUT", `/hr/contracts/${renewed.id}`, { endDate: "2031-06-30", salary: 1 });
    assert.equal(corrected.salary, 27000);

    const profile = await call("gm", "GET", `/hr/employees/${employee.id}/profile`);
    assert.equal(profile.nextOfKinName, "Peter Wanjiku");
    assert.equal(profile.nextOfKinNationalId, "12345678");
    assert.equal(profile.jobGroup, "G5");
    assert.equal(profile.contracts.length, 2);
    assert.equal(profile.salaryReviews.length, 2);
    assert.equal(profile.salaryReviews[0].previousJobGroup, "G5");
    assert.equal(profile.payrolls.length, 1);
    await call("accounts", "GET", `/hr/employees/${employee.id}/profile`, null, { expect: 403 });

    await call("hrHead", "POST", "/hr/disciplinary", { employeeId: employee.id, incidentDate: today, offence: "Late", actionTaken: "warning_letter", letterServed: true });
    const summary = await call("hrHead", "GET", "/hr/disciplinary/summary");
    assert.equal(summary.totals.lettersServed, 1);

    const pioneer = await call("hrHead", "POST", "/hr/members", { memberNumber: "P001", firstName: "Kipkemoi", lastName: "Arap", joinDate: "1975-01-01", shares: 40 });
    const handover = { firstName: "Daniel", lastName: "Kipkemoi", relationship: "Son", successionDate: today };
    await call("hrHead", "POST", `/hr/members/${pioneer.id}/succession`, handover, { expect: 400 });
    await call("hrHead", "POST", `/hr/members/${pioneer.id}/succession`, { ...handover, successionReason: "other" }, { expect: 400 });
    const heir = await call("hrHead", "POST", `/hr/members/${pioneer.id}/succession`, { ...handover, successionReason: "death" });
    await call("hrHead", "POST", `/hr/members/${pioneer.id}/succession`, { ...handover, firstName: "Again", successionReason: "death" }, { expect: 409 });
    assert.equal((await call("hrHead", "GET", `/hr/members/${pioneer.id}`)).status, "deceased");
    const grandchild = await call("hrHead", "POST", `/hr/members/${heir.id}/succession`, { firstName: "Ann", lastName: "Kipkemoi", relationship: "Daughter", successionDate: today, successionReason: "other", successionReasonOther: "Moved abroad" });
    const { id: tomId } = await call("hrHead", "POST", `/hr/members/${grandchild.id}/succession`, { firstName: "Tom", lastName: "Kipkemoi", relationship: "Son", successionDate: today, successionReason: "old_age" });
    assert.equal((await call("hrHead", "GET", `/hr/members/${grandchild.id}`)).status, "succeeded");
    const register = await call("hrHead", "GET", "/hr/members/successions");
    assert.equal(register.length, 3);
    const first = register.find((row) => row.id === heir.id);
    assert.equal(first.predecessor.memberNumber, "P001");
    assert.equal(first.successionReason, "death");
    assert.equal(register.find((row) => row.id === grandchild.id).successionReasonOther, "Moved abroad");
    assert.equal((await call("hrHead", "GET", "/hr/members/successions?successionReason=old_age")).length, 1);
    assert.equal(heir.shares, 40);
    assert.equal(heir.memberNumber, "P001-1");
    const lineage = await call("hrHead", "GET", `/hr/members/${heir.id}/lineage`);
    assert.equal(lineage.successors[0].memberNumber, "P001-1");
    await call("accounts", "POST", "/accounts/member-payments", { memberId: pioneer.id, date: today, paymentType: "dividend", amount: 100, accountId: cashId }, { expect: 409 });
    await call("accounts", "POST", "/accounts/member-payments", { memberId: tomId, date: today, paymentType: "dividend", amount: 4000, accountId: cashId });
    // Accounts reads what paying salaries and members needs - not the rest of HR.
    assert.ok((await call("accounts", "GET", "/hr/payroll")).length >= 1);
    assert.ok((await call("accounts", "GET", "/hr/members")).length >= 2);
    await call("accounts", "GET", "/hr/employees", null, { expect: 403 });
    await call("accounts", "GET", "/hr/disciplinary", null, { expect: 403 });

    const userForEmployee = await call("root", "POST", "/auth/users", { name: "Mary", email: "mary@test.local", role: "officer", department: "sales", employeeId: employee.id });
    await call("hrHead", "POST", "/hr/terminations", { employeeId: employee.id, terminationType: "resignation", terminationDate: today, reason: "Moved" });
    const users = await call("root", "GET", "/auth/users");
    assert.equal(users.find((u) => u.id === userForEmployee.user.id).isActive, false);
    assert.equal((await call("hrHead", "GET", `/hr/employees/${employee.id}`)).status, "resigned");
  });

  test("HR: staff establishment, from job advert through interviews to hire", async () => {
    await call("sales", "GET", "/hr/job-adverts", null, { expect: 403 });
    await call("hrHead", "POST", "/hr/job-adverts", { jobTitle: "Milk technician", department: "mva", employmentType: "permanent", posts: 0, advertDate: today }, { expect: 400 });
    const advert = await call("hrHead", "POST", "/hr/job-adverts", { jobTitle: "Milk technician", department: "mva", jobGroup: "G3", employmentType: "permanent", posts: 1, advertDate: today });
    assert.match(advert.advertNumber, /^ADV-\d{4}-0001$/);
    assert.equal(advert.status, "open");

    const apply = (firstName, nationalId) => call("hrHead", "POST", "/hr/job-applicants", { advertId: advert.id, firstName, lastName: "Applicant", nationalId, phone: "0711000000", appliedOn: today });
    const anna = await apply("Anna", "33000001");
    const ben = await apply("Ben", "33000002");
    const cara = await apply("Cara", "33000003");
    assert.equal(anna.stage, "applied");

    // Steps cannot be skipped.
    const step = (id, name, body = {}, options) => call("hrHead", "POST", `/hr/job-applicants/${id}/${name}`, body, options);
    const hire = registration({ firstName: "Anna", lastName: "Applicant", nationalId: "33000001", department: "mva", jobTitle: "Milk technician", jobGroup: "G3" });
    await step(anna.id, "hire", hire, { expect: 409 });
    await step(anna.id, "interview-result", { result: "passed" }, { expect: 409 });
    await step(anna.id, "shortlist");
    await step(anna.id, "shortlist", {}, { expect: 409 });
    await step(anna.id, "schedule-interview", {}, { expect: 400 });
    await step(anna.id, "schedule-interview", { interviewDate: today, interviewPanel: "Head of HR, Head of MVA" });
    await step(anna.id, "hire", hire, { expect: 409 });
    await step(anna.id, "interview-result", { result: "passed", interviewScore: 120 }, { expect: 400 });
    assert.equal((await step(anna.id, "interview-result", { result: "passed", interviewScore: 78.5, interviewNotes: "Strong" })).stage, "passed");

    await step(ben.id, "shortlist");
    await step(ben.id, "schedule-interview", { interviewDate: today });
    assert.equal((await step(ben.id, "interview-result", { result: "failed" })).stage, "rejected");
    await step(cara.id, "reject", {}, { expect: 400 });
    assert.equal((await step(cara.id, "reject", { rejectionReason: "Lacks the qualification" })).stage, "rejected");

    await step(anna.id, "hire", { ...hire, nextOfKinPhone: "" }, { expect: 400 });
    const staffMember = await step(anna.id, "hire", hire);
    assert.equal(staffMember.jobTitle, "Milk technician");
    assert.equal(staffMember.status, "active");

    const filled = await call("hrHead", "GET", `/hr/job-adverts/${advert.id}`);
    assert.equal(filled.status, "filled");
    assert.equal(filled.applicants.filter((a) => a.stage === "hired").length, 1);
    const profile = await call("hrHead", "GET", `/hr/employees/${staffMember.id}/profile`);
    assert.equal(profile.applicant.advert.advertNumber, advert.advertNumber);
    assert.equal(profile.applicant.interviewScore, 78.5);
    assert.equal(profile.contracts.length, 1);
    await call("hrHead", "POST", "/hr/job-applicants", { advertId: advert.id, firstName: "Late", lastName: "Applicant", phone: "0711000000", appliedOn: today }, { expect: 409 });
    await call("hrHead", "DELETE", `/hr/job-adverts/${advert.id}`, null, { expect: 409 });
    // Leave the reports below as they were.
    await call("hrHead", "POST", "/hr/terminations", { employeeId: staffMember.id, terminationType: "contract_end", terminationDate: today, reason: "End of test" });
  });

  let rawMilkId; let freshId; let malaId; let yoghurtId;
  test("livestock: dairies, calvings and twins, vaccines and diseases from lists, milk in kg, transfer to MVA", async () => {
    // Every female belongs to a dairy; a male is not kept in a dairy, whatever is sent.
    await call("livestock", "POST", "/livestock/animals", { tagNumber: "X", sex: "female" }, { expect: 400 });
    const cow = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-001", name: "Daisy", sex: "female", breed: "Friesian", dairy: "dairy_a" });
    const bull = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-B1", sex: "male", dairy: "dairy_a" });
    assert.equal(bull.dairy, null);
    const cCow = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-C1", sex: "female", dairy: "dairy_c" });
    // Made male, an animal leaves its dairy; made female again, she needs one.
    const steer = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-S1", sex: "male" });
    await call("livestock", "PUT", `/livestock/animals/${steer.id}`, { sex: "female" }, { expect: 400 });
    assert.equal((await call("livestock", "PUT", `/livestock/animals/${steer.id}`, { sex: "female", dairy: "dairy_c" })).dairy, "dairy_c");
    assert.equal((await call("livestock", "PUT", `/livestock/animals/${steer.id}`, { sex: "male" })).dairy, null);
    await call("root", "DELETE", `/livestock/animals/${steer.id}`);
    await call("livestock", "POST", "/livestock/animals", { tagNumber: "X", sex: "female", dairy: "dairy_a", damId: bull.id }, { expect: 400 });
    const { calf } = await call("livestock", "POST", "/livestock/calvings", { damId: cow.id, sireId: bull.id, calvingDate: today, calfTagNumber: "KE-002", calfSex: "female" });
    assert.deepEqual([calf.damId, calf.dairy], [cow.id, "dairy_a"]);
    assert.equal((await call("livestock", "GET", `/livestock/animals/${cow.id}`)).lactationCount, 1);

    // Twins: both calves join the register on the one calving; the heifer calf in her mother's dairy, the bull calf in none.
    const twins = { damId: cCow.id, sireDetails: "AI 123", calvingDate: today, calfTagNumber: "KE-C2", calfSex: "male", twins: true };
    await call("livestock", "POST", "/livestock/calvings", twins, { expect: 400 });
    await call("livestock", "POST", "/livestock/calvings", { ...twins, twinTagNumber: "ke-c2", twinSex: "female" }, { expect: 400 });
    await call("livestock", "POST", "/livestock/calvings", { ...twins, twinTagNumber: "ke-001", twinSex: "female" }, { expect: 409 });
    const born = await call("livestock", "POST", "/livestock/calvings", { ...twins, twinTagNumber: "KE-C3", twinSex: "female" });
    assert.deepEqual([born.calf.dairy, born.twin.dairy, born.twin.damId, born.twin.sireDetails, born.lactation.twinCalfId], [null, "dairy_c", cCow.id, "AI 123", born.twin.id]);
    const [twinCalving] = await call("livestock", "GET", `/livestock/lactations?animalId=${cCow.id}`);
    assert.deepEqual([twinCalving.calf.tagNumber, twinCalving.twinCalf.tagNumber, twinCalving.lactationNumber], ["KE-C2", "KE-C3", 1]);
    const single = (await call("livestock", "GET", `/livestock/lactations?animalId=${cow.id}`))[0];
    assert.deepEqual([single.calf.tagNumber, single.twinCalf], ["KE-002", null]);

    // Vaccines: FMD, LSD, Blanthax.
    const meta = await call("livestock", "GET", "/meta");
    assert.deepEqual(meta.vaccines.map((v) => v.label), ["FMD", "LSD", "Blanthax"]);
    await call("livestock", "POST", "/livestock/vaccinations", { animalId: cow.id, vaccine: "Rabies", date: today }, { expect: 400 });
    await call("livestock", "POST", "/livestock/vaccinations", { animalId: cow.id, vaccine: "fmd", date: today });

    // Diseases from the list (Other is written in the details); checks say what was done.
    assert.deepEqual(meta.diseases.map((d) => d.label), ["ECF", "Trypanosomiasis", "Mastitis", "Anaplasmosis", "Pneumonia", "Ephemeral fever", "Foot rot", "Injuries", "Retained afterbirth", "Abortions", "Pink eye", "Abscess", "Prolapse", "Other"]);
    await call("livestock", "POST", "/livestock/health-records", { recordType: "disease", date: today, animalId: cow.id }, { expect: 400 });
    await call("livestock", "POST", "/livestock/health-records", { recordType: "disease", date: today, animalId: cow.id, disease: "flu" }, { expect: 400 });
    await call("livestock", "POST", "/livestock/health-records", { recordType: "disease", date: today, animalId: cow.id, disease: "other" }, { expect: 400 });
    await call("livestock", "POST", "/livestock/health-records", { recordType: "treatment", date: today, animalId: cow.id }, { expect: 400 });
    const mastitis = await call("livestock", "POST", "/livestock/health-records", { recordType: "disease", date: today, animalId: cow.id, disease: "mastitis", treatment: "Intramammary tubes", cost: 800 });
    assert.deepEqual([mastitis.disease, mastitis.condition, mastitis.outcome], ["mastitis", null, "under_treatment"]);
    await call("livestock", "POST", "/livestock/health-records", { recordType: "herd_check", date: today }, { expect: 400 });
    const herdCheck = await call("livestock", "POST", "/livestock/health-records", { recordType: "herd_check", date: today, condition: "Routine check", disease: "ecf" });
    assert.equal(herdCheck.disease, null);
    assert.ok((await call("livestock", "GET", "/livestock/health-records?disease=mastitis")).every((h) => h.disease === "mastitis"));

    // Dairy A milks in the morning and evening, Dairy C also at midday; milk is weighed in kg.
    assert.deepEqual(meta.dairySessions, { dairy_a: ["morning", "evening"], dairy_c: ["morning", "midday", "evening"] });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, dairy: "dairy_a", session: "midday", records: [{ animalId: cow.id, kg: 5 }] }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, session: "morning", records: [{ animalId: cow.id, kg: 5 }] }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, dairy: "dairy_c", session: "morning", records: [{ animalId: cow.id, kg: 5 }] }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, dairy: "dairy_a", session: "morning", records: [{ animalId: bull.id, kg: 3 }] }, { expect: 400 });
    // Nothing recorded yet: no milk to send.
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", dairy: "dairy_a", kg: 5 }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, dairy: "dairy_a", session: "morning", records: [{ animalId: cow.id, kg: 52.5 }] });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, dairy: "dairy_c", session: "midday", records: [{ animalId: cCow.id, kg: 6 }] });
    const daily = await call("livestock", "GET", `/livestock/milk-records/daily?from=${today}&to=${today}`);
    assert.deepEqual(daily.map((d) => [d.dairy, d.session, d.kg]).sort(), [["dairy_a", "morning", 52.5], ["dairy_c", "midday", 6]]);
    assert.deepEqual((await call("livestock", "GET", "/livestock/milk-records?dairy=dairy_c")).map((m) => [m.animal.tagNumber, Number(m.kg)]), [["KE-C1", 6]]);

    // Milk sent to MVA, in kg, at a milking its dairy has.
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", kg: 50 }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "midday", dairy: "dairy_a", kg: 50 }, { expect: 400 });
    // Only milk recorded at that milking, and not sent yet, can be sent.
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", dairy: "dairy_a", kg: 53 }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "evening", dairy: "dairy_a", kg: 1 }, { expect: 400 });
    const transfer = await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", dairy: "dairy_a", kg: 50 });
    await call("livestock", "PUT", `/livestock/milk-transfers/${transfer.id}`, { session: "midday" }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", dairy: "dairy_a", kg: 3 }, { expect: 400 });
    const rest = await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", dairy: "dairy_a", kg: 2.5 });
    await call("livestock", "PUT", `/livestock/milk-transfers/${transfer.id}`, { kg: 51 }, { expect: 400 });
    await call("root", "DELETE", `/livestock/milk-transfers/${rest.id}`);
    assert.equal(Number((await call("livestock", "PUT", `/livestock/milk-transfers/${transfer.id}`, { kg: 52.5 })).kg), 52.5);
    await call("livestock", "PUT", `/livestock/milk-transfers/${transfer.id}`, { kg: 50 });
    // The milk recorded cannot drop below what was sent: weighed again, edited or deleted.
    const [morningRecord] = await call("livestock", "GET", `/livestock/milk-records?dairy=dairy_a&from=${today}&to=${today}`);
    await call("livestock", "POST", "/livestock/milk-records", { date: today, dairy: "dairy_a", session: "morning", records: [{ animalId: cow.id, kg: 40 }] }, { expect: 409 });
    await call("livestock", "PUT", `/livestock/milk-records/${morningRecord.id}`, { kg: 49 }, { expect: 409 });
    await call("root", "DELETE", `/livestock/milk-records/${morningRecord.id}`, null, { expect: 409 });
    assert.equal(Number((await call("livestock", "PUT", `/livestock/milk-records/${morningRecord.id}`, { kg: 52.5 })).kg), 52.5);
    await call("livestock", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedKg: 48 }, { expect: 403 });
    await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedKg: 51 }, { expect: 400 });
    const received = await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedKg: 48 });
    assert.deepEqual([Number(received.kg), Number(received.receivedKg)], [50, 48]);
    await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedKg: 48 }, { expect: 409 });

    // When animals join and leave the herd: a sale records the day it left (today when not given); back in the herd clears it.
    const soldNow = await call("livestock", "PUT", `/livestock/animals/${bull.id}`, { status: "sold" });
    assert.ok(soldNow.exitDate);
    assert.equal((await call("livestock", "PUT", `/livestock/animals/${bull.id}`, { status: "active" })).exitDate, null);
    await call("livestock", "PUT", `/livestock/animals/${calf.id}`, { status: "dead", exitDate: "2020-01-01" }, { expect: 400 });
    const bought = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-H1", sex: "female", dairy: "dairy_c", source: "purchased", dateOfBirth: "2024-06-01", acquiredDate: today });
    assert.equal(bought.acquiredDate.slice(0, 10), today);
    assert.equal((await call("livestock", "PUT", `/livestock/animals/${bought.id}`, { source: "born_on_farm" })).acquiredDate, null);
    await call("livestock", "PUT", `/livestock/animals/${bought.id}`, { source: "purchased", acquiredDate: today });
    await call("livestock", "PUT", `/livestock/animals/${bull.id}`, { status: "sold", exitDate: today });
    assert.ok((await call("livestock", "GET", "/livestock/animals?dairy=dairy_c")).every((a) => a.dairy === "dairy_c"));
  });

  test("Livestock report: the herd, milk, calvings, vaccinations and health, each alone or all together", async () => {
    const day = `period=day&date=${today}`;
    const part = async (name, period = day) => (await call("livestock", "GET", `/reports/department?department=livestock${name ? `&part=${name}` : ""}&${period}`)).reports[0];
    const values = (report) => report.summary.map((s) => [s.label, s.value]);

    // The herd at the end of the day, by dairy and class, and what joined or left it.
    const herd = await part("herd");
    assert.ok(herd.heading.startsWith("Livestock: Herd report - "), herd.heading);
    assert.deepEqual(herd.sections.map((s) => s.title.replace(/ at .+/, " at")), ["Herd at", "Herd register", "Joined and left the herd"]);
    assert.deepEqual(herd.sections[0].columns.map((c) => c.label), ["Dairy", "Milking cows", "Dry cows", "Heifers", "Female calves", "Bulls", "Male calves", "Total"]);
    assert.deepEqual(herd.sections[0].rows.map((r) => [r.dairy, r.milking, r.dry, r.heifer, r.femaleCalf, r.bull, r.maleCalf, r.total]), [["Dairy A", 1, 0, 0, 1, 0, 0, 2], ["Dairy C", 1, 0, 1, 1, 0, 0, 3], ["Not in a dairy", 0, 0, 0, 0, 0, 1, 1]]);
    assert.deepEqual(values(herd), [["Animals in the herd", 6], ["Milking cows", 2], ["Dry cows", 0], ["Joined the herd", 4], ["Left the herd", 1]]);
    const register = herd.sections[1].rows;
    assert.deepEqual(register.map((r) => [r.tag, r.dairy]), [["KE-001", "Dairy A"], ["KE-002", "Dairy A"], ["KE-C1", "Dairy C"], ["KE-C3", "Dairy C"], ["KE-H1", "Dairy C"], ["KE-C2", ""]]);
    assert.deepEqual(["cls", "mother", "father", "calvings"].map((k) => register.find((r) => r.tag === "KE-002")[k]), ["Female calf", "KE-001 Daisy", "KE-B1", 0]);
    assert.match(register.find((r) => r.tag === "KE-H1").age, /^\d+ yr( \d+ mo)?$/);
    assert.deepEqual(herd.sections[2].rows.map((r) => [r.change, r.tag]).sort(), [["Born", "KE-002"], ["Born", "KE-C2"], ["Born", "KE-C3"], ["Bought", "KE-H1"], ["Sold", "KE-B1"]]);
    // The day before, the bull was still here and neither the calves nor the heifer had arrived.
    const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
    const before = values(await part("herd", `period=day&date=${yesterday}`));
    assert.deepEqual([before[0], before[3], before[4]], [["Animals in the herd", 3], ["Joined the herd", 0], ["Left the herd", 0]]);

    // Milk, in kg, by dairy and its milkings.
    const milk = await part("milk");
    assert.deepEqual(milk.sections.map((s) => s.title), ["Milk by dairy and session (kg)", "Milk per cow (kg)", "Milk sent to MVA"]);
    assert.deepEqual(milk.sections[0].rows.map((r) => [r.dairy, r.session, r.kg, r.sent]), [["Dairy A", "Morning", 52.5, 50], ["Dairy A", "Evening", 0, 0], ["Dairy C", "Morning", 0, 0], ["Dairy C", "Midday", 6, 0], ["Dairy C", "Evening", 0, 0]]);
    assert.deepEqual(milk.sections[1].rows.map((r) => [r.tag, r.dairy, r.morning, r.midday, r.evening, r.total]), [["KE-001", "Dairy A", 52.5, "", 0, 52.5], ["KE-C1", "Dairy C", 0, 6, 0, 6]]);
    assert.deepEqual(values(milk), [["Milk recorded (kg)", 58.5], ["Dairy A (kg)", 52.5], ["Dairy C (kg)", 6], ["Sent to MVA (kg)", 50], ["Not yet sent (kg)", 8.5]]);
    assert.ok((await part("milk", `period=week&date=${today}`)).sections.some((s) => s.title === "Milk (kg) by day"));

    // Calvings, with the twins.
    const calvings = await part("calvings");
    assert.deepEqual(values(calvings), [["Calvings", 2], ["Calves born", 3], ["Twin births", 1]]);
    const twinRow = calvings.sections[0].rows.find((r) => r.twin);
    assert.deepEqual([twinRow.dam, twinRow.dairy, twinRow.calf, twinRow.twin, twinRow.sire], ["KE-C1", "Dairy C", "KE-C2 (Male)", "KE-C3 (Female)", "AI 123"]);

    // Vaccinations by vaccine (each one listed up to two months; totals for longer).
    const vaccinations = await part("vaccinations");
    assert.deepEqual(vaccinations.sections[0].rows.map((r) => [r.vaccine, r.given]), [["FMD", 1], ["LSD", 0], ["Blanthax", 0]]);
    assert.equal(vaccinations.sections[1].rows[0].vaccine, "FMD");
    assert.deepEqual((await part("vaccinations", `period=year&date=${today}`)).sections.map((s) => s.title), ["Vaccinations by vaccine"]);

    // Health: cases by disease, and every record.
    const health = await part("health");
    assert.deepEqual(health.sections[0].rows.map((r) => [r.disease, r.cases, r.treating, r.recovered, r.cost]), [["Mastitis", 1, 1, 0, 800]]);
    assert.deepEqual(values(health), [["Health records", 2], ["Disease cases", 1], ["Treatment cost", 800]]);
    assert.deepEqual(health.sections[1].rows.map((r) => [r.disease, r.details]).sort(), [["", "Routine check"], ["Mastitis", ""]]);

    // The full report carries every part.
    const full = await part("");
    assert.ok(full.heading.startsWith("Livestock report - "), full.heading);
    assert.equal(full.sections.length, [herd, milk, calvings, vaccinations, health].reduce((n, r) => n + r.sections.length, 0));
    assert.equal(full.summary.length, 18);
    await call("livestock", "GET", `/reports/department?department=livestock&part=stock&${day}`, null, { expect: 400 });
  });

  test("MVA: farmers, deliveries, processing, transfer to Sales", async () => {
    const products = await call("mva", "GET", "/sales/products");
    const byCode = Object.fromEntries(products.map((p) => [p.code, p.id]));
    ({ RAW_MILK: rawMilkId, FRESH_MILK: freshId, MALA: malaId, YOGHURT_500: yoghurtId } = byCode);

    const farmer = await call("mva", "POST", "/mva/milk-suppliers", { firstName: "John", lastName: "Kiprop" });
    assert.equal(farmer.supplierNumber, 130);
    const second = await call("mva", "POST", "/mva/milk-suppliers", { firstName: "Ann", lastName: "Chebet" });
    assert.equal(second.supplierNumber, 131);

    await call("mva", "POST", "/mva/milk-deliveries", { date: today, session: "morning", deliveries: [{ supplierId: farmer.id, litres: 60 }] }, { expect: 409 });
    await call("mva", "POST", "/mva/milk-prices", { effectiveDate: "2026-01-01", pricePerLitre: 50 });
    const deliveries = await call("mva", "POST", "/mva/milk-deliveries", { date: today, session: "morning", deliveries: [{ supplierId: farmer.id, litres: 60 }, { supplierId: second.id, litres: 40 }] });
    assert.equal(deliveries[0].amount, 3000);
    // A farmer is found by the farmer number, which identifies them across the cooperative: their deliveries, and the register.
    const numbers = (rows) => rows.map((d) => d.supplier.supplierNumber);
    assert.deepEqual(numbers(await call("mva", "GET", `/mva/milk-deliveries?search=131&from=${today}&to=${today}`)), [131]);
    assert.deepEqual(await call("mva", "GET", `/mva/milk-deliveries?search=kiprop&from=${today}&to=${today}`), []);
    assert.deepEqual(await call("mva", "GET", "/mva/milk-deliveries?search=999"), []);
    assert.deepEqual(await call("mva", "GET", "/mva/milk-deliveries?search=99999999999"), []);
    assert.deepEqual((await call("mva", "GET", "/mva/milk-suppliers?search=131")).map((s) => s.firstName), ["Ann"]);
    assert.deepEqual(await call("mva", "GET", "/mva/milk-suppliers?search=chebet"), []);
    assert.deepEqual((await call("accounts", "GET", "/accounts/farmers?search=130")).map((s) => s.firstName), ["John"]);
    assert.deepEqual(await call("accounts", "GET", "/accounts/farmers?search=kiprop"), []);

    let stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "RAW_MILK").onHand, 148);

    // MVA keeps the farmer's name and number; ID and payment details are with Accounts.
    await call("accounts", "PUT", `/accounts/farmers/${farmer.id}`, { nationalId: "28111222", bankName: "KCB", accountNumber: "0011223344", paymentMethod: "bank", firstName: "Changed" });
    await call("mva", "PUT", `/mva/milk-suppliers/${farmer.id}`, { nationalId: "999", bankName: "Other" });
    const seenByMva = await call("mva", "GET", `/mva/milk-suppliers/${farmer.id}`);
    assert.equal(seenByMva.firstName, "John");
    for (const field of ["nationalId", "bankName", "accountNumber", "phone", "paymentMethod"]) assert.ok(!(field in seenByMva), field);
    const seenByAccounts = await call("accounts", "GET", `/accounts/farmers/${farmer.id}`);
    assert.deepEqual([seenByAccounts.nationalId, seenByAccounts.bankName, seenByAccounts.accountNumber], ["28111222", "KCB", "0011223344"]);
    await call("mva", "GET", "/accounts/farmers", null, { expect: 403 });
    await call("mva", "GET", "/accounts/milk-payments", null, { expect: 403 });
    await call("accounts", "POST", "/accounts/farmers", { firstName: "X" }, { expect: 404 });

    // Allocation: where the day's milk went.
    const lines = (overrides = {}) => Object.entries({ mala: 60, yoghurt: 40, staff: 5, police: 3, local_sale: 20, ...overrides }).map(([destination, quantity]) => ({ destination, quantity }));
    const allocate = (fields, options) => call("mva", "POST", "/mva/milk-allocations", { date: today, lines: lines(fields) }, options);
    await allocate({ nowhere: 1 }, { expect: 400 });
    await call("sales", "POST", "/mva/milk-allocations", { date: today, lines: lines() }, { expect: 403 });
    await allocate();
    stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "RAW_MILK").onHand, 20);
    await allocate({ staff: 7 });
    stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "RAW_MILK").onHand, 18);
    const [sheetDay] = await call("mva", "GET", `/mva/milk-allocations?from=${today}&to=${today}`);
    assert.deepEqual([sheetDay.dairyA, sheetDay.dairyC, sheetDay.farmers, sheetDay.total, sheetDay.mala, sheetDay.staff, sheetDay.variance], [48, 0, 100, 148, 60, 7, 18]);

    // L.Sale goes to Sales as raw milk by itself, and only that way.
    await call("mva", "POST", "/mva/product-transfers", { date: today, items: [{ productId: rawMilkId, quantity: 1 }] }, { expect: 400 });
    const [rawToSales] = await call("sales", "GET", "/mva/product-transfers?status=sent");
    assert.ok(rawToSales.allocationId);
    assert.equal(rawToSales.items[0].quantity, 20);
    await call("root", "DELETE", `/mva/product-transfers/${rawToSales.id}`, null, { expect: 409 });
    await allocate({ staff: 7, local_sale: 22 });
    assert.equal((await call("sales", "GET", "/mva/product-transfers?status=sent"))[0].items[0].quantity, 22);
    await allocate({ staff: 7 });
    await call("sales", "POST", `/mva/product-transfers/${rawToSales.id}/receive`, {});
    await allocate({ staff: 7, local_sale: 25 }, { expect: 409 });

    // Product output, using the sheet's own figures for 8 October.
    await call("mva", "POST", "/mva/processing-batches", { date: today }, { expect: 400 });
    const output = { date: today, malaKg: 972.1, malaPieces: 1642, yoghurtKg: 409.4, yoghurt500: 374, yoghurt250: 561, fresh250: 520 };
    const made = await call("mva", "POST", "/mva/processing-batches", output);
    const [figures] = await call("mva", "GET", `/mva/processing-batches?from=${today}&to=${today}`);
    assert.deepEqual([figures.malaLitres, figures.malaVariance, figures.yoghurtLitres, figures.yoghurtVariance, figures.fresh250], [941, -82.4, 396.3, -57.2, 520]);
    stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "MALA").onHand, 1642);
    assert.equal(stock.find((s) => s.code === "MALA").unit, "pieces");
    assert.equal(stock.find((s) => s.code === "YOGHURT_500").onHand, 374);
    assert.equal(stock.find((s) => s.code === "RAW_MILK").onHand, 18);
    // Raw milk is measured in kg; fresh milk is packed in 250 ml packets, which go into stock.
    assert.equal(stock.find((s) => s.code === "RAW_MILK").unit, "kg");
    assert.deepEqual(["name", "unit", "onHand"].map((k) => stock.find((s) => s.code === "FRESH_MILK")[k]), ["Fresh milk 250 ml", "packets", 520]);
    await call("root", "DELETE", `/mva/processing-batches/${made.id}`);
    assert.equal((await call("mva", "GET", "/stock/mva")).find((s) => s.code === "MALA").onHand, 0);
    assert.equal((await call("mva", "GET", "/stock/mva")).find((s) => s.code === "FRESH_MILK").onHand, 0);
    await call("mva", "POST", "/mva/processing-batches", output);

    // Finished products go across by hand.
    const transfer = await call("mva", "POST", "/mva/product-transfers", { date: today, items: [{ productId: freshId, quantity: 50 }] });
    stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "FRESH_MILK").onHand, 470);
    await call("sales", "POST", `/mva/product-transfers/${transfer.id}/receive`, {});
    const sales = await call("sales", "GET", "/stock/sales");
    assert.equal(sales.find((s) => s.code === "FRESH_MILK").onHand, 50);
    assert.equal(sales.find((s) => s.code === "RAW_MILK").onHand, 20);

    // The report, laid out like the sheet.
    const { reports: [report] } = await call("mva", "GET", `/reports/department?department=mva&period=day&date=${today}`);
    const table = (title) => report.sections.find((s) => s.title === title);
    assert.deepEqual(table("Production report").columns.map((c) => c.label), ["Date", "Dairy A", "Dairy C", "Farmers", "Total", "Mala", "Yoghurt", "NKCC", "Own use", "L.Sale", "Staff", "Police", "School", "Spoilage", "Variance"]);
    assert.equal(table("Production report").rows[0].local_sale, 20);
    assert.equal(table("Product output").rows[0].malaVariance, -82.4);
    assert.equal(report.summary.find((s) => s.label === "Product output variance (L)").value, -139.6);
  });

  test("Sales: two price lists, a day's trading, stock events at any time, and the registers", async () => {
    // Local sales and vehicles are priced separately; an unpriced product cannot be sold.
    assert.equal((await call("sales", "GET", `/sales/products/${freshId}`)).localPrice, 0);
    await call("sales", "PUT", `/sales/products/${freshId}`, { localPrice: 80 });
    await call("sales", "PUT", `/sales/products/${freshId}`, { vehiclePrice: 90 });
    assert.equal((await call("sales", "GET", `/sales/products/${freshId}`)).localPrice, 80);
    await call("sales", "POST", "/sales/sales", { date: today, paymentMethod: "cash", items: [{ productId: yoghurtId, quantity: 1 }] }, { expect: 400 });
    await call("livestock", "POST", "/sales/sales", { date: today, paymentMethod: "cash", items: [{ productId: rawMilkId, quantity: 1 }] }, { expect: 403 });

    const sale = await call("sales", "POST", "/sales/sales", { date: today, paymentMethod: "cash", reference: "RCPT-1", items: [{ productId: rawMilkId, quantity: 5, unitPrice: 1 }] });
    assert.equal(sale.totalAmount, 300);
    await call("sales", "POST", "/sales/sales", { date: today, paymentMethod: "credit", items: [{ productId: freshId, quantity: 2 }] }, { expect: 400 });
    const credit = await call("sales", "POST", "/sales/sales", { date: today, paymentMethod: "credit", customerName: "Hotel", items: [{ productId: freshId, quantity: 2 }] });
    assert.equal(credit.status, "credit");
    assert.equal(credit.totalAmount, 160);
    await call("sales", "POST", `/sales/sales/${credit.id}/payments`, { date: today, amount: 160, paymentMethod: "mpesa" });

    const onHand = async (id) => (await call("sales", "GET", "/stock/sales")).find((s) => s.productId === id);
    const vehicle = await call("sales", "POST", "/sales/vehicles", { registrationNumber: "kcx 123a", driverName: "Peter", salesPersonName: "Grace" });
    const dispatch = await call("sales", "POST", "/sales/dispatches", { date: today, vehicleId: vehicle.id, items: [{ productId: freshId, quantityDispatched: 40 }] });
    assert.equal(dispatch.driverName, "Peter");
    assert.equal(dispatch.items[0].unitPrice, 90);
    assert.equal(dispatch.expectedAmount, 3600);
    await call("sales", "POST", "/sales/dispatches", { date: today, vehicleId: vehicle.id, items: [{ productId: freshId, quantityDispatched: 1 }] }, { expect: 409 });
    assert.equal((await onHand(freshId)).onHand, 8);
    assert.equal((await onHand(freshId)).onVehicles, 40);

    // During the day: a return goes straight back into the store; damages and
    // replacements come off the load.
    const record = (fields, options) => call("sales", "POST", "/sales/damages", { date: today, productId: freshId, quantity: 1, reason: "Test", ...fields }, options);
    await record({ recordType: "vehicle_return", quantity: 3 }, { expect: 400 });
    await record({ recordType: "vehicle_return", dispatchId: dispatch.id, quantity: 100 }, { expect: 409 });
    await record({ recordType: "vehicle_return", dispatchId: dispatch.id, productId: rawMilkId }, { expect: 400 });
    await record({ recordType: "office", dispatchId: dispatch.id }, { expect: 400 });
    await record({ recordType: "damage", reason: "" }, { expect: 400 });
    await record({ recordType: "vehicle_return", dispatchId: dispatch.id, quantity: 3, reason: "" });
    assert.equal((await onHand(freshId)).onHand, 11);
    assert.equal((await onHand(freshId)).onVehicles, 37);
    await record({ recordType: "damage", dispatchId: dispatch.id, quantity: 2, reason: "Burst" });
    await record({ recordType: "replacement", dispatchId: dispatch.id, quantity: 1, reason: "Sour", customerName: "Shop" });
    assert.equal((await onHand(freshId)).onHand, 11);
    assert.equal((await onHand(freshId)).onVehicles, 34);
    assert.equal((await call("sales", "GET", `/sales/dispatches/${dispatch.id}`)).expectedAmount, 3060);
    await call("root", "DELETE", `/sales/dispatches/${dispatch.id}`, null, { expect: 409 });

    // Evening: the form holds the trip's totals, so only the extra counts as new.
    const line = (fields) => [{ itemId: dispatch.items[0].id, ...fields }];
    await call("sales", "POST", `/sales/dispatches/${dispatch.id}/reconcile`, { cashReturned: 0, items: line({ quantityReturned: 1, quantityDamaged: 2, quantityReplaced: 1 }) }, { expect: 400 });
    await call("sales", "POST", `/sales/dispatches/${dispatch.id}/reconcile`, { cashReturned: 2000, mpesaReturned: 600, bankDeposit: -200, items: line({ quantityReturned: 5, quantityDamaged: 2, quantityReplaced: 1 }) }, { expect: 400 });
    const reconciled = await call("sales", "POST", `/sales/dispatches/${dispatch.id}/reconcile`, { cashReturned: 2000, mpesaReturned: 600, bankDeposit: 200, items: line({ quantityReturned: 5, quantityDamaged: 2, quantityReplaced: 1 }) });
    assert.equal(reconciled.bankDeposit, 200);
    assert.equal(reconciled.items[0].quantitySold, 32);
    assert.equal(reconciled.expectedAmount, 2880);
    assert.equal(reconciled.variance, -80);
    assert.equal((await onHand(freshId)).onHand, 13);
    assert.equal((await onHand(freshId)).onVehicles, 0);
    await record({ recordType: "damage", dispatchId: dispatch.id, reason: "Too late" }, { expect: 409 });

    // In the store: all of these reduce store stock straight away.
    await record({ recordType: "damage", quantity: 1, reason: "Dropped" });
    await record({ recordType: "replacement", quantity: 1, reason: "Sour" });
    await record({ recordType: "office", quantity: 2, reason: "Staff tea" });
    assert.equal((await onHand(freshId)).onHand, 9);
    await call("sales", "POST", "/stock/sales/adjustments", { productId: freshId, quantity: -1, date: today, reason: "Count" }, { expect: 403 });

    // The end-of-day registers, as on the department's sheet.
    const report = (period) => call("sales", "GET", `/reports/department?department=sales&${period}`).then((data) => data.reports[0]);
    const table = (doc, title) => doc.sections.find((s) => s.title === title);
    const day = await report(`period=day&date=${today}`);
    assert.deepEqual(table(day, "Vehicles").columns.map((c) => c.label), ["Date", "Product", "Dispatch", "Replacement", "Returns", "Damages", "Day sales", "Amount"]);
    const road = table(day, "Vehicles").rows[0];
    assert.deepEqual([road.product, road.dispatched, road.replaced, road.returned, road.damaged, road.sold, road.amount], ["Fresh milk 250 ml", 40, 1, 5, 2, 32, 2880]);
    const trip = table(day, "Vehicle trips and money").rows.find((r) => r.dispatchNumber === dispatch.dispatchNumber);
    assert.deepEqual([trip.cash, trip.mpesa, trip.bank, trip.handedIn, trip.variance], [2000, 600, 200, 2800, -80]);
    assert.equal(day.summary.find((s) => s.label === "Vehicle money handed in (cash, M-Pesa, bank)").value, 2800);
    assert.equal(day.summary.find((s) => s.label === "Of which banked").value, 200);
    assert.deepEqual(table(day, "Store").columns.map((c) => c.label), ["Date", "Product", "Production", "Opening Stock", "Packed", "Local sales", "Office", "Damages & replacements", "Return", "Closing stock"]);
    const fresh = table(day, "Store").rows.find((r) => r.product === "Fresh milk 250 ml");
    assert.deepEqual([fresh.production, fresh.opening, fresh.packed, fresh.local, fresh.office, fresh.damages, fresh.returned, fresh.closing], [50, 0, 40, 2, 2, 2, 5, 9]);
    assert.deepEqual(table(day, "Local sales").columns.map((c) => c.label), ["Date", "Mala", "Raw milk", "Yoghurt 500 ml", "Yoghurt 250 ml", "Yoghurt 150 ml", "Fresh milk 250 ml", "Amount", "Ref. Number"]);
    const local = table(day, "Local sales");
    assert.equal(local.rows[0].RAW_MILK, 5);
    assert.equal(local.rows[0].reference, "RCPT-1");
    assert.equal(local.totals.amount, 460);
    const month = await report(`period=month&date=${today}`);
    assert.equal(table(month, "Store totals for the period").rows.find((r) => r.product === "Fresh milk 250 ml").closing, 9);
    assert.ok(table(day, "Store").rows.some((r) => r.product === "Yoghurt 500 ml"));
    assert.ok(!table(day, "Store totals for the period"));
  });

  test("Sales: a trip stays on the list until it is reconciled, whatever its date", async () => {
    const earlier = new Date(Date.parse(`${today}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
    const vehicle = await call("sales", "POST", "/sales/vehicles", { registrationNumber: "KDD 1", driverName: "Ann", salesPersonName: "Joy" });
    const trip = await call("sales", "POST", "/sales/dispatches", { date: earlier, vehicleId: vehicle.id, items: [{ productId: rawMilkId, quantityDispatched: 2 }] });
    const list = (query) => call("sales", "GET", `/sales/dispatches?from=${today}&to=${today}&${query}`).then((rows) => rows.some((row) => row.id === trip.id));
    assert.equal(await list(""), false);
    assert.equal(await list("includeActive=true"), true);
    assert.equal((await call("sales", "GET", `/sales/dispatches?from=${today}&to=${today}&includeActive=true`))[0].status, "dispatched");
    await call("sales", "POST", `/sales/dispatches/${trip.id}/reconcile`, { cashReturned: 120, items: [{ itemId: trip.items[0].id }] });
    assert.equal(await list("includeActive=true"), true);
    assert.equal(await list("includeActive=true&status=dispatched"), false);
  });

  test("Sales: products can be edited, and deleted when nothing depends on them", async () => {
    const ghee = await call("sales", "POST", "/sales/products", { code: "ghee", name: "Ghee", unit: "kg", localPrice: 500, vehiclePrice: 550 });
    assert.equal(ghee.code, "GHEE");
    const edited = await call("sales", "PUT", `/sales/products/${ghee.id}`, { name: "Pure ghee", localPrice: 520 });
    assert.deepEqual([edited.name, edited.localPrice, edited.vehiclePrice], ["Pure ghee", 520, 550]);
    await call("sales", "DELETE", `/sales/products/${ghee.id}`, null, { expect: 403 });
    await call("root", "DELETE", `/sales/products/${ghee.id}`);
    await call("sales", "GET", `/sales/products/${ghee.id}`, null, { expect: 404 });
    await call("root", "DELETE", `/sales/products/${freshId}`, null, { expect: 409 });
    await call("root", "DELETE", `/sales/products/${rawMilkId}`, null, { expect: 409 });

    // A default product that is deleted does not come back on the next start.
    const small = (await call("sales", "GET", "/sales/products")).find((p) => p.code === "YOGHURT_150");
    await call("root", "DELETE", `/sales/products/${small.id}`);
    await ensureReferenceData(prisma);
    assert.ok(!(await call("sales", "GET", "/sales/products")).some((p) => p.code === "YOGHURT_150"));
  });

  test("Product requests: Sales asks MVA and MVA sends; the administration asks Sales, given out as office use", async () => {
    // Who may ask whom.
    await call("mva", "POST", "/product-requests", { to: "mva", items: [{ productId: malaId, quantity: 1 }] }, { expect: 403 });
    await call("sales", "POST", "/product-requests", { to: "sales", items: [{ productId: malaId, quantity: 1 }] }, { expect: 403 });
    await call("hrHead", "POST", "/product-requests", { to: "mva", items: [{ productId: malaId, quantity: 1 }] }, { expect: 403 });
    await call("sales", "POST", "/product-requests", { to: "mva", items: [{ productId: rawMilkId, quantity: 1 }] }, { expect: 400 });
    await call("sales", "POST", "/product-requests", { to: "mva", items: [] }, { expect: 400 });

    // Sales asks MVA; MVA sees it, other departments do not.
    const ask = await call("sales", "POST", "/product-requests", { to: "mva", purpose: "Weekend orders", items: [{ productId: malaId, quantity: 30 }, { productId: freshId, quantity: 20 }] });
    assert.equal(ask.status, "pending");
    assert.match(ask.requestNumber, /^PRQ-\d{4}-\d{4}$/);
    assert.equal(ask.fromDepartment, "sales");
    assert.ok((await call("mva", "GET", "/product-requests?to=mva&status=pending")).some((r) => r.id === ask.id && r.canSend));
    assert.equal((await call("mva", "GET", "/dashboard")).productRequests.toHandle, 1);
    await call("hrHead", "GET", `/product-requests/${ask.id}`, null, { expect: 404 });
    const lineOf = (request, productId) => request.items.find((i) => i.productId === productId).id;
    await call("sales", "POST", `/product-requests/${ask.id}/send`, { date: today, items: [{ itemId: lineOf(ask, malaId), quantity: 30 }] }, { expect: 403 });

    // MVA sends (here less fresh milk than asked): a transfer to Sales, out of MVA stock.
    const mvaStock = async (code) => (await call("mva", "GET", "/stock/mva")).find((s) => s.code === code).onHand;
    const malaAtMva = await mvaStock("MALA");
    await call("mva", "POST", `/product-requests/${ask.id}/send`, { date: today, items: [{ itemId: lineOf(ask, malaId), quantity: 31 }] }, { expect: 400 });
    const sent = await call("mva", "POST", `/product-requests/${ask.id}/send`, { date: today, items: [{ itemId: lineOf(ask, malaId), quantity: 30 }, { itemId: lineOf(ask, freshId), quantity: 15 }] });
    assert.equal(sent.status, "sent");
    assert.equal((await call("mva", "GET", `/mva/product-transfers/${sent.transferId}`)).notes, `For request ${ask.requestNumber}`);
    assert.equal(await mvaStock("MALA"), malaAtMva - 30);
    assert.deepEqual(sent.items.map((i) => [i.productId, i.quantityGiven]).sort(), [[malaId, 30], [freshId, 15]].sort());
    await call("mva", "POST", `/product-requests/${ask.id}/send`, { date: today, items: [{ itemId: lineOf(ask, malaId), quantity: 1 }] }, { expect: 409 });
    assert.equal((await call("sales", "GET", "/product-requests?to=mva&status=sent")).length, 1);

    // Sales receives it under From MVA, as any transfer; that closes the request.
    await call("sales", "POST", `/mva/product-transfers/${sent.transferId}/receive`, {});
    assert.equal((await call("sales", "GET", `/product-requests/${ask.id}`)).status, "received");
    const salesStock = async (code) => (await call("sales", "GET", "/stock/sales")).find((s) => s.code === code).onHand;
    assert.equal(await salesStock("MALA"), 30);

    // A transfer deleted before Sales receives it puts the request back; MVA may decline, Sales may cancel.
    const again = await call("sales", "POST", "/product-requests", { to: "mva", items: [{ productId: malaId, quantity: 5 }] });
    const out = await call("mva", "POST", `/product-requests/${again.id}/send`, { date: today, items: [{ itemId: again.items[0].id, quantity: 5 }] });
    await call("root", "DELETE", `/mva/product-transfers/${out.transferId}`);
    const reopened = await call("sales", "GET", `/product-requests/${again.id}`);
    assert.deepEqual([reopened.status, reopened.transferId, reopened.items[0].quantityGiven], ["pending", null, 0]);
    await call("mva", "POST", `/product-requests/${again.id}/decline`, { reason: "" }, { expect: 400 });
    await call("mva", "POST", `/product-requests/${again.id}/cancel`, {}, { expect: 403 });
    const declined = await call("mva", "POST", `/product-requests/${again.id}/decline`, { reason: "No Mala left today" });
    assert.deepEqual([declined.status, declined.declineReason], ["declined", "No Mala left today"]);
    const third = await call("sales", "POST", "/product-requests", { to: "mva", items: [{ productId: freshId, quantity: 2 }] });
    assert.equal((await call("sales", "POST", `/product-requests/${third.id}/cancel`, {})).status, "cancelled");

    // The administration asks Sales; Sales gives the products out as office use - off stock, not paid for.
    const office = await call("root", "POST", "/product-requests", { to: "sales", purpose: "Board meeting", items: [{ productId: malaId, quantity: 4 }] });
    assert.equal(office.fromDepartment, null);
    await call("mva", "GET", `/product-requests/${office.id}`, null, { expect: 404 });
    assert.equal((await call("sales", "GET", "/dashboard")).productRequests.toHandle, 1);
    await call("sales", "POST", `/product-requests/${office.id}/issue`, { date: today, items: [{ itemId: office.items[0].id, quantity: 40 }] }, { expect: 400 });
    const salesBefore = (await call("sales", "GET", "/sales/sales")).length;
    const given = await call("sales", "POST", `/product-requests/${office.id}/issue`, { date: today, items: [{ itemId: office.items[0].id, quantity: 4 }] });
    assert.equal(given.status, "issued");
    assert.equal(await salesStock("MALA"), 26);
    assert.equal(given.officeRecords.length, 1);
    assert.equal((await call("sales", "GET", "/sales/sales")).length, salesBefore);
    const record = (await call("sales", "GET", "/sales/damages?recordType=office")).find((r) => r.id === given.officeRecords[0].id);
    assert.deepEqual([record.quantity, record.reason], [4, `Office request ${office.requestNumber}: Board meeting`]);
    const storeDay = (await call("sales", "GET", `/reports/department?department=sales&part=store&period=day&date=${today}`)).reports[0];
    assert.equal(storeDay.sections.find((s) => s.title === "Store").rows.find((r) => r.product === "Mala").office, 4);
    // The General Manager sees every request, but handles none.
    const all = await call("gm", "GET", "/product-requests");
    assert.ok(all.some((r) => r.id === ask.id) && all.some((r) => r.id === office.id) && all.every((r) => !r.canSend && !r.canIssue));
  });

  test("Stores: quantities only, goods received and issued, its three reports; requisitions and purchase orders without Stores", async () => {
    const shift = (days) => new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
    // Items carry no cost; the opening quantity is counted on a given day.
    // Items carry no code either: they are known by name, so no two share one.
    const feeds = await call("stores", "POST", "/stores/items", { name: "Dairy meal", category: "animal_feeds", unit: "bags", openingQuantity: 20, openingDate: shift(-2), reorderLevel: 5, unitCost: 2500, code: "DM-1" });
    assert.deepEqual([feeds.quantityOnHand, feeds.openingQuantity, feeds.unitCost, feeds.code], [20, 20, 0, null]);
    await call("stores", "POST", "/stores/items", { name: "Rope", category: "other", unit: "pieces", openingQuantity: -1 }, { expect: 400 });
    await call("stores", "POST", "/stores/items", { name: "dairy MEAL", category: "animal_feeds", unit: "bags" }, { expect: 409 });
    // The categories: transport & construction, crops, animal feeds, MVA processing tools, other.
    assert.deepEqual((await call("stores", "GET", "/meta")).storeCategories.map((c) => c.label), ["Transport & construction", "Crops", "Animal feeds", "MVA processing tools", "Other"]);
    await call("stores", "POST", "/stores/items", { name: "Fertiliser", category: "fertilisers", unit: "bags" }, { expect: 400 });

    // Goods received: no supplier, cost or delivery note, and opening stock is not something received.
    const grn = await call("stores", "POST", "/stores/receipts", { date: today, itemId: feeds.id, quantity: 30, source: "purchase", unitCost: 2400, deliveryNote: "DN-1", supplierId: feeds.id });
    assert.deepEqual([grn.unitCost, grn.deliveryNote, grn.supplierId], [0, null, null]);
    await call("stores", "POST", "/stores/receipts", { date: today, itemId: feeds.id, quantity: 5, source: "opening" }, { expect: 400 });

    // Stock out when a department asks, with no requisition. Numbered SO-year-number.
    await call("stores", "POST", "/stores/issues", { date: today, itemId: feeds.id, quantity: 60, department: "livestock", issuedTo: "Herdsman" }, { expect: 409 });
    const issue = await call("stores", "POST", "/stores/issues", { date: today, itemId: feeds.id, quantity: 10, department: "livestock", issuedTo: "Herdsman", purpose: "Dairy meal for the week", requisitionId: feeds.id });
    assert.equal(issue.requisitionId, null);
    assert.match(issue.issueNumber, /^SO-\d{4}-\d{4}$/);
    assert.equal((await call("stores", "GET", `/stores/items/${feeds.id}`)).quantityOnHand, 40);
    await call("livestock", "GET", "/stores/items", null, { expect: 403 });
    await call("livestock", "GET", "/stores/issues", null, { expect: 403 });

    // The reports: goods issued, goods received and stock remaining (opening + received - issued) for any period.
    const storesReport = async (query) => (await call("stores", "GET", `/reports/department?department=stores&${query}`)).reports[0];
    const feedsLine = (report) => {
      const line = report.sections.find((s) => s.part === "stock").rows.find((r) => r.item === "Dairy meal");
      return line && [line.opening, line.received, line.out, line.remaining, line.note];
    };
    const day = await storesReport(`period=day&date=${today}`);
    assert.deepEqual(day.sections.map((s) => s.title.replace(/ at .+$/, "")), ["Stock out", "Goods received", "Stock remaining"]);
    assert.deepEqual(day.parts.map((p) => p.title), ["Stock out", "Goods received", "Stock remaining"]);
    assert.deepEqual(day.sections.find((s) => s.part === "stock").columns.map((c) => c.label), ["Item", "Category", "Unit", "Opening", "Received", "Stock out", "Remaining", "Note"]);
    assert.equal(day.sections[0].rows.find((r) => r.issueNumber === issue.issueNumber).purpose, "Dairy meal for the week");
    assert.equal(day.sections[1].rows.find((r) => r.receiptNumber === grn.receiptNumber).source, "Purchase");
    assert.deepEqual(feedsLine(day), [20, 30, 10, 40, ""]);
    assert.deepEqual(feedsLine(await storesReport(`period=day&date=${shift(-1)}`)), [20, 0, 0, 20, ""]);
    assert.equal(feedsLine(await storesReport(`period=day&date=${shift(-3)}`)), undefined);
    assert.deepEqual(feedsLine(await storesReport(`period=custom&from=${shift(-1)}&to=${today}`)), [20, 30, 10, 40, ""]);
    await call("stores", "POST", "/stores/issues", { date: today, itemId: feeds.id, quantity: 36, department: "crops", issuedTo: "Farm hand" });
    assert.deepEqual(feedsLine(await storesReport(`period=day&date=${today}`)), [20, 30, 46, 4, "Reorder"]);
    const year = await storesReport(`period=year&date=${today}`);
    const byDepartment = year.sections.find((s) => s.title === "Stock out by department");
    assert.deepEqual(byDepartment.rows.map((r) => [r.department, r.count, r.quantity]), [["Crops", 1, 36], ["Livestock", 1, 10]]);

    // Each report prints on its own.
    const only = await call("stores", "GET", `/reports/department?department=stores&part=stock&period=day&date=${today}`);
    assert.equal(only.reports[0].heading, `Stores: Stock remaining - ${only.period.label}`);
    assert.equal(only.reports[0].sections.length, 1);
    assert.ok(only.reports[0].summary.length && only.reports[0].summary.every((s) => s.part === "stock"));
    const pdf = await call("stores", "GET", `/reports/department?department=stores&part=out&period=month&date=${today}&format=pdf`, null, { raw: true });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(pdf.headers.get("content-disposition"), /keiyian-stores-stock-out-report-\d{4}-\d{2}\.pdf/);
    await call("stores", "GET", "/reports/department?department=stores&part=costs&period=day", null, { expect: 400 });
    await call("hrHead", "GET", "/reports/department?department=hr&part=stock&period=day", null, { expect: 400 });

    // Stores raises no requisitions (departments ask it for items through store requests). Accounts fulfils approved ones.
    assert.deepEqual((await call("stores", "GET", "/auth/me")).permissions.requisitions, { raise: false, seeAll: false, decide: false, fulfil: false });
    await call("stores", "POST", "/requisitions", { title: "Gloves", items: [{ description: "Gloves", quantity: 2, purpose: "Store work" }] }, { expect: 403 });
    // Each item carries its own purpose; one for the whole requisition is not enough.
    await call("livestock", "POST", "/requisitions", { title: "Feeds", purpose: "Dairy meal for the week", items: [{ description: "Dairy meal", quantity: 10, unit: "bags", unitCost: 2500 }] }, { expect: 400 });
    const req = await call("livestock", "POST", "/requisitions", {
      title: "Feeds",
      items: [
        { description: "Dairy meal", quantity: 10, unit: "bags", unitCost: 2500, purpose: "Dairy meal for the milking cows this week" },
        { description: "Mineral lick", quantity: 2, unit: "blocks", purpose: "Lick blocks for Dairy C" },
      ],
    });
    assert.equal(req.totalAmount, 25000);
    assert.equal(req.purpose, null);
    assert.deepEqual(req.items.map((i) => [i.description, i.purpose]).sort(), [["Dairy meal", "Dairy meal for the milking cows this week"], ["Mineral lick", "Lick blocks for Dairy C"]]);
    // The department hears of each answer (approved, returned, rejected) until it looks at its requisitions.
    const answers = async (who, kind = "requisitions") => call(who, "GET", `/${kind}/answers`);
    assert.equal((await answers("livestock")).count, 0);
    await call("accounts", "POST", `/requisitions/${req.id}/decision`, { decision: "approve" }, { expect: 403 });
    await call("accHead", "POST", `/requisitions/${req.id}/decision`, { decision: "return" }, { expect: 400 });
    await call("accHead", "POST", `/requisitions/${req.id}/decision`, { decision: "return", comment: "Add unit cost" });
    const returned = await answers("livestock");
    assert.deepEqual([returned.count, returned.since, returned.rows[0].status, returned.rows[0].decisionComment], [1, null, "returned", "Add unit cost"]);
    assert.equal((await answers("crops")).count, 0);
    assert.equal((await answers("stores")).count, 0);
    assert.equal((await call("livestock", "POST", "/requisitions/answers/seen")).since, null);
    assert.equal((await answers("livestock")).count, 0);
    await call("livestock", "PUT", `/requisitions/${req.id}`, { title: "Feeds", items: [{ description: "Dairy meal", quantity: 10, unitCost: 2400 }] }, { expect: 400 });
    await call("livestock", "PUT", `/requisitions/${req.id}`, { title: "Feeds", items: [{ description: "Dairy meal", quantity: 10, unitCost: 2400, purpose: "Dairy meal for the milking cows" }] });
    assert.equal((await call("gm", "GET", "/requisitions/inbox")).length, 1);
    await call("gm", "POST", `/requisitions/${req.id}/decision`, { decision: "approve" });
    await call("stores", "POST", `/requisitions/${req.id}/fulfil`, null, { expect: 403 });
    await call("accounts", "POST", `/requisitions/${req.id}/fulfil`);
    assert.equal((await call("livestock", "GET", `/requisitions/${req.id}`)).status, "fulfilled");
    await call("crops", "GET", `/requisitions/${req.id}`, null, { expect: 404 });
    // Approved (and since fulfilled) while nobody looked: counted once more; looking clears it.
    const approved = await answers("livestock");
    assert.deepEqual([approved.count, approved.rows[0].status], [1, "fulfilled"]);
    const lookedBefore = (await call("livestock", "POST", "/requisitions/answers/seen")).since;
    assert.ok(lookedBefore && new Date(lookedBefore) < new Date(approved.rows[0].decidedAt));
    assert.equal((await answers("livestock")).count, 0);
    // An answer counts for the rest of the department, not for the one who gave it.
    const books = await call("accounts", "POST", "/requisitions", { title: "Receipt books", items: [{ description: "Receipt book", quantity: 5, unitCost: 300, purpose: "Receipts for farmer payments" }] });
    await call("accHead", "POST", `/requisitions/${books.id}/decision`, { decision: "reject", comment: "Use the ones in stock" });
    assert.deepEqual((await answers("accounts")).rows.map((r) => [r.requisitionNumber, r.status]), [[books.requisitionNumber, "rejected"]]);
    assert.equal((await answers("accHead")).count, 0);

    // No purchase orders in Stores: Accounts raises and pays them, and nothing is received against them.
    const supplier = await call("accounts", "POST", "/accounts/suppliers", { name: "Unga Feeds Ltd" });
    const po = await call("accounts", "POST", "/accounts/purchase-orders", { date: today, supplierId: supplier.id, items: [{ description: "Dairy meal", quantity: 30, unitPrice: 2400 }] });
    await call("stores", "GET", "/accounts/purchase-orders", null, { expect: 403 });
    await call("stores", "GET", "/accounts/suppliers", null, { expect: 403 });
    await call("root", "POST", `/accounts/purchase-orders/${po.id}/receive`, { date: today, items: [{ itemId: po.items[0].id, quantity: 30 }] }, { expect: 404 });
    await call("accounts", "POST", `/accounts/purchase-orders/${po.id}/pay`, { accountId: cashId, date: today, amount: 72000 });
    await call("accounts", "POST", `/accounts/purchase-orders/${po.id}/pay`, { accountId: cashId, date: today, amount: 1 }, { expect: 400 });
  });

  test("Stores: the stock, stock cards, and requests from the departments that Stores dispatches", async () => {
    const gloves = await call("stores", "POST", "/stores/items", { name: "Gloves", category: "crops", unit: "pairs", openingQuantity: 10, reorderLevel: 4 });
    const cement = await call("stores", "POST", "/stores/items", { name: "Cement", category: "transport_construction", unit: "bags", openingQuantity: 0 });

    // The stock: everything in use, with its state; only what needs restocking; by category.
    const stockOf = async (query = "") => call("stores", "GET", `/stores/stock${query}`);
    assert.equal((await stockOf()).find((i) => i.id === gloves.id).state, "ok");
    assert.ok((await stockOf("?state=out")).some((i) => i.id === cement.id));
    assert.ok(!(await stockOf("?state=low")).some((i) => i.id === gloves.id));
    assert.ok((await stockOf("?category=transport_construction")).every((i) => i.category === "transport_construction"));
    await call("livestock", "GET", "/stores/stock", null, { expect: 403 });

    // A department asks Stores. It sees the store's items by name, not what the store holds.
    const list = await call("livestock", "GET", "/store-requests/items");
    assert.ok(list.some((i) => i.name === "Gloves") && list.every((i) => i.quantityOnHand === undefined && i.code === undefined));
    await call("stores", "POST", "/store-requests", { items: [{ itemId: gloves.id, quantity: 1 }] }, { expect: 403 });
    await call("gm", "POST", "/store-requests", { items: [{ itemId: gloves.id, quantity: 1 }] }, { expect: 403 });
    await call("livestock", "POST", "/store-requests", { items: [] }, { expect: 400 });
    await call("livestock", "POST", "/store-requests", { items: [{ itemId: gloves.id, quantity: 1, purpose: "Milking" }, { itemId: gloves.id, quantity: 2, purpose: "Milking" }] }, { expect: 400 });
    await call("livestock", "POST", "/store-requests", { purpose: "Milking", items: [{ itemId: gloves.id, quantity: 4 }] }, { expect: 400 });
    const ask = await call("livestock", "POST", "/store-requests", { date: today, items: [{ itemId: gloves.id, quantity: 4, purpose: "Milking" }, { itemId: cement.id, quantity: 2, purpose: "Mend the milking parlour floor" }] });
    assert.deepEqual(ask.items.map((i) => [i.item.name, i.purpose]).sort(), [["Cement", "Mend the milking parlour floor"], ["Gloves", "Milking"]]);
    assert.match(ask.requestNumber, /^SRQ-\d{4}-\d{4}$/);
    assert.deepEqual([ask.department, ask.status, ask.canCancel, ask.canDispatch], ["livestock", "pending", true, false]);

    // Stores, the GM and administrators see every request; other departments do not see it.
    await call("crops", "GET", `/store-requests/${ask.id}`, null, { expect: 404 });
    assert.ok(!(await call("crops", "GET", "/store-requests")).some((r) => r.id === ask.id));
    const gmView = (await call("gm", "GET", "/store-requests")).find((r) => r.id === ask.id);
    assert.deepEqual([gmView.canDispatch, gmView.canDecline], [false, false]);
    const waiting = (await call("stores", "GET", "/store-requests?status=pending")).find((r) => r.id === ask.id);
    assert.deepEqual([waiting.canDispatch, waiting.canDecline, waiting.canCancel], [true, true, false]);
    assert.equal((await call("stores", "GET", "/dashboard")).storeRequests.toHandle, 1);
    assert.equal((await call("livestock", "GET", "/dashboard")).storeRequests.toHandle, 0);

    // Stores dispatches: never more than asked for, nor more than it holds. Each line is a stock out to the department.
    const [glovesLine, cementLine] = ["Gloves", "Cement"].map((name) => ask.items.find((i) => i.item.name === name));
    await call("livestock", "POST", `/store-requests/${ask.id}/dispatch`, { date: today, issuedTo: "Herdsman", items: [{ itemId: glovesLine.id, quantity: 4 }] }, { expect: 403 });
    await call("stores", "POST", `/store-requests/${ask.id}/dispatch`, { date: today, items: [{ itemId: glovesLine.id, quantity: 4 }] }, { expect: 400 });
    await call("stores", "POST", `/store-requests/${ask.id}/dispatch`, { date: today, issuedTo: "Herdsman", items: [{ itemId: glovesLine.id, quantity: 5 }] }, { expect: 400 });
    await call("stores", "POST", `/store-requests/${ask.id}/dispatch`, { date: today, issuedTo: "Herdsman", items: [{ itemId: glovesLine.id, quantity: 4 }, { itemId: cementLine.id, quantity: 2 }] }, { expect: 409 });
    assert.equal((await call("stores", "GET", `/stores/items/${gloves.id}`)).quantityOnHand, 10);
    const sent = await call("stores", "POST", `/store-requests/${ask.id}/dispatch`, { date: today, issuedTo: "Herdsman", items: [{ itemId: glovesLine.id, quantity: 4 }, { itemId: cementLine.id, quantity: 0 }] });
    assert.deepEqual([sent.status, sent.canDispatch, sent.handledBy.name, sent.issues.length], ["issued", false, "stores", 1]);
    assert.deepEqual(sent.items.map((i) => [i.item.name, i.quantityGiven]).sort(), [["Cement", 0], ["Gloves", 4]]);
    await call("stores", "POST", `/store-requests/${ask.id}/dispatch`, { date: today, issuedTo: "Herdsman", items: [{ itemId: glovesLine.id, quantity: 1 }] }, { expect: 409 });
    await call("livestock", "POST", `/store-requests/${ask.id}/cancel`, null, { expect: 409 });
    const out = (await call("stores", "GET", "/stores/issues")).find((i) => i.request?.id === ask.id);
    assert.deepEqual([out.department, out.issuedTo, Number(out.quantity), out.purpose, out.request.requestNumber], ["livestock", "Herdsman", 4, `Request ${ask.requestNumber}: Milking`, ask.requestNumber]);
    assert.equal((await call("stores", "GET", `/stores/items/${gloves.id}`)).quantityOnHand, 6);

    // The stock card: the opening count, then each movement with the balance after it.
    await call("stores", "POST", "/stores/receipts", { date: today, itemId: gloves.id, quantity: 5, source: "purchase" });
    const card = await call("stores", "GET", `/stores/items/${gloves.id}/card`);
    assert.deepEqual(card.lines.map((l) => [l.kind, l.quantity, l.balance]), [["opening", 10, 10], ["out", -4, 6], ["received", 5, 11]]);
    assert.equal(card.quantityOnHand, 11);
    await call("livestock", "GET", `/stores/items/${gloves.id}/card`, null, { expect: 403 });

    // Stores declines with a reason; the person who asked cancels a waiting request; nobody else can.
    const second = await call("livestock", "POST", "/store-requests", { items: [{ itemId: cement.id, quantity: 3, purpose: "Calf pen floor" }] });
    await call("stores", "POST", `/store-requests/${second.id}/decline`, {}, { expect: 400 });
    await call("livestock", "POST", `/store-requests/${second.id}/decline`, { reason: "x" }, { expect: 403 });
    const declined = await call("stores", "POST", `/store-requests/${second.id}/decline`, { reason: "No cement in the store" });
    assert.deepEqual([declined.status, declined.declineReason], ["declined", "No cement in the store"]);
    const third = await call("livestock", "POST", "/store-requests", { items: [{ itemId: gloves.id, quantity: 1, purpose: "Spare pair" }] });
    await call("stores", "POST", `/store-requests/${third.id}/cancel`, null, { expect: 403 });
    assert.equal((await call("livestock", "POST", `/store-requests/${third.id}/cancel`)).status, "cancelled");

    // The department hears what Stores answered (dispatched, declined) until it looks at its requests.
    const storeAnswers = await call("livestock", "GET", "/store-requests/answers");
    assert.deepEqual([storeAnswers.count, storeAnswers.rows.map((r) => r.status).sort()], [2, ["declined", "issued"]]);
    assert.equal((await call("stores", "GET", "/store-requests/answers")).count, 0);
    assert.equal((await call("crops", "GET", "/store-requests/answers")).count, 0);
    await call("livestock", "POST", "/store-requests/answers/seen");
    assert.equal((await call("livestock", "GET", "/store-requests/answers")).count, 0);

    // An item no longer in use cannot be asked for, and one that was asked for cannot be deleted.
    await call("stores", "PUT", `/stores/items/${cement.id}`, { isActive: false });
    await call("crops", "POST", "/store-requests", { items: [{ itemId: cement.id, quantity: 1, purpose: "Farm store" }] }, { expect: 400 });
    assert.ok(!(await call("crops", "GET", "/store-requests/items")).some((i) => i.id === cement.id));
    await call("root", "DELETE", `/stores/items/${cement.id}`, null, { expect: 409 });
    assert.deepEqual((await call("crops", "GET", "/auth/me")).permissions.storeRequests, { raise: true, handle: false, seeAll: false });
    assert.deepEqual((await call("stores", "GET", "/auth/me")).permissions.storeRequests, { raise: false, handle: true, seeAll: true });
  });

  test("Crops: farms, status and ratoon count", async () => {
    const farm = await call("crops", "POST", "/crops/farms", { farmNumber: "SC-01", fieldId: "27431400", cropType: "sugarcane", acreage: 4.5, location: "Kapsoit" });
    await call("crops", "POST", `/crops/farms/${farm.id}/status`, { status: "awaiting_fertiliser", date: today, note: "Weeding finished" });
    await call("crops", "POST", "/crops/harvests", { farmId: farm.id, harvestDate: today, quantity: 120, unit: "tonnes", amount: 480000, markHarvested: true });
    const updated = await call("crops", "GET", `/crops/farms/${farm.id}`);
    assert.equal(updated.ratoonCount, 1);
    assert.equal(updated.status, "harvested");
  });

  test("Crops: the Field ID identifies a farm, and farms are searched by it", async () => {
    const register = (body, options) => call("crops", "POST", "/crops/farms", { cropType: "sugarcane", acreage: 2, location: "Kapsoit", ...body }, options);
    await register({ farmNumber: "SC-02" }, { expect: 400 });
    const farm = await register({ farmNumber: "SC-02", fieldId: "  kf 7730 " });
    assert.equal(farm.fieldId, "KF 7730");
    // One farm to a Field ID, whatever the case it is typed in.
    const clash = await register({ farmNumber: "SC-03", fieldId: "Kf 7730", cropType: "tea" }, { expect: 409 });
    assert.equal(clash.message, "Field ID KF 7730 is already registered to farm SC-02");
    await call("crops", "PUT", `/crops/farms/${farm.id}`, { fieldId: "27431400" }, { expect: 409 });
    await call("crops", "PUT", `/crops/farms/${farm.id}`, { fieldId: "" }, { expect: 400 });
    assert.equal((await call("crops", "PUT", `/crops/farms/${farm.id}`, { fieldId: "kf 7730", notes: "Same field" })).fieldId, "KF 7730");
    // The search finds farms by Field ID only.
    const search = async (term) => (await call("crops", "GET", `/crops/farms?search=${encodeURIComponent(term)}`)).map((f) => f.farmNumber);
    assert.deepEqual(await search("7730"), ["SC-02"]);
    assert.deepEqual(await search("kf 77"), ["SC-02"]);
    assert.deepEqual(await search("Kapsoit"), []);
    assert.deepEqual(await search("SC-02"), []);
    // "Growing" is no longer a farm status.
    await call("crops", "POST", `/crops/farms/${farm.id}/status`, { status: "growing", date: today }, { expect: 400 });
    assert.ok(!(await call("crops", "GET", "/meta")).farmStatus.some((s) => s.value === "growing"));
  });

  test("Crops: a summary, then a report for each crop - farm no., Field ID, location, age, acres, ratoon, status", async () => {
    // Cane planted on 8 Jan 2025 and cut on 20 Jun 2026; tea planted in 2022 and plucked in August; fodder cut on 1 Jul.
    const cane = await call("crops", "POST", "/crops/farms", { farmNumber: "175A", fieldId: "27431401", cropType: "sugarcane", acreage: 24.93, location: "Oloontare", plantingDate: "2025-01-08", cycleStartDate: "2025-01-08", ratoonCount: 0, status: "weeding", statusNote: "Second weeding" });
    await call("crops", "POST", "/crops/harvests", { farmId: cane.id, harvestDate: "2026-06-20", quantity: 1200, unit: "tonnes", markHarvested: true });
    await call("crops", "POST", `/crops/farms/${cane.id}/status`, { status: "fertiliser_applied", date: "2026-08-01", note: "CAN applied" });
    const tea = await call("crops", "POST", "/crops/farms", { farmNumber: "KF3456", fieldId: " tea 0001", cropType: "tea", acreage: 8, location: "Keiyian", plantingDate: "2022-06-07", status: "awaiting_harvest" });
    await call("crops", "POST", "/crops/harvests", { farmId: tea.id, harvestDate: "2026-08-10", quantity: 2400, unit: "kg", amount: 48000 });
    const fodder = await call("crops", "POST", "/crops/farms", { farmNumber: "FD-1", fieldId: "FOD-01", cropType: "fodder", variety: "Boma rhodes", acreage: 2, location: "Paddock 3", plantingDate: "2026-02-01", status: "planted" });
    await call("crops", "POST", "/crops/harvests", { farmId: fodder.id, harvestDate: "2026-07-01", quantity: 40, unit: "bales" });

    const report = async (part, month) => {
      const data = await call("crops", "GET", `/reports/department?department=crops${part ? `&part=${part}` : ""}&period=month&date=${month}-01`);
      return { ...data.reports[0], label: data.period.label };
    };
    const rowsOf = (r) => r.sections[0].rows;

    // Before the cut: the plant crop, aged from planting, with the status it had then.
    const march = await report("sugarcane", "2026-03");
    assert.equal(march.heading, `Crops: Sugarcane report - ${march.label}`);
    assert.deepEqual(march.sections.map((s) => s.title), ["Sugarcane farms as at 31 Mar 2026"]);
    assert.deepEqual(march.sections[0].columns.map((c) => c.label), ["Farm no.", "Field ID", "Location", "Age", "Acres", "Ratoon", "Status"]);
    assert.deepEqual(rowsOf(march), [{ farmNumber: "175A", fieldId: "27431401", location: "Oloontare", age: "14 months", acreage: 24.93, ratoon: "PC", status: "Weeding - Second weeding" }]);
    assert.deepEqual(march.sections[0].totals, { acreage: 24.93 });
    assert.deepEqual(march.summary.map((s) => [s.label, s.value]), [["Sugarcane farms", 1], ["Acres", 24.93]]);
    // Ten days after the cut: the first ratoon, aged from the cut.
    const june = await report("sugarcane", "2026-06");
    assert.deepEqual([rowsOf(june)[0].age, rowsOf(june)[0].ratoon, rowsOf(june)[0].status], ["10 days", "RI", "Harvested - Recorded with harvest"]);
    const august = await report("sugarcane", "2026-08");
    assert.deepEqual([rowsOf(august)[0].age, rowsOf(august)[0].ratoon, rowsOf(august)[0].status], ["2 months", "RI", "Fertiliser applied - CAN applied"]);

    // Tea is aged from planting (plucking does not restart it) and has no ratoon; fodder grows again after each cut.
    const teaReport = await report("tea", "2026-08");
    assert.deepEqual(teaReport.sections[0].columns.map((c) => c.label), ["Farm no.", "Field ID", "Location", "Age", "Acres", "Status"]);
    assert.deepEqual(rowsOf(teaReport), [{ farmNumber: "KF3456", fieldId: "TEA 0001", location: "Keiyian", age: "4 yr 2 mo", acreage: 8, status: "Awaiting harvest" }]);
    assert.deepEqual(rowsOf(await report("fodder", "2026-08")).map((r) => [r.farmNumber, r.age, r.status]), [["FD-1", "1 month", "Planted"]]);
    const coffee = await report("coffee", "2026-08");
    assert.deepEqual([coffee.sections[0].rows.length, coffee.sections[0].totals, coffee.sections[0].emptyText], [0, undefined, "No coffee farms in the register as at 31 Aug 2026."]);

    // The summary: what was recorded in the period, and the register by crop.
    const summary = await report("summary", "2026-08");
    assert.deepEqual(summary.summary.map((s) => [s.label, s.value]), [["Harvest records", 1], ["Harvest value", 48000], ["Farm status updates", 1], ["Total farms", 3], ["Total acreage", 34.93]]);
    assert.deepEqual(summary.sections.map((s) => s.title), ["Farms by crop"]);
    assert.deepEqual(summary.sections[0].rows.map((r) => [r.crop, r.farms, r.acreage]), [["Sugarcane", 1, 24.93], ["Tea", 1, 8], ["Coffee", 0, 0], ["Fodder", 1, 2]]);
    // The full report: the summary and every crop, without each crop's own figures.
    const full = await report("", "2026-08");
    assert.equal(full.heading, `Crops report - ${full.label}`);
    assert.deepEqual(full.summary.map((s) => s.label), ["Harvest records", "Harvest value", "Farm status updates", "Total farms", "Total acreage"]);
    assert.deepEqual(full.sections.map((s) => s.title), ["Farms by crop", "Sugarcane farms as at 31 Aug 2026", "Tea farms as at 31 Aug 2026", "Coffee farms as at 31 Aug 2026", "Fodder farms as at 31 Aug 2026"]);
    // The dashboard shows the same figures as the full report.
    const card = (await call("crops", "GET", "/dashboard")).cards.find((c) => c.department === "crops");
    assert.deepEqual(card.summary.map((s) => s.label), ["Harvest records", "Harvest value", "Farm status updates", "Total farms", "Total acreage"]);
    // A register as at an earlier day leaves out farms that came later.
    assert.deepEqual((await report("summary", "2024-12")).summary.find((s) => s.label === "Total farms").value, 1);

    // Downloads, access, and the old crop reports are gone.
    const csv = await call("crops", "GET", "/reports/department?department=crops&part=coffee&period=month&date=2026-08-01&format=csv", null, { raw: true });
    assert.match(csv.headers.get("content-disposition"), /keiyian-crops-coffee-report-2026-08\.csv/);
    const csvText = await csv.text();
    assert.match(csvText, /Crops: Coffee report - August 2026/);
    assert.match(csvText, /No coffee farms in the register as at 31 Aug 2026\./);
    const pdf = await call("crops", "GET", "/reports/department?department=crops&part=sugarcane&period=month&date=2026-08-01&format=pdf", null, { raw: true });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.ok((await pdf.arrayBuffer()).byteLength > 2000);
    await call("sales", "GET", "/reports/department?department=crops&part=tea&period=month", null, { expect: 403 });
    await call("crops", "GET", "/reports/department?department=crops&part=maize&period=month", null, { expect: 400 });
    await call("crops", "GET", "/crops/reports?crop=tea&period=month", null, { expect: 404 });
  });

  test("Accounts: farmer milk payment run", async () => {
    const run = await call("accounts", "POST", "/accounts/milk-payments", { periodStart: today, periodEnd: today });
    assert.equal(run.totalAmount, 5000);
    await call("accounts", "PUT", `/accounts/milk-payments/${run.id}/lines/${run.lines[0].id}`, { deductions: 500 });
    const paid = await call("accounts", "POST", `/accounts/milk-payments/${run.id}/pay`, { accountId: cashId, date: today });
    assert.equal(paid.totalAmount, 4500);
    await call("accounts", "POST", "/accounts/milk-payments", { periodStart: today, periodEnd: today }, { expect: 409 });
  });

  test("Department reports for any period - day, week, two weeks, month, year, custom - as JSON, CSV and PDF", async () => {
    const departments = [["hrHead", "hr"], ["livestock", "livestock"], ["mva", "mva"], ["sales", "sales"], ["stores", "stores"], ["crops", "crops"], ["accounts", "accounts"]];
    const periods = [`period=day&date=${today}`, `period=week&date=${today}`, `period=fortnight&date=${today}`, `period=month&date=${today}`, `period=year&date=${today}`, `period=custom&from=${today}&to=${today}`];
    for (const [who, department] of departments) {
      for (const period of periods) {
        const data = await call(who, "GET", `/reports/department?department=${department}&${period}`);
        assert.equal(data.organisation, "Keiyian Farmers Cooperative Society Ltd");
        assert.equal(data.motto, "Nuru ya Jamii");
        assert.ok(data.generatedBy && data.generatedAt);
        assert.equal(data.reports.length, 1);
        assert.ok(data.reports[0].sections.length > 0);
        assert.ok(data.reports[0].heading.endsWith(` report - ${data.period.label}`), data.reports[0].heading);
      }
      const csv = await call(who, "GET", `/reports/department?department=${department}&period=month&date=${today}&format=csv`, null, { raw: true });
      assert.equal(csv.status, 200);
      const text = await csv.text();
      assert.match(text, /Nuru ya Jamii\r\n.+ report - .+\r\n"?Generated by .+ on .+ EAT/);
      assert.match(text, /This is a system generated report\./);
      const pdf = await call(who, "GET", `/reports/department?department=${department}&period=year&date=${today}&format=pdf`, null, { raw: true });
      assert.equal(pdf.headers.get("content-type"), "application/pdf");
      assert.match(pdf.headers.get("content-disposition"), new RegExp(`keiyian-${department}-report-\\d{4}\\.pdf`));
    }

    // The same records add up the same way whatever the period.
    const milkFromFarmers = async (period) => (await call("mva", "GET", `/reports/department?department=mva&${period}`)).reports[0]
      .summary.find((s) => s.label.startsWith("Milk from farmers")).value;
    for (const period of periods) assert.equal(await milkFromFarmers(period), 100, period);

    // Up to two months: a day-by-day breakdown and every record. A year: month by month, with totals instead of every sale.
    const monthSales = (await call("sales", "GET", `/reports/department?department=sales&period=month&date=${today}`)).reports[0];
    assert.ok(monthSales.sections.some((s) => s.title === "Sales by day"));
    assert.ok(monthSales.sections.some((s) => s.title === "Local sales"));
    const yearReport = await call("sales", "GET", `/reports/department?department=sales&period=year&date=${today}`);
    const yearSales = yearReport.reports[0];
    const byMonth = yearSales.sections.find((s) => s.title === "Sales by month");
    // A running year lists the months so far, not the ones to come.
    assert.equal(byMonth.rows.length, Number(yearReport.period.asAt.slice(5, 7)));
    assert.equal(byMonth.totals.local, yearSales.summary.find((s) => s.label === "Local sales").value);
    assert.ok(!yearSales.sections.some((s) => s.title === "Local sales"));

    // Sales and MVA print their sheets one at a time too; the sidebar reads the list from /meta.
    const meta = await call("sales", "GET", "/meta");
    assert.deepEqual(Object.fromEntries(Object.entries(meta.reportParts).map(([d, parts]) => [d, parts.map((p) => p.key)])), { mva: ["production", "output"], sales: ["vehicles", "store", "local"], stores: ["out", "received", "stock"], livestock: ["herd", "milk", "calvings", "vaccinations", "health"], crops: ["summary", "sugarcane", "tea", "coffee", "fodder"] });
    const salesPart = async (part) => (await call("sales", "GET", `/reports/department?department=sales&part=${part}&period=day&date=${today}`)).reports[0];
    assert.deepEqual((await salesPart("vehicles")).sections.map((s) => s.title), ["Vehicles", "Vehicle trips and money"]);
    assert.deepEqual((await salesPart("store")).sections.map((s) => s.title), ["Store"]);
    assert.deepEqual((await salesPart("local")).sections.map((s) => s.title), ["Local sales"]);
    assert.equal((await salesPart("local")).heading, `Sales: Local sales register - ${(await call("sales", "GET", `/reports/department?department=sales&period=day&date=${today}`)).period.label}`);
    assert.deepEqual((await salesPart("local")).summary.map((s) => s.label), ["Local sales", "Collected at counter"]);
    const mvaPart = async (part) => (await call("mva", "GET", `/reports/department?department=mva&part=${part}&period=month&date=${today}`)).reports[0];
    assert.deepEqual((await mvaPart("production")).sections.map((s) => s.title), ["Production report"]);
    assert.deepEqual((await mvaPart("output")).sections.map((s) => s.title), ["Product output"]);
    assert.ok((await mvaPart("production")).summary.some((s) => s.label === "Total intake"));
    // The full report still carries everything.
    assert.ok((await call("sales", "GET", `/reports/department?department=sales&period=day&date=${today}`)).reports[0].sections.some((s) => s.title.startsWith("Damages")));

    // The old daily address still works; access rules and bad periods are enforced.
    const { reports } = await call("gm", "GET", `/reports/daily?department=all&date=${today}`);
    assert.equal(reports.length, 7);
    await call("crops", "GET", "/reports/department?department=sales&period=month", null, { expect: 403 });
    await call("sales", "GET", "/reports/department?department=sales&period=custom&from=2026-11-10&to=2026-11-01", null, { expect: 400 });
    await call("sales", "GET", "/reports/department?department=sales&period=decade", null, { expect: 400 });
    const dashboard = await call("gm", "GET", "/dashboard");
    assert.equal(dashboard.cards.length, 7);

    // Accounts sees its own department only (and every requisition, which it decides).
    await call("accounts", "GET", "/reports/department?department=sales&period=month", null, { expect: 403 });
    await call("accounts", "GET", "/livestock/animals", null, { expect: 403 });
    await call("accounts", "GET", "/mva/milk-deliveries", null, { expect: 403 });
    assert.deepEqual((await call("accounts", "GET", "/dashboard")).cards.map((c) => c.department), ["accounts"]);
    const accountsSession = await call("accounts", "GET", "/auth/me");
    assert.deepEqual(accountsSession.permissions.departments, ["accounts"]);
    assert.deepEqual(accountsSession.permissions.reports, ["accounts"]);
    assert.equal(accountsSession.permissions.requisitions.seeAll, true);
  });
}
