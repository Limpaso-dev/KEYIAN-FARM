import test from "node:test";
import assert from "node:assert/strict";
import { can, canReadReport, permissionsFor, productRequestRules, requisitionRules } from "../src/config/access.js";

const user = (role, department = null, extra = {}) => ({ id: `${role}-${department}`, role, department, isActive: true, ...extra });

test("department staff read and write their own resources only", () => {
  const officer = user("officer", "livestock");
  assert.equal(can(officer, "animals", "read"), true);
  assert.equal(can(officer, "animals", "write"), true);
  assert.equal(can(officer, "employees", "read"), false);
  assert.equal(can(officer, "sales", "write"), false);
});

test("only heads can delete", () => {
  assert.equal(can(user("officer", "sales"), "vehicles", "delete"), false);
  assert.equal(can(user("head", "sales"), "vehicles", "delete"), true);
  assert.equal(can(user("head", "mva"), "vehicles", "delete"), false);
});

test("hand-over actions belong to the receiving department", () => {
  assert.equal(can(user("officer", "mva"), "milkTransfers", "receive"), true);
  assert.equal(can(user("officer", "livestock"), "milkTransfers", "receive"), false);
  assert.equal(can(user("officer", "sales"), "productTransfers", "receive"), true);
  assert.equal(can(user("officer", "mva"), "productTransfers", "receive"), false);
  assert.equal(can(user("officer", "accounts"), "purchaseOrders", "pay"), true);
  assert.equal(can(user("officer", "accounts"), "payroll", "pay"), true);
  assert.equal(can(user("officer", "hr"), "payroll", "pay"), false);
});

test("head-only named actions", () => {
  assert.equal(can(user("officer", "accounts"), "transactions", "void"), false);
  assert.equal(can(user("head", "accounts"), "transactions", "void"), true);
});

test("accounts reads only what paying salaries and members needs; general manager reads but never writes", () => {
  const accounts = user("officer", "accounts");
  const gm = user("general_manager");
  assert.equal(can(accounts, "milkDeliveries", "read"), false);
  assert.equal(can(accounts, "animals", "read"), false);
  assert.equal(can(accounts, "employees", "read"), false);
  assert.equal(can(accounts, "sales", "read"), false);
  assert.equal(can(accounts, "payroll", "read"), true);
  assert.equal(can(accounts, "payroll", "write"), false);
  assert.equal(can(accounts, "members", "read"), true);
  assert.equal(can(accounts, "members", "write"), false);
  assert.equal(can(gm, "employees", "read"), true);
  assert.equal(can(gm, "employees", "write"), false);
  assert.equal(can(gm, "payroll", "pay"), false);
});

test("department screens: staff see their own department; the GM and admins see all", () => {
  const all = ["hr", "livestock", "mva", "sales", "stores", "crops", "accounts"];
  assert.deepEqual(permissionsFor(user("head", "accounts")).departments, ["accounts"]);
  assert.deepEqual(permissionsFor(user("officer", "mva")).departments, ["mva"]);
  assert.deepEqual(permissionsFor(user("general_manager")).departments, all);
  assert.deepEqual(permissionsFor(user("admin")).departments, all);
  assert.deepEqual(permissionsFor(user("head", "hr", { isActive: false })).departments, []);
  // Accounts still sees every requisition: it approves and fulfils them.
  assert.equal(requisitionRules.canSeeAll(user("officer", "accounts")), true);
});

test("admins can do everything; inactive users nothing", () => {
  assert.equal(can(user("admin"), "transactions", "void"), true);
  assert.equal(can(user("head", "hr", { isActive: false }), "employees", "read"), false);
});

test("the staff establishment belongs to HR", () => {
  assert.equal(can(user("officer", "hr"), "jobAdverts", "write"), true);
  assert.equal(can(user("officer", "hr"), "jobApplicants", "write"), true);
  assert.equal(can(user("head", "accounts"), "jobAdverts", "read"), false);
  assert.equal(can(user("general_manager"), "jobApplicants", "read"), true);
  assert.equal(can(user("general_manager"), "jobApplicants", "write"), false);
});

test("requisitions are decided by the head of Accounts or the General Manager", () => {
  assert.equal(requisitionRules.canDecide(user("general_manager")), true);
  assert.equal(requisitionRules.canDecide(user("head", "accounts")), true);
  assert.equal(requisitionRules.canDecide(user("officer", "accounts")), false);
  assert.equal(requisitionRules.canDecide(user("head", "hr")), false);
  assert.equal(requisitionRules.canDecide(user("admin")), false);
  assert.equal(requisitionRules.canRaise(user("officer", "crops")), true);
  assert.equal(requisitionRules.canRaise(user("general_manager")), false);
});

test("Stores keeps quantities to itself: no purchase orders, suppliers or requisitions", () => {
  const stores = user("officer", "stores");
  assert.equal(can(stores, "purchaseOrders", "read"), false);
  assert.equal(can(stores, "purchaseOrders", "receive"), false);
  assert.equal(can(stores, "suppliers", "read"), false);
  assert.equal(can(stores, "storeIssues", "write"), true);
  assert.equal(requisitionRules.canRaise(stores), false);
  assert.equal(requisitionRules.canFulfil(stores), false);
  assert.equal(requisitionRules.canFulfil(user("officer", "accounts")), true);
  // Other departments do not read the store's items or issues.
  assert.equal(can(user("officer", "livestock"), "storeItems", "read"), false);
  assert.equal(can(user("officer", "crops"), "storeIssues", "read"), false);
});

test("product requests: Sales asks MVA, the administration asks Sales; the department asked handles them", () => {
  assert.deepEqual(productRequestRules.raiseTo(user("officer", "sales")), ["mva"]);
  assert.deepEqual(productRequestRules.raiseTo(user("admin")), ["sales"]);
  assert.deepEqual(productRequestRules.raiseTo(user("super_admin")), ["sales"]);
  assert.deepEqual(productRequestRules.raiseTo(user("officer", "mva")), []);
  assert.deepEqual(productRequestRules.raiseTo(user("general_manager")), []);
  assert.deepEqual(productRequestRules.handles(user("officer", "mva")), ["mva"]);
  assert.deepEqual(productRequestRules.handles(user("head", "sales")), ["sales"]);
  assert.deepEqual(productRequestRules.handles(user("head", "hr")), []);
  assert.equal(productRequestRules.seeAll(user("general_manager")), true);
  assert.equal(productRequestRules.seeAll(user("head", "accounts")), false);
  assert.deepEqual(permissionsFor(user("officer", "sales")).productRequests, { raiseTo: ["mva"], handles: ["sales"], seeAll: false });
});

test("reports: own department, or all for GM and admin", () => {
  assert.equal(canReadReport(user("officer", "crops"), "crops"), true);
  assert.equal(canReadReport(user("officer", "crops"), "sales"), false);
  assert.equal(canReadReport(user("officer", "accounts"), "sales"), false);
  assert.equal(canReadReport(user("officer", "accounts"), "accounts"), true);
  assert.deepEqual(permissionsFor(user("head", "accounts")).reports, ["accounts"]);
  assert.equal(canReadReport(user("general_manager"), "hr"), true);
  assert.deepEqual(permissionsFor(user("head", "stores")).reports, ["stores"]);
});
