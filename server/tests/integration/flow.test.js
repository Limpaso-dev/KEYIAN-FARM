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
  test("livestock: calving, milk records, transfer to MVA", async () => {
    const cow = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-001", name: "Daisy", sex: "female", breed: "Friesian" });
    const bull = await call("livestock", "POST", "/livestock/animals", { tagNumber: "KE-B1", sex: "male" });
    await call("livestock", "POST", "/livestock/animals", { tagNumber: "X", sex: "female", damId: bull.id }, { expect: 400 });
    const { calf } = await call("livestock", "POST", "/livestock/calvings", { damId: cow.id, sireId: bull.id, calvingDate: today, calfTagNumber: "KE-002", calfSex: "female" });
    assert.equal(calf.damId, cow.id);
    assert.equal((await call("livestock", "GET", `/livestock/animals/${cow.id}`)).lactationCount, 1);
    await call("livestock", "POST", "/livestock/vaccinations", { animalId: cow.id, vaccine: "FMD", date: today });
    await call("livestock", "POST", "/livestock/health-records", { recordType: "herd_check", date: today, condition: "Routine check" });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, session: "morning", records: [{ animalId: cow.id, litres: 18.5 }] });
    await call("livestock", "POST", "/livestock/milk-records", { date: today, session: "morning", records: [{ animalId: bull.id, litres: 3 }] }, { expect: 400 });
    await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", litres: 50 }, { expect: 400 });
    const transfer = await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", dairy: "dairy_a", litres: 50 });
    await call("livestock", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedLitres: 48 }, { expect: 403 });
    await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedLitres: 48 });
    await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedLitres: 48 }, { expect: 409 });
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
    await call("root", "DELETE", `/mva/processing-batches/${made.id}`);
    assert.equal((await call("mva", "GET", "/stock/mva")).find((s) => s.code === "MALA").onHand, 0);
    await call("mva", "POST", "/mva/processing-batches", output);

    // Finished products go across by hand. Fresh milk stock here comes from a count.
    await call("root", "POST", "/stock/mva/adjustments", { productId: freshId, quantity: 60, date: today, reason: "Opening count" });
    const transfer = await call("mva", "POST", "/mva/product-transfers", { date: today, items: [{ productId: freshId, quantity: 50 }] });
    stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "FRESH_MILK").onHand, 10);
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
    const reconciled = await call("sales", "POST", `/sales/dispatches/${dispatch.id}/reconcile`, { cashReturned: 2200, mpesaReturned: 600, items: line({ quantityReturned: 5, quantityDamaged: 2, quantityReplaced: 1 }) });
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
    assert.deepEqual([road.product, road.dispatched, road.replaced, road.returned, road.damaged, road.sold, road.amount], ["Fresh milk", 40, 1, 5, 2, 32, 2880]);
    assert.deepEqual(table(day, "Store").columns.map((c) => c.label), ["Date", "Product", "Production", "Opening Stock", "Packed", "Local sales", "Office", "Damages & replacements", "Return", "Closing stock"]);
    const fresh = table(day, "Store").rows.find((r) => r.product === "Fresh milk");
    assert.deepEqual([fresh.production, fresh.opening, fresh.packed, fresh.local, fresh.office, fresh.damages, fresh.returned, fresh.closing], [50, 0, 40, 2, 2, 2, 5, 9]);
    assert.deepEqual(table(day, "Local sales").columns.map((c) => c.label), ["Date", "Mala", "Raw milk", "Yoghurt 500 ml", "Yoghurt 250 ml", "Yoghurt 150 ml", "Fresh milk", "Amount", "Ref. Number"]);
    const local = table(day, "Local sales");
    assert.equal(local.rows[0].RAW_MILK, 5);
    assert.equal(local.rows[0].reference, "RCPT-1");
    assert.equal(local.totals.amount, 460);
    const month = await report(`period=month&date=${today}`);
    assert.equal(table(month, "Store totals for the period").rows.find((r) => r.product === "Fresh milk").closing, 9);
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

  test("Requisitions and Stores issues", async () => {
    const feeds = await call("stores", "POST", "/stores/items", { name: "Dairy meal", category: "animal_feeds", unit: "bags", quantityOnHand: 20, reorderLevel: 5 });
    const req = await call("livestock", "POST", "/requisitions", { title: "Feeds", purpose: "Dairy meal for the week", items: [{ description: "Dairy meal", quantity: 10, unit: "bags", unitCost: 2500 }] });
    assert.equal(req.totalAmount, 25000);
    await call("accounts", "POST", `/requisitions/${req.id}/decision`, { decision: "approve" }, { expect: 403 });
    await call("accHead", "POST", `/requisitions/${req.id}/decision`, { decision: "return" }, { expect: 400 });
    await call("accHead", "POST", `/requisitions/${req.id}/decision`, { decision: "return", comment: "Add unit cost" });
    await call("livestock", "PUT", `/requisitions/${req.id}`, { title: "Feeds", purpose: "Dairy meal", items: [{ description: "Dairy meal", quantity: 10, unitCost: 2400 }] });
    assert.equal((await call("gm", "GET", "/requisitions/inbox")).length, 1);
    await call("gm", "POST", `/requisitions/${req.id}/decision`, { decision: "approve" });

    await call("stores", "POST", "/stores/issues", { date: today, itemId: feeds.id, quantity: 50, department: "livestock", issuedTo: "Herdsman" }, { expect: 409 });
    await call("stores", "POST", "/stores/issues", { date: today, itemId: feeds.id, quantity: 10, department: "livestock", issuedTo: "Herdsman", requisitionId: req.id, markRequisitionFulfilled: true });
    assert.equal((await call("stores", "GET", `/stores/items/${feeds.id}`)).quantityOnHand, 10);
    assert.equal((await call("livestock", "GET", `/requisitions/${req.id}`)).status, "fulfilled");
    await call("crops", "GET", `/requisitions/${req.id}`, null, { expect: 404 });

    const supplier = await call("accounts", "POST", "/accounts/suppliers", { name: "Unga Feeds Ltd" });
    const po = await call("accounts", "POST", "/accounts/purchase-orders", { date: today, supplierId: supplier.id, items: [{ storeItemId: feeds.id, description: "Dairy meal", quantity: 30, unitPrice: 2400 }] });
    await call("stores", "POST", `/accounts/purchase-orders/${po.id}/receive`, { date: today, items: [{ itemId: po.items[0].id, quantity: 20 }] });
    const received = await call("stores", "POST", `/accounts/purchase-orders/${po.id}/receive`, { date: today, items: [{ itemId: po.items[0].id, quantity: 10 }] });
    assert.equal(received.status, "received");
    assert.equal((await call("stores", "GET", `/stores/items/${feeds.id}`)).quantityOnHand, 40);
    await call("accounts", "POST", `/accounts/purchase-orders/${po.id}/pay`, { accountId: cashId, date: today, amount: 72000 });
    await call("accounts", "POST", `/accounts/purchase-orders/${po.id}/pay`, { accountId: cashId, date: today, amount: 1 }, { expect: 400 });
  });

  test("Crops: farms, status and ratoon count", async () => {
    const farm = await call("crops", "POST", "/crops/farms", { farmNumber: "SC-01", cropType: "sugarcane", acreage: 4.5, location: "Kapsoit" });
    await call("crops", "POST", `/crops/farms/${farm.id}/status`, { status: "awaiting_fertiliser", date: today, note: "Weeding finished" });
    await call("crops", "POST", "/crops/harvests", { farmId: farm.id, harvestDate: today, quantity: 120, unit: "tonnes", amount: 480000, markHarvested: true });
    const updated = await call("crops", "GET", `/crops/farms/${farm.id}`);
    assert.equal(updated.ratoonCount, 1);
    assert.equal(updated.status, "harvested");
  });

  test("Crops: period reports match the tea and cane report sheets", async () => {
    // Tea farm report, May and June 2024: 2,500 kg a day target.
    const tea = await call("crops", "POST", "/crops/farms", { farmNumber: "TEA-01", cropType: "tea", acreage: 60, location: "Keiyian", dailyTarget: 2500 });
    const may = [["02", 3082.3], ["03", 3468.6], ["06", 3037.1], ["07", 4797.3], ["08", 4865.6], ["09", 5997], ["10", 2785.7], ["13", 2395.7], ["14", 2912], ["15", 2455],
      ["16", 2446.7], ["17", 2208.3], ["20", 2495.7], ["21", 2851.1], ["22", 2283.4], ["24", 2324.1], ["27", 1820.1], ["28", 2168], ["29", 3046.7], ["30", 1539.7]];
    const june = [["03", 2346.8], ["04", 3063.2], ["05", 2392.2], ["06", 2354.9], ["07", 2636.4], ["10", 3367.9], ["11", 1582.3], ["12", 2112.2], ["17", 4101.8],
      ["18", 4110.6], ["19", 3390.7], ["20", 3390.7], ["21", 1991.1], ["24", 3620], ["25", 3194.9], ["26", 2103.3], ["27", 2410.6]];
    for (const [month, rows] of [["05", may], ["06", june]]) {
      for (const [d, kgs] of rows) await call("crops", "POST", "/crops/harvests", { farmId: tea.id, harvestDate: `2024-${month}-${d}`, quantity: kgs, unit: "kg", markHarvested: false });
    }
    const pick = (report, label) => report.summary.find((s) => s.label.startsWith(label)).value;

    const mayReport = (await call("crops", "GET", "/crops/reports?crop=tea&period=month&year=2024&index=5")).reports[0];
    assert.equal(pick(mayReport, "Kgs plucked"), 58980.1);
    assert.equal(pick(mayReport, "Target"), 50000);
    assert.equal(pick(mayReport, "Variance"), 8980.1);
    assert.equal(pick(mayReport, "Plucking days"), 20);
    assert.equal(pick(mayReport, "Average per plucking day"), 2949.01);
    const daily = mayReport.sections[0];
    assert.equal(daily.rows.length, 20);
    assert.equal(daily.rows.find((r) => r.date.startsWith("2024-05-30")).variance, -960.3);

    const juneReport = (await call("crops", "GET", "/crops/reports?crop=tea&period=month&year=2024&index=6")).reports[0];
    assert.equal(pick(juneReport, "Kgs plucked"), 48169.6);
    assert.equal(pick(juneReport, "Variance"), 5669.6);
    assert.equal(pick(juneReport, "Change vs May 2024"), -18.33);

    const q2 = (await call("crops", "GET", "/crops/reports?crop=tea&period=quarter&year=2024&index=2")).reports[0];
    const monthly = q2.sections[0].rows;
    assert.deepEqual(monthly.map((r) => r.kgs), [0, 58980.1, 48169.6]);
    assert.deepEqual(monthly.map((r) => r.toDate), [0, 58980.1, 107149.7]);
    assert.equal(monthly[1].average, 2949.01);

    // Cane status: 397B, 43.6 ha, RII, 150 TCH, cut on 20 June 2024.
    const cane = await call("crops", "POST", "/crops/farms", { farmNumber: "397B", longFarmNumber: "27130300", cropType: "sugarcane", acreage: 109, hectares: 43.6, location: "Keiyian", ratoonCount: 2, expectedTch: 150, cycleStartDate: "2023-01-01" });
    await call("crops", "POST", "/crops/harvests", { farmId: cane.id, harvestDate: "2024-06-20", quantity: 3434.64, unit: "tonnes", markHarvested: true });
    const caneRow = (report) => report.sections[0].rows.find((r) => r.farmNumber === "397B");

    const feb = (await call("crops", "GET", "/crops/reports?crop=sugarcane&period=month&year=2024&index=2")).reports[0];
    assert.equal(feb.sections[0].title, "Cane status as at 29 Feb 2024");
    assert.deepEqual({ ...caneRow(feb), remarks: undefined, sNo: undefined }, {
      sNo: undefined, farmNumber: "397B", longFarmNumber: "27130300", hectares: 43.6, acreage: 109, age: 13, cycle: "RII", tch: 150, expectedYield: 6540, achieved: null, yearToDate: null, remarks: undefined,
    });
    // Status as at the end of February is the one it was registered with,
    // not the "Harvested" set by the June cut.
    assert.equal(caneRow(feb).remarks, "Land preparation");
    const juneCane = (await call("crops", "GET", "/crops/reports?crop=sugarcane&period=month&year=2024&index=6")).reports[0];
    assert.equal(caneRow(juneCane).remarks, "Harvested - Recorded with harvest");
    assert.equal(caneRow(juneCane).cycle, "RIII");
    assert.equal(caneRow(juneCane).age, 0);
    assert.equal(caneRow(juneCane).achieved, 3434.64);
    assert.equal(pick(juneCane, "Average TCH achieved"), 78.78);
    const h1 = (await call("crops", "GET", "/crops/reports?crop=sugarcane&period=half&year=2024&index=1")).reports[0];
    assert.equal(h1.sections[2].rows[5].toDate, 3434.64);

    // Every crop at once, downloads, and access.
    const all = await call("crops", "GET", "/crops/reports?crop=all&period=year&year=2024");
    assert.deepEqual(all.reports.map((r) => r.crop), ["tea", "sugarcane"]);
    assert.ok(all.years.includes(2024));
    const csv = await call("crops", "GET", "/crops/reports?crop=tea&period=month&year=2024&index=5&format=csv", null, { raw: true });
    assert.match(csv.headers.get("content-disposition"), /keiyian-tea-report-2024-05\.csv/);
    assert.match(await csv.text(), /Prepared by|Daily plucking - May 2024/);
    const pdf = await call("crops", "GET", "/crops/reports?crop=all&period=year&year=2024&format=pdf", null, { raw: true });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.ok((await pdf.arrayBuffer()).byteLength > 2000);
    await call("crops", "GET", "/crops/reports?crop=tea&period=month&year=2024&index=13", null, { expect: 400 });
    await call("sales", "GET", "/crops/reports?crop=tea&period=month&year=2024&index=5", null, { expect: 403 });
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
