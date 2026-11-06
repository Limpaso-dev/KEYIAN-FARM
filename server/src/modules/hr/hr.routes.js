import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { parseBody, round2 } from "../../lib/validate.js";
import { recordTransaction } from "../accounts/ledger.js";

const router = express.Router();
const employeeBrief = { select: { id: true, staffNumber: true, firstName: true, lastName: true, department: true, jobTitle: true } };
const withEmployee = { employee: employeeBrief };

// ---------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------
const employeeFields = {
  staffNumber: "string",
  firstName: "string!",
  lastName: "string!",
  nationalId: "string",
  gender: "option:gender",
  dateOfBirth: "date",
  phone: "string",
  email: "string",
  address: "string",
  department: "option:departments!",
  jobTitle: "string!",
  employmentType: "option:employmentTypes!",
  dateHired: "date!",
  basicSalary: "decimal!",
  bankName: "string",
  bankAccount: "string",
  kraPin: "string",
  notes: "text",
};
// Salary and job title change through salary reviews, status through
// terminations, so they are not editable directly.
const employeeUpdateFields = Object.fromEntries(
  Object.entries(employeeFields).filter(([name]) => !["basicSalary", "jobTitle"].includes(name)),
);

router.use("/employees", crud({
  resource: "employees",
  model: "employee",
  label: "Staff member",
  fields: employeeFields,
  updateFields: { ...employeeUpdateFields, staffNumber: "string!", status: "option:employeeStatus" },
  search: ["firstName", "lastName", "staffNumber", "nationalId", "phone"],
  filters: ["department", "status", "employmentType"],
  orderBy: { staffNumber: "asc" },
  numbering: { field: "staffNumber", prefix: "EMP", yearly: false },
  include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
  beforeDelete: async (employee, { tx }) => {
    const history = await tx.payroll.count({ where: { employeeId: employee.id } });
    if (history) throw conflict("This staff member has payroll history. Record a termination instead of deleting.");
  },
}));

// ---------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------
router.use("/contracts", crud({
  resource: "contracts",
  model: "contract",
  fields: {
    contractNumber: "string",
    employeeId: "id!",
    contractType: "option:contractTypes!",
    startDate: "date!",
    endDate: "date",
    salary: "decimal!",
    terms: "text",
    status: "option:contractStatus",
  },
  include: withEmployee,
  dateField: "startDate",
  filters: ["employeeId", "status", "contractType"],
  numbering: { field: "contractNumber", prefix: "CON" },
  prepare: (data, { existing }) => {
    const start = data.startDate ?? existing?.startDate;
    const end = data.endDate === undefined ? existing?.endDate : data.endDate;
    if (start && end && end < start) throw badRequest("The contract end date is before its start date");
  },
}));

// Contracts ending within N days (default 60), for HR follow-up.
router.get("/contracts-expiring", allow("contracts", "read"), async (req, res) => {
  const days = Math.min(Number(req.query.days) || 60, 365);
  const until = new Date(Date.now() + days * 86400000);
  const rows = await prisma.contract.findMany({
    where: { status: "active", endDate: { not: null, lte: until } },
    include: withEmployee,
    orderBy: { endDate: "asc" },
  });
  ok(res, rows);
});

// ---------------------------------------------------------------------
// Salary reviews / promotions: update the employee in the same step.
// ---------------------------------------------------------------------
const reviewRouter = express.Router();
reviewRouter.post("/", allow("salaryReviews", "write"), async (req, res) => {
  const data = parseBody({
    employeeId: "id!",
    reviewType: "option:salaryReviewTypes!",
    effectiveDate: "date!",
    newSalary: "decimal!",
    newJobTitle: "string",
    reason: "text!",
  }, req.body);
  const review = await inTransaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw notFound("Staff member");
    if (!["active", "suspended"].includes(employee.status)) throw conflict("Salary reviews are only for current staff");
    const created = await tx.salaryReview.create({
      data: {
        ...data,
        previousSalary: employee.basicSalary,
        previousJobTitle: employee.jobTitle,
        newJobTitle: data.newJobTitle || employee.jobTitle,
      },
      include: withEmployee,
    });
    await tx.employee.update({
      where: { id: employee.id },
      data: { basicSalary: data.newSalary, jobTitle: data.newJobTitle || employee.jobTitle },
    });
    await audit(tx, { user: req.user, action: "salary_review", entity: "employee", entityId: employee.id, before: employee, after: created });
    return created;
  });
  ok(res, review, 201);
});
router.use("/salary-reviews", crud({
  router: reviewRouter,
  resource: "salaryReviews",
  model: "salaryReview",
  include: withEmployee,
  dateField: "effectiveDate",
  filters: ["employeeId", "reviewType"],
  orderBy: { effectiveDate: "desc" },
  create: false,
  update: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Payroll: HR prepares and the HR head approves; Accounts pays.
// ---------------------------------------------------------------------
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const netPay = ({ basicSalary, allowances = 0, deductions = 0 }) => round2(Number(basicSalary) + Number(allowances) - Number(deductions));

const payrollRouter = express.Router();

payrollRouter.post("/generate", allow("payroll", "write"), async (req, res) => {
  const period = String(req.body.period || "");
  if (!PERIOD.test(period)) throw badRequest("Choose a payroll month (YYYY-MM)");
  const created = await inTransaction(async (tx) => {
    const employees = await tx.employee.findMany({ where: { status: "active" } });
    const existing = new Set((await tx.payroll.findMany({ where: { period }, select: { employeeId: true } })).map((row) => row.employeeId));
    const rows = employees.filter((employee) => !existing.has(employee.id)).map((employee) => ({
      employeeId: employee.id,
      period,
      basicSalary: employee.basicSalary,
      allowances: 0,
      deductions: 0,
      netPay: employee.basicSalary,
    }));
    if (rows.length) await tx.payroll.createMany({ data: rows });
    await audit(tx, { user: req.user, action: "generate_payroll", entity: "payroll", metadata: { period, created: rows.length } });
    return rows.length;
  });
  ok(res, { period, created }, 201, { message: `${created} payroll line(s) created for ${period}` });
});

const editable = (payroll) => {
  if (payroll.status !== "draft") throw conflict("Only draft payroll lines can be changed");
};

payrollRouter.post("/:id/approve", allow("payroll", "approve"), async (req, res) => {
  const row = await inTransaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({ where: { id: req.params.id } });
    if (!payroll) throw notFound("Payroll line");
    editable(payroll);
    const updated = await tx.payroll.update({ where: { id: payroll.id }, data: { status: "approved" }, include: withEmployee });
    await audit(tx, { user: req.user, action: "approve", entity: "payroll", entityId: payroll.id });
    return updated;
  });
  ok(res, row);
});

payrollRouter.post("/approve-period", allow("payroll", "approve"), async (req, res) => {
  const period = String(req.body.period || "");
  if (!PERIOD.test(period)) throw badRequest("Choose a payroll month (YYYY-MM)");
  const result = await prisma.payroll.updateMany({ where: { period, status: "draft" }, data: { status: "approved" } });
  await audit(prisma, { user: req.user, action: "approve_period", entity: "payroll", metadata: { period, count: result.count } });
  ok(res, { period, approved: result.count });
});

payrollRouter.post("/:id/pay", allow("payroll", "pay"), async (req, res) => {
  const { accountId, date } = parseBody({ accountId: "id!", date: "date!" }, req.body);
  const row = await inTransaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({ where: { id: req.params.id }, include: withEmployee });
    if (!payroll) throw notFound("Payroll line");
    if (payroll.status !== "approved") throw conflict("Only approved payroll lines can be paid");
    const transaction = await recordTransaction(tx, req.user, {
      type: "expense",
      category: "salaries",
      accountId,
      date,
      amount: payroll.netPay,
      description: `Salary ${payroll.period} - ${payroll.employee.firstName} ${payroll.employee.lastName}`,
      party: `${payroll.employee.staffNumber} ${payroll.employee.firstName} ${payroll.employee.lastName}`,
      department: "hr",
      sourceType: "payroll",
      sourceId: payroll.id,
    });
    return tx.payroll.update({
      where: { id: payroll.id },
      data: { status: "paid", paidAt: new Date(), transactionId: transaction.id },
      include: withEmployee,
    });
  });
  ok(res, row);
});

router.use("/payroll", crud({
  router: payrollRouter,
  resource: "payroll",
  model: "payroll",
  fields: { employeeId: "id!", period: "string!", basicSalary: "decimal!", allowances: "decimal", deductions: "decimal", notes: "text" },
  updateFields: { allowances: "decimal", deductions: "decimal", notes: "text" },
  include: withEmployee,
  filters: ["period", "status", "employeeId"],
  orderBy: [{ period: "desc" }, { createdAt: "asc" }],
  prepare: (data, { existing }) => {
    if (existing) editable(existing);
    if (!existing && !PERIOD.test(data.period)) throw badRequest("Period must be in the form YYYY-MM");
    data.netPay = netPay({ ...existing, ...data });
    if (data.netPay < 0) throw badRequest("Deductions cannot be more than salary plus allowances");
  },
  beforeDelete: (payroll) => editable(payroll),
}));

// ---------------------------------------------------------------------
// Disciplinary cases
// ---------------------------------------------------------------------
const disciplinaryRouter = express.Router();
disciplinaryRouter.get("/summary", allow("disciplinary", "read"), async (req, res) => {
  const cases = await prisma.disciplinaryCase.findMany({ include: withEmployee });
  const byEmployee = new Map();
  for (const item of cases) {
    const entry = byEmployee.get(item.employeeId) || {
      employee: item.employee,
      totalCases: 0,
      lettersServed: 0,
      warnings: 0,
      suspensions: 0,
      dismissals: 0,
      openCases: 0,
      lastIncident: null,
    };
    entry.totalCases += 1;
    if (item.letterServed) entry.lettersServed += 1;
    if (["verbal_warning", "warning_letter", "final_warning"].includes(item.actionTaken)) entry.warnings += 1;
    if (item.actionTaken === "suspension") entry.suspensions += 1;
    if (item.actionTaken === "dismissal") entry.dismissals += 1;
    if (item.status === "open") entry.openCases += 1;
    if (!entry.lastIncident || item.incidentDate > entry.lastIncident) entry.lastIncident = item.incidentDate;
    byEmployee.set(item.employeeId, entry);
  }
  const rows = [...byEmployee.values()].sort((a, b) => b.totalCases - a.totalCases);
  const totals = rows.reduce((sum, row) => ({
    totalCases: sum.totalCases + row.totalCases,
    lettersServed: sum.lettersServed + row.lettersServed,
    dismissals: sum.dismissals + row.dismissals,
    openCases: sum.openCases + row.openCases,
  }), { totalCases: 0, lettersServed: 0, dismissals: 0, openCases: 0 });
  ok(res, { rows, totals });
});
router.use("/disciplinary", crud({
  router: disciplinaryRouter,
  resource: "disciplinary",
  model: "disciplinaryCase",
  fields: {
    caseNumber: "string",
    employeeId: "id!",
    incidentDate: "date!",
    offence: "string!",
    actionTaken: "option:disciplinaryActions!",
    letterServed: "bool",
    letterDate: "date",
    description: "text",
    outcome: "text",
    status: "option:caseStatus",
  },
  include: withEmployee,
  dateField: "incidentDate",
  filters: ["employeeId", "actionTaken", "status"],
  orderBy: { incidentDate: "desc" },
  numbering: { field: "caseNumber", prefix: "DSC" },
  prepare: (data) => {
    if (data.letterDate && data.letterServed === undefined) data.letterServed = true;
  },
}));

// ---------------------------------------------------------------------
// Terminations: closes the employee, their contracts and user account.
// ---------------------------------------------------------------------
const terminationRouter = express.Router();
terminationRouter.post("/", allow("terminations", "write"), async (req, res) => {
  const data = parseBody({
    employeeId: "id!",
    terminationType: "option:terminationTypes!",
    terminationDate: "date!",
    reason: "text!",
    finalDues: "decimal",
    clearanceStatus: "option:clearanceStatus",
    notes: "text",
  }, req.body);
  const termination = await inTransaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: data.employeeId }, include: { termination: true } });
    if (!employee) throw notFound("Staff member");
    if (employee.termination) throw conflict("This staff member already has a termination record");
    const status = { resignation: "resigned", retirement: "retired" }[data.terminationType] || "terminated";
    const created = await tx.termination.create({ data, include: withEmployee });
    await tx.employee.update({ where: { id: employee.id }, data: { status } });
    await tx.contract.updateMany({ where: { employeeId: employee.id, status: "active" }, data: { status: "terminated" } });
    await tx.user.updateMany({ where: { employeeId: employee.id }, data: { isActive: false } });
    await audit(tx, { user: req.user, action: "terminate", entity: "employee", entityId: employee.id, before: employee, after: created });
    return created;
  });
  ok(res, termination, 201);
});
router.use("/terminations", crud({
  router: terminationRouter,
  resource: "terminations",
  model: "termination",
  fields: {},
  updateFields: { reason: "text", finalDues: "decimal", clearanceStatus: "option:clearanceStatus", notes: "text" },
  include: withEmployee,
  dateField: "terminationDate",
  filters: ["terminationType", "clearanceStatus"],
  orderBy: { terminationDate: "desc" },
  create: false,
  remove: false,
}));

// ---------------------------------------------------------------------
// Members (pioneer founders and hereditary successors)
// ---------------------------------------------------------------------
const memberInclude = {
  predecessor: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
  successors: { select: { id: true, memberNumber: true, firstName: true, lastName: true, relationship: true, successionDate: true } },
};

const memberRouter = express.Router();

// Register the successor of a member. Shares pass to the successor and the
// original member is marked as succeeded.
memberRouter.post("/:id/succession", allow("members", "succession"), async (req, res) => {
  const data = parseBody({
    memberNumber: "string",
    firstName: "string!",
    lastName: "string!",
    nationalId: "string",
    phone: "string",
    address: "string",
    relationship: "string!",
    successionDate: "date!",
    predecessorStatus: "option:memberStatus",
    notes: "text",
  }, req.body);
  const successor = await inTransaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: req.params.id }, include: { successors: true } });
    if (!member) throw notFound("Member");
    if (member.status === "succeeded") throw conflict("This member has already been succeeded");
    const { predecessorStatus, ...fields } = data;
    const created = await tx.member.create({
      data: {
        ...fields,
        memberNumber: fields.memberNumber || `${member.memberNumber}-${member.successors.length + 1}`,
        joinDate: fields.successionDate,
        shares: member.shares,
        isPioneer: false,
        predecessorId: member.id,
      },
      include: memberInclude,
    });
    await tx.member.update({
      where: { id: member.id },
      data: { status: predecessorStatus && predecessorStatus !== "active" ? predecessorStatus : "succeeded", shares: 0 },
    });
    await audit(tx, { user: req.user, action: "succession", entity: "member", entityId: member.id, before: member, after: created });
    return created;
  });
  ok(res, successor, 201);
});

// Full line of a member: ancestors and descendants.
memberRouter.get("/:id/lineage", allow("members", "read"), async (req, res) => {
  const all = await prisma.member.findMany({
    select: { id: true, memberNumber: true, firstName: true, lastName: true, status: true, predecessorId: true, relationship: true, successionDate: true, isPioneer: true },
  });
  const byId = new Map(all.map((member) => [member.id, member]));
  const start = byId.get(req.params.id);
  if (!start) throw notFound("Member");
  let root = start;
  while (root.predecessorId && byId.has(root.predecessorId)) root = byId.get(root.predecessorId);
  const build = (member, generation) => ({
    ...member,
    generation,
    successors: all.filter((other) => other.predecessorId === member.id).map((other) => build(other, generation + 1)),
  });
  ok(res, build(root, 1));
});

router.use("/members", crud({
  router: memberRouter,
  resource: "members",
  model: "member",
  fields: {
    memberNumber: "string!",
    firstName: "string!",
    lastName: "string!",
    nationalId: "string",
    phone: "string",
    address: "string",
    joinDate: "date!",
    shares: "int",
    isPioneer: "bool",
    status: "option:memberStatus",
    notes: "text",
  },
  include: memberInclude,
  search: ["memberNumber", "firstName", "lastName", "nationalId", "phone"],
  filters: ["status"],
  orderBy: { memberNumber: "asc" },
  beforeDelete: async (member, { tx }) => {
    const linked = await tx.member.count({ where: { predecessorId: member.id } });
    const paid = await tx.memberPayment.count({ where: { memberId: member.id } });
    if (linked || paid) throw conflict("This member has successors or payments and cannot be deleted");
  },
}));

// Used by forms that need a staff picker without full HR access rights.
router.get("/staff-options", async (req, res) => {
  if (!["super_admin", "admin"].includes(req.user.role) && req.user.department !== "hr") {
    return ok(res, []);
  }
  const rows = await prisma.employee.findMany({
    where: { status: "active" },
    select: { id: true, staffNumber: true, firstName: true, lastName: true, department: true },
    orderBy: { firstName: "asc" },
  });
  return ok(res, rows);
});

export default router;
