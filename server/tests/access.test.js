import test from "node:test";
import assert from "node:assert/strict";
import { can, canReadReport, permissionsFor, requisitionRules } from "../src/config/access.js";

const user = (role, department = null, extra = {}) => ({ id: `${role}-${department}`, role, department, isActive: true, ...extra });

test("department staff read and write their own resources only", () => {
  const officer = user("officer", "livestock");
  assert.equal(can(officer, "animals", "read"), true);
  assert.equal(can(officer, "animals", "write"), true);
  assert.equal(can(officer, "employees", "read"), false);
  assert.equal(can(officer, "sales", "write"), false);
});

test("only heads can delete", () => {
  assert.equal(can(user("officer", "sales"), "customers", "delete"), false);
  assert.equal(can(user("head", "sales"), "customers", "delete"), true);
  assert.equal(can(user("head", "mva"), "customers", "delete"), false);
});

test("hand-over actions belong to the receiving department", () => {
  assert.equal(can(user("officer", "mva"), "milkTransfers", "receive"), true);
  assert.equal(can(user("officer", "livestock"), "milkTransfers", "receive"), false);
  assert.equal(can(user("officer", "sales"), "productTransfers", "receive"), true);
  assert.equal(can(user("officer", "mva"), "productTransfers", "receive"), false);
  assert.equal(can(user("officer", "stores"), "purchaseOrders", "receive"), true);
  assert.equal(can(user("officer", "accounts"), "purchaseOrders", "pay"), true);
  assert.equal(can(user("officer", "accounts"), "payroll", "pay"), true);
  assert.equal(can(user("officer", "hr"), "payroll", "pay"), false);
});

test("head-only named actions", () => {
  assert.equal(can(user("officer", "hr"), "payroll", "approve"), false);
  assert.equal(can(user("head", "hr"), "payroll", "approve"), true);
  assert.equal(can(user("officer", "accounts"), "transactions", "void"), false);
  assert.equal(can(user("head", "accounts"), "transactions", "void"), true);
});

test("accounts reads everything, general manager reads but never writes", () => {
  const accounts = user("officer", "accounts");
  const gm = user("general_manager");
  assert.equal(can(accounts, "milkDeliveries", "read"), true);
  assert.equal(can(accounts, "milkDeliveries", "write"), false);
  assert.equal(can(gm, "employees", "read"), true);
  assert.equal(can(gm, "employees", "write"), false);
  assert.equal(can(gm, "payroll", "pay"), false);
});

test("admins can do everything; inactive users nothing", () => {
  assert.equal(can(user("admin"), "transactions", "void"), true);
  assert.equal(can(user("head", "hr", { isActive: false }), "employees", "read"), false);
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

test("reports: own department, or all for GM, admin and Accounts", () => {
  assert.equal(canReadReport(user("officer", "crops"), "crops"), true);
  assert.equal(canReadReport(user("officer", "crops"), "sales"), false);
  assert.equal(canReadReport(user("officer", "accounts"), "sales"), true);
  assert.equal(canReadReport(user("general_manager"), "hr"), true);
  assert.deepEqual(permissionsFor(user("head", "stores")).reports, ["stores"]);
});
