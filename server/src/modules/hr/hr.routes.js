import express from "express";
import prisma from "../../config/prisma.js";
import { allow } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { crud, inTransaction, listQuery } from "../../lib/crud.js";
import { badRequest, conflict, notFound, ok } from "../../lib/http.js";
import { nextCode, nextNumber } from "../../lib/numbers.js";
import { isoDay, nairobiToday } from "../../lib/periods.js";
import { parseBody, round2 } from "../../lib/validate.js";
import { recordTransaction } from "../accounts/ledger.js";

const router = express.Router();
const employeeBrief = { select: { id: true, staffNumber: true, firstName: true, lastName: true, department: true, jobTitle: true } };
const withEmployee = { employee: employeeBrief };
const CURRENT_STAFF = ["active", "suspended"];

// ---------------------------------------------------------------------
// Contracts: the first one is made when a staff member is registered, and
// renewed from their profile. The salary on a contract is always the staff
// member's current salary.
// ---------------------------------------------------------------------
const checkContract = (contract) => {
  if (contract.endDate && contract.endDate < contract.startDate) throw badRequest("The contract end date is before its start date");
  if (contract.contractType === "fixed_term" && !contract.endDate) throw badRequest("A fixed-term contract needs an end date");
  return contract;
};

const addContract = async (tx, employee, contract) => tx.contract.create({
  data: {
    ...contract,
    employeeId: employee.id,
    salary: employee.basicSalary,
    status: "active",
    contractNumber: await nextNumber(tx, "CON", contract.startDate),
  },
  include: withEmployee,
});

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
  jobGroup: "string",
  employmentType: "option:employmentTypes!",
  dateHired: "date!",
  basicSalary: "decimal!",
  bankName: "string",
  bankAccount: "string",
  kraPin: "string",
  nextOfKinName: "string",
  nextOfKinNationalId: "string",
  nextOfKinPhone: "string",
  dependants: "int",
  notes: "text",
};
// Salary and job title change through salary reviews, status through
// terminations, so they are not editable directly.
const employeeUpdateFields = Object.fromEntries(
  Object.entries(employeeFields).filter(([name]) => !["basicSalary", "jobTitle"].includes(name)),
);
const employeeInclude = { user: { select: { id: true, email: true, role: true, isActive: true } } };

// Registering someone captures everything at once: job group, next of kin,
// dependants and their first contract.
const parseRegistration = (body) => {
  const { contractType, contractStart, contractEnd, contractTerms, ...employee } = parseBody({
    ...employeeFields,
    jobGroup: "string!",
    nextOfKinName: "string!",
    nextOfKinNationalId: "string!",
    nextOfKinPhone: "string!",
    dependants: "int!",
    contractType: "option:contractTypes!",
    contractStart: "date!",
    contractEnd: "date",
    contractTerms: "text",
  }, body);
  if (employee.dependants < 0) throw badRequest("The number of dependants cannot be negative");
  return {
    employee,
    contract: checkContract({ contractType, startDate: contractStart, endDate: contractEnd, terms: contractTerms }),
  };
};

const registerStaff = async (tx, user, { employee, contract }) => {
  const created = await tx.employee.create({
    data: { ...employee, staffNumber: employee.staffNumber || await nextCode(tx, "EMP") },
    include: employeeInclude,
  });
  await addContract(tx, created, contract);
  await audit(tx, { user, action: "create", entity: "employee", entityId: created.id, after: created });
  return created;
};

const employeeRouter = express.Router();

employeeRouter.post("/", allow("employees", "write"), async (req, res) => {
  const registration = parseRegistration(req.body);
  ok(res, await inTransaction((tx) => registerStaff(tx, req.user, registration)), 201);
});

// Everything on record about one staff member.
employeeRouter.get("/:id/profile", allow("employees", "read"), async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: {
      ...employeeInclude,
      contracts: { orderBy: { startDate: "desc" } },
      salaryReviews: { orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] },
      payrolls: { orderBy: { period: "desc" } },
      disciplinaryCases: { orderBy: { incidentDate: "desc" } },
      termination: true,
      applicant: { include: { advert: { select: { id: true, advertNumber: true, jobTitle: true, advertDate: true } } } },
    },
  });
  if (!employee) throw notFound("Staff member");
  ok(res, employee);
});

router.use("/employees", crud({
  router: employeeRouter,
  resource: "employees",
  model: "employee",
  label: "Staff member",
  updateFields: { ...employeeUpdateFields, staffNumber: "string!", status: "option:employeeStatus" },
  create: false,
  search: ["firstName", "lastName", "staffNumber", "nationalId", "phone", "jobGroup"],
  filters: ["department", "status", "employmentType"],
  orderBy: { staffNumber: "asc" },
  include: employeeInclude,
  prepare: (data) => {
    if (data.dependants === null) data.dependants = 0;
    if (data.dependants < 0) throw badRequest("The number of dependants cannot be negative");
  },
  beforeDelete: async (employee, { tx }) => {
    const history = await tx.payroll.count({ where: { employeeId: employee.id } });
    if (history) throw conflict("This staff member has payroll history. Record a termination instead of deleting.");
    await tx.contract.deleteMany({ where: { employeeId: employee.id } });
  },
}));

// ---------------------------------------------------------------------
// Contract list, renewals and corrections
// ---------------------------------------------------------------------
const contractRouter = express.Router();

// Renew: the current contract is marked as renewed and the new one takes over.
contractRouter.post("/", allow("contracts", "write"), async (req, res) => {
  const { employeeId, ...terms } = checkContract(parseBody({
    employeeId: "id!",
    contractType: "option:contractTypes!",
    startDate: "date!",
    endDate: "date",
    terms: "text",
  }, req.body));
  const contract = await inTransaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw notFound("Staff member");
    if (!CURRENT_STAFF.includes(employee.status)) throw conflict("Contracts can only be added for current staff");
    await tx.contract.updateMany({ where: { employeeId, status: "active" }, data: { status: "renewed" } });
    const created = await addContract(tx, employee, terms);
    await audit(tx, { user: req.user, action: "create", entity: "contract", entityId: created.id, after: created });
    return created;
  });
  ok(res, contract, 201);
});

router.use("/contracts", crud({
  router: contractRouter,
  resource: "contracts",
  model: "contract",
  label: "Contract",
  fields: {},
  updateFields: { contractType: "option:contractTypes!", startDate: "date!", endDate: "date", terms: "text" },
  create: false,
  remove: false,
  include: withEmployee,
  dateField: "startDate",
  filters: ["employeeId", "status", "contractType"],
  orderBy: { startDate: "desc" },
  prepare: (data, { existing }) => {
    checkContract({ ...existing, ...data });
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
// Salary reviews / promotions: the new salary reaches everywhere it is held
// in one step - the staff record, the current contract, and any payroll not
// yet paid from the month it takes effect. Paid payroll is history.
// ---------------------------------------------------------------------
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const netPay = ({ basicSalary, allowances = 0, deductions = 0 }) => round2(Number(basicSalary) + Number(allowances) - Number(deductions));

const reviewRouter = express.Router();
reviewRouter.post("/", allow("salaryReviews", "write"), async (req, res) => {
  const data = parseBody({
    employeeId: "id!",
    reviewType: "option:salaryReviewTypes!",
    effectiveDate: "date!",
    newSalary: "decimal!",
    newJobTitle: "string",
    newJobGroup: "string",
    reason: "text!",
  }, req.body);
  if (data.effectiveDate > nairobiToday()) throw badRequest("A salary review takes effect as soon as it is saved. Record it on or after its effective date.");
  const review = await inTransaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw notFound("Staff member");
    if (!CURRENT_STAFF.includes(employee.status)) throw conflict("Salary reviews are only for current staff");
    const jobTitle = data.newJobTitle || employee.jobTitle;
    const jobGroup = data.newJobGroup || employee.jobGroup;
    const created = await tx.salaryReview.create({
      data: {
        ...data,
        previousSalary: employee.basicSalary,
        previousJobTitle: employee.jobTitle,
        newJobTitle: jobTitle,
        previousJobGroup: employee.jobGroup,
        newJobGroup: jobGroup,
      },
      include: withEmployee,
    });
    await tx.employee.update({ where: { id: employee.id }, data: { basicSalary: data.newSalary, jobTitle, jobGroup } });
    await tx.contract.updateMany({ where: { employeeId: employee.id, status: "active" }, data: { salary: data.newSalary } });
    const unpaid = await tx.payroll.findMany({
      where: { employeeId: employee.id, status: { not: "paid" }, period: { gte: isoDay(data.effectiveDate).slice(0, 7) } },
    });
    for (const line of unpaid) {
      const net = netPay({ ...line, basicSalary: data.newSalary });
      if (net < 0) throw conflict(`The deductions on the ${line.period} payroll are more than the new salary. Reduce them first.`);
      await tx.payroll.update({ where: { id: line.id }, data: { basicSalary: data.newSalary, netPay: net } });
    }
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
// Payroll: HR generates the month and it goes straight to Accounts to pay.
// HR can still adjust a line until it has been paid.
// ---------------------------------------------------------------------
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
  ok(res, { period, created }, 201, { message: created ? `${created} payroll line(s) for ${period} sent to Finance for payment` : `Everyone is already on the ${period} payroll` });
});

const editable = (payroll) => {
  if (payroll.status === "paid") throw conflict("This salary has been paid and can no longer be changed");
};

payrollRouter.post("/:id/pay", allow("payroll", "pay"), async (req, res) => {
  const { accountId, date } = parseBody({ accountId: "id!", date: "date!" }, req.body);
  const row = await inTransaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({ where: { id: req.params.id }, include: withEmployee });
    if (!payroll) throw notFound("Payroll line");
    if (payroll.status === "paid") throw conflict("This salary has already been paid");
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
  successors: { select: { id: true, memberNumber: true, firstName: true, lastName: true, relationship: true, successionDate: true, successionReason: true, successionReasonOther: true } },
};

const memberRouter = express.Router();

// Who took the place of whom, when and why, newest first.
memberRouter.get("/successions", allow("members", "read"), async (req, res) => {
  const { where, take } = listQuery(req.query, {
    search: ["memberNumber", "firstName", "lastName", "nationalId"],
    dateField: "successionDate",
    filters: ["successionReason"],
  });
  // A search also finds the member who was replaced.
  if (where.OR) {
    const contains = { contains: String(req.query.search).trim(), mode: "insensitive" };
    where.OR.push({ predecessor: { OR: [{ memberNumber: contains }, { firstName: contains }, { lastName: contains }] } });
  }
  const rows = await prisma.member.findMany({
    where: { ...where, predecessorId: { not: null } },
    include: memberInclude,
    orderBy: [{ successionDate: "desc" }, { createdAt: "desc" }],
    take,
  });
  ok(res, rows, 200, { count: rows.length });
});

// Register the successor of a member. Shares pass to the successor; the
// original member is marked deceased when that is the reason, else succeeded.
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
    successionReason: "option:successionReasons!",
    successionReasonOther: "string",
    notes: "text",
  }, req.body);
  if (data.successionReason === "other" && !data.successionReasonOther) throw badRequest("State the reason for this succession");
  if (data.successionReason !== "other") data.successionReasonOther = null;
  const successor = await inTransaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: req.params.id }, include: { successors: true } });
    if (!member) throw notFound("Member");
    if (member.successors.length || member.status === "succeeded") throw conflict("This member has already been succeeded");
    const created = await tx.member.create({
      data: {
        ...data,
        memberNumber: data.memberNumber || `${member.memberNumber}-1`,
        joinDate: data.successionDate,
        shares: member.shares,
        isPioneer: false,
        predecessorId: member.id,
      },
      include: memberInclude,
    });
    await tx.member.update({
      where: { id: member.id },
      data: { status: data.successionReason === "death" ? "deceased" : "succeeded", shares: 0 },
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

// ---------------------------------------------------------------------
// Staff establishment: job advert -> applications -> shortlist ->
// interview -> hire. Each step can only follow the one before it.
// ---------------------------------------------------------------------
router.use("/job-adverts", crud({
  resource: "jobAdverts",
  model: "jobAdvert",
  label: "Job advert",
  fields: {
    advertNumber: "string",
    jobTitle: "string!",
    department: "option:departments!",
    jobGroup: "string",
    employmentType: "option:employmentTypes!",
    posts: "int!",
    advertDate: "date!",
    closingDate: "date",
    requirements: "text",
    status: "option:advertStatus",
  },
  updateFields: {
    jobTitle: "string!",
    department: "option:departments!",
    jobGroup: "string",
    employmentType: "option:employmentTypes!",
    posts: "int!",
    advertDate: "date!",
    closingDate: "date",
    requirements: "text",
    status: "option:advertStatus!",
  },
  include: { applicants: { select: { id: true, stage: true } } },
  search: ["advertNumber", "jobTitle", "jobGroup"],
  dateField: "advertDate",
  filters: ["status", "department"],
  orderBy: [{ advertDate: "desc" }, { createdAt: "desc" }],
  numbering: { field: "advertNumber", prefix: "ADV" },
  prepare: (data, { existing }) => {
    const merged = { ...existing, ...data };
    if (merged.posts < 1) throw badRequest("An advert needs at least one post");
    if (merged.closingDate && merged.closingDate < merged.advertDate) throw badRequest("The closing date is before the advert date");
    if (!existing && !data.status) data.status = "open";
  },
  beforeDelete: async (advert, { tx }) => {
    const applicants = await tx.jobApplicant.count({ where: { advertId: advert.id } });
    if (applicants) throw conflict("This advert has applicants and cannot be deleted. Set its status to Cancelled instead.");
  },
}));

const applicantInclude = {
  advert: true,
  employee: { select: { id: true, staffNumber: true } },
};

const applicantRouter = express.Router();

/** One step of the process: only from the stages listed in `from`. */
const applicantStep = (path, from, fields, change) => {
  applicantRouter.post(`/:id/${path}`, allow("jobApplicants", "write"), async (req, res) => {
    const data = parseBody(fields, req.body);
    const updated = await inTransaction(async (tx) => {
      const applicant = await tx.jobApplicant.findUnique({ where: { id: req.params.id } });
      if (!applicant) throw notFound("Applicant");
      if (!from.includes(applicant.stage)) throw conflict("This applicant is not at the right stage for that step");
      const row = await tx.jobApplicant.update({ where: { id: applicant.id }, data: change(data), include: applicantInclude });
      await audit(tx, { user: req.user, action: path, entity: "jobApplicant", entityId: applicant.id, before: applicant, after: row });
      return row;
    });
    ok(res, updated);
  });
};

applicantStep("shortlist", ["applied"], {}, () => ({ stage: "shortlisted" }));
applicantStep("schedule-interview", ["shortlisted", "interview"], { interviewDate: "date!", interviewPanel: "string" }, (data) => ({ ...data, stage: "interview" }));
applicantStep("interview-result", ["interview"], { result: "option:interviewResults!", interviewScore: "decimal", interviewNotes: "text" }, ({ result, ...data }) => {
  if (data.interviewScore > 100) throw badRequest("The interview score is out of 100");
  return { ...data, stage: result === "passed" ? "passed" : "rejected", ...(result === "failed" ? { rejectionReason: "Did not pass the interview" } : {}) };
});
applicantStep("reject", ["applied", "shortlisted", "interview", "passed"], { rejectionReason: "text!" }, (data) => ({ ...data, stage: "rejected" }));

// Hire: registers the staff member (with next of kin and contract) and closes
// the advert once every post is taken.
applicantRouter.post("/:id/hire", allow("jobApplicants", "write"), async (req, res) => {
  const registration = parseRegistration(req.body);
  const employee = await inTransaction(async (tx) => {
    const applicant = await tx.jobApplicant.findUnique({ where: { id: req.params.id }, include: { advert: true } });
    if (!applicant) throw notFound("Applicant");
    if (applicant.stage !== "passed") throw conflict("Only an applicant who has passed the interview can be hired");
    const hired = await tx.jobApplicant.count({ where: { advertId: applicant.advertId, stage: "hired" } });
    if (hired >= applicant.advert.posts) throw conflict("All the posts on this advert have been filled");
    const created = await registerStaff(tx, req.user, registration);
    await tx.jobApplicant.update({ where: { id: applicant.id }, data: { stage: "hired", employeeId: created.id } });
    if (hired + 1 >= applicant.advert.posts) await tx.jobAdvert.update({ where: { id: applicant.advertId }, data: { status: "filled" } });
    return created;
  });
  ok(res, employee, 201);
});

router.use("/job-applicants", crud({
  router: applicantRouter,
  resource: "jobApplicants",
  model: "jobApplicant",
  label: "Applicant",
  fields: {
    advertId: "id!",
    firstName: "string!",
    lastName: "string!",
    nationalId: "string",
    phone: "string!",
    email: "string",
    qualifications: "text",
    appliedOn: "date!",
  },
  updateFields: {
    firstName: "string!",
    lastName: "string!",
    nationalId: "string",
    phone: "string!",
    email: "string",
    qualifications: "text",
    appliedOn: "date!",
  },
  include: applicantInclude,
  search: ["firstName", "lastName", "nationalId", "phone"],
  filters: ["advertId", "stage"],
  orderBy: [{ appliedOn: "asc" }, { createdAt: "asc" }],
  prepare: async (data, { tx, existing }) => {
    if (existing) return;
    const advert = await tx.jobAdvert.findUnique({ where: { id: data.advertId } });
    if (!advert) throw notFound("Job advert");
    if (advert.status !== "open") throw conflict("This advert is no longer open for applications");
  },
  beforeDelete: (applicant) => {
    if (applicant.stage === "hired") throw conflict("This applicant has been hired and cannot be deleted");
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
