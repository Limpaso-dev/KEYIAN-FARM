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
    await call("livestock", "POST", "/sales/customers", { name: "X" }, { expect: 403 });
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

  test("HR: staff, promotion, payroll, discipline, members, termination", async () => {
    const employee = await call("hrHead", "POST", "/hr/employees", { firstName: "Mary", lastName: "Wanjiku", department: "sales", jobTitle: "Sales clerk", employmentType: "permanent", dateHired: today, basicSalary: 20000 });
    assert.equal(employee.staffNumber, "EMP-0001");
    await call("hrHead", "POST", "/hr/salary-reviews", { employeeId: employee.id, reviewType: "promotion", effectiveDate: today, newSalary: 25000, newJobTitle: "Senior clerk", reason: "Good work" });
    assert.equal((await call("hrHead", "GET", `/hr/employees/${employee.id}`)).basicSalary, 25000);

    await call("hrHead", "POST", "/hr/payroll/generate", { period: today.slice(0, 7) });
    const [line] = await call("hrHead", "GET", `/hr/payroll?period=${today.slice(0, 7)}`);
    await call("hrHead", "PUT", `/hr/payroll/${line.id}`, { allowances: 2000, deductions: 1000 });
    await call("accounts", "POST", `/hr/payroll/${line.id}/pay`, { accountId: cashId, date: today }, { expect: 409 });
    await call("hrHead", "POST", `/hr/payroll/${line.id}/approve`);
    const paid = await call("accounts", "POST", `/hr/payroll/${line.id}/pay`, { accountId: cashId, date: today });
    assert.equal(paid.status, "paid");
    assert.equal(paid.netPay, 26000);

    await call("hrHead", "POST", "/hr/disciplinary", { employeeId: employee.id, incidentDate: today, offence: "Late", actionTaken: "warning_letter", letterServed: true });
    const summary = await call("hrHead", "GET", "/hr/disciplinary/summary");
    assert.equal(summary.totals.lettersServed, 1);

    const pioneer = await call("hrHead", "POST", "/hr/members", { memberNumber: "P001", firstName: "Kipkemoi", lastName: "Arap", joinDate: "1975-01-01", shares: 40 });
    const heir = await call("hrHead", "POST", `/hr/members/${pioneer.id}/succession`, { firstName: "Daniel", lastName: "Kipkemoi", relationship: "Son", successionDate: today, predecessorStatus: "deceased" });
    assert.equal(heir.shares, 40);
    assert.equal(heir.memberNumber, "P001-1");
    const lineage = await call("hrHead", "GET", `/hr/members/${heir.id}/lineage`);
    assert.equal(lineage.successors[0].memberNumber, "P001-1");
    await call("accounts", "POST", "/accounts/member-payments", { memberId: pioneer.id, date: today, paymentType: "dividend", amount: 100, accountId: cashId }, { expect: 409 });
    await call("accounts", "POST", "/accounts/member-payments", { memberId: heir.id, date: today, paymentType: "dividend", amount: 4000, accountId: cashId });

    const userForEmployee = await call("root", "POST", "/auth/users", { name: "Mary", email: "mary@test.local", role: "officer", department: "sales", employeeId: employee.id });
    await call("hrHead", "POST", "/hr/terminations", { employeeId: employee.id, terminationType: "resignation", terminationDate: today, reason: "Moved" });
    const users = await call("root", "GET", "/auth/users");
    assert.equal(users.find((u) => u.id === userForEmployee.user.id).isActive, false);
    assert.equal((await call("hrHead", "GET", `/hr/employees/${employee.id}`)).status, "resigned");
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
    const transfer = await call("livestock", "POST", "/livestock/milk-transfers", { date: today, session: "morning", litres: 50 });
    await call("livestock", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedLitres: 48 }, { expect: 403 });
    await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedLitres: 48 });
    await call("mva", "POST", `/livestock/milk-transfers/${transfer.id}/receive`, { receivedLitres: 48 }, { expect: 409 });
  });

  test("MVA: farmers, deliveries, processing, transfer to Sales", async () => {
    const products = await call("mva", "GET", "/sales/products");
    const byCode = Object.fromEntries(products.map((p) => [p.code, p.id]));
    ({ RAW_MILK: rawMilkId, FRESH_MILK: freshId, MALA: malaId, YOGHURT: yoghurtId } = byCode);

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

    await call("mva", "POST", "/mva/processing-batches", { date: today, rawMilkInput: 1000, outputs: [{ productId: freshId, quantity: 900 }] }, { expect: 409 });
    await call("mva", "POST", "/mva/processing-batches", { date: today, rawMilkInput: 120, outputs: [{ productId: freshId, quantity: 60 }, { productId: malaId, quantity: 30 }, { productId: yoghurtId, quantity: 25 }] });

    const transfer = await call("mva", "POST", "/mva/product-transfers", { date: today, items: [{ productId: rawMilkId, quantity: 20 }, { productId: freshId, quantity: 50 }] });
    stock = await call("mva", "GET", "/stock/mva");
    assert.equal(stock.find((s) => s.code === "RAW_MILK").onHand, 8);
    assert.equal(stock.find((s) => s.code === "FRESH_MILK").onHand, 10);
    await call("sales", "POST", `/mva/product-transfers/${transfer.id}/receive`, {});
    const sales = await call("sales", "GET", "/stock/sales");
    assert.equal(sales.find((s) => s.code === "FRESH_MILK").onHand, 50);
    assert.equal(sales.find((s) => s.code === "RAW_MILK").onHand, 20);
  });

  test("Sales: local sale, vehicle dispatch and evening reconciliation, damages", async () => {
    const sale = await call("sales", "POST", "/sales/sales", { date: today, paymentMethod: "cash", items: [{ productId: rawMilkId, quantity: 5 }] });
    assert.equal(sale.totalAmount, 300);
    const credit = await call("sales", "POST", "/sales/sales", { date: today, paymentMethod: "credit", customerName: "Hotel", items: [{ productId: freshId, quantity: 2 }] });
    assert.equal(credit.status, "credit");
    await call("sales", "POST", `/sales/sales/${credit.id}/payments`, { date: today, amount: 160, paymentMethod: "mpesa" });

    const vehicle = await call("sales", "POST", "/sales/vehicles", { registrationNumber: "kcx 123a", driverName: "Peter", salesPersonName: "Grace" });
    const dispatch = await call("sales", "POST", "/sales/dispatches", { date: today, vehicleId: vehicle.id, items: [{ productId: freshId, quantityDispatched: 40 }] });
    assert.equal(dispatch.driverName, "Peter");
    await call("sales", "POST", "/sales/dispatches", { date: today, vehicleId: vehicle.id, items: [{ productId: freshId, quantityDispatched: 1 }] }, { expect: 409 });
    const reconciled = await call("sales", "POST", `/sales/dispatches/${dispatch.id}/reconcile`, {
      cashReturned: 2000, mpesaReturned: 600, items: [{ itemId: dispatch.items[0].id, quantityReturned: 5, quantityDamaged: 2 }],
    });
    assert.equal(reconciled.items[0].quantitySold, 33);
    assert.equal(reconciled.expectedAmount, 2640);
    assert.equal(reconciled.variance, -40);

    await call("sales", "POST", "/sales/damages", { date: today, recordType: "replacement", productId: freshId, quantity: 1, customerName: "Hotel", reason: "Sour" });
    const stock = await call("sales", "GET", "/stock/sales");
    // 50 received - 2 credit - 40 dispatched + 5 returned - 1 replaced
    assert.equal(stock.find((s) => s.code === "FRESH_MILK").onHand, 12);
    await call("sales", "POST", "/stock/sales/adjustments", { productId: freshId, quantity: -1, date: today, reason: "Count" }, { expect: 403 });
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
    assert.equal(feb.sections[0].title, "Cane status as at 2024-02-29");
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

  test("End-of-day reports for every department, as JSON, CSV and PDF", async () => {
    for (const [who, department] of [["hrHead", "hr"], ["livestock", "livestock"], ["mva", "mva"], ["sales", "sales"], ["stores", "stores"], ["crops", "crops"], ["accounts", "accounts"]]) {
      const { reports } = await call(who, "GET", `/reports/daily?department=${department}&date=${today}`);
      assert.equal(reports.length, 1);
      assert.ok(reports[0].sections.length > 0);
      const csv = await call(who, "GET", `/reports/daily?department=${department}&date=${today}&format=csv`, null, { raw: true });
      assert.equal(csv.status, 200);
      assert.match(await csv.text(), /End of day report/);
      const pdf = await call(who, "GET", `/reports/daily?department=${department}&date=${today}&format=pdf`, null, { raw: true });
      assert.equal(pdf.headers.get("content-type"), "application/pdf");
    }
    const { reports } = await call("gm", "GET", `/reports/daily?department=all&date=${today}`);
    assert.equal(reports.length, 7);
    const mva = reports.find((r) => r.department === "mva");
    assert.equal(mva.summary.find((s) => s.label.startsWith("Milk from farmers")).value, 100);
    await call("crops", "GET", `/reports/daily?department=sales&date=${today}`, null, { expect: 403 });
    const dashboard = await call("gm", "GET", "/dashboard");
    assert.equal(dashboard.cards.length, 7);
  });
}
