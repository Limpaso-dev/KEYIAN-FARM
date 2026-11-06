import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const employeeFields = [
  "employeeNumber", "firstName", "lastName", "phone", "email", "department",
  "position", "employmentType", "dateJoined", "salary", "status",
];
const payrollFields = [
  "employeeId", "period", "basicSalary", "allowances", "grossSalary",
  "deductions", "netSalary", "status",
];
const payrollRelations = { employee: "employeeId" };
const payrollInclude = { employee: true };

export const createEmployee = async (req, res, next) => {
  try {
    const employee = await prisma.employee.create({
      data: prismaData(req.body, employeeFields, {}, ["dateJoined"]),
    });
    res.status(201).json({
      success: true,
      message: "Employee created",
      data: serializePrismaRecord(employee),
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployees = async (req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: employees.length,
      data: serializePrismaRecord(employees),
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(employee) });
  } catch (error) {
    return next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: prismaData(req.body, employeeFields, {}, ["dateJoined"]),
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.json({
      success: true,
      message: "Employee updated",
      data: serializePrismaRecord(employee),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await prisma.employee.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.json({ success: true, message: "Employee deleted" });
  } catch (error) {
    return next(error);
  }
};

export const createPayroll = async (req, res, next) => {
  try {
    const basicSalary = Number(req.body.basicSalary || 0);
    const allowances = Number(req.body.allowances || 0);
    const deductions = Number(req.body.deductions || 0);
    const grossSalary = basicSalary + allowances;
    const netSalary = grossSalary - deductions;
    if (![basicSalary, allowances, deductions, grossSalary, netSalary].every(Number.isFinite) ||
        basicSalary < 0 || allowances < 0 || deductions < 0 || netSalary < 0) {
      return res.status(400).json({ success: false, message: "Payroll amounts must be valid non-negative numbers" });
    }

    const data = prismaData(req.body, payrollFields, payrollRelations);
    data.basicSalary = basicSalary;
    data.allowances = allowances;
    data.grossSalary = grossSalary;
    data.deductions = deductions;
    data.netSalary = netSalary;

    const payroll = await prisma.payroll.create({
      data,
      include: payrollInclude,
    });
    res.status(201).json({
      success: true,
      message: "Payroll record created",
      data: serializePrismaRecord(payroll),
    });
  } catch (error) {
    next(error);
  }
};

export const getPayroll = async (req, res, next) => {
  try {
    const payroll = await prisma.payroll.findMany({
      include: payrollInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      count: payroll.length,
      data: serializePrismaRecord(payroll),
    });
  } catch (error) {
    next(error);
  }
};

export const getPayrollById = async (req, res, next) => {
  try {
    const payroll = await prisma.payroll.findUnique({
      where: { id: req.params.id },
      include: payrollInclude,
    });
    if (!payroll) {
      return res.status(404).json({ success: false, message: "Payroll record not found" });
    }
    return res.json({ success: true, data: serializePrismaRecord(payroll) });
  } catch (error) {
    return next(error);
  }
};

export const updatePayroll = async (req, res, next) => {
  try {
    const payroll = await prisma.payroll.update({
      where: { id: req.params.id },
      data: prismaData(req.body, payrollFields, payrollRelations),
      include: payrollInclude,
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!payroll) {
      return res.status(404).json({ success: false, message: "Payroll record not found" });
    }
    return res.json({
      success: true,
      message: "Payroll updated",
      data: serializePrismaRecord(payroll),
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePayroll = async (req, res, next) => {
  try {
    const payroll = await prisma.payroll.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === "P2025") return null;
      throw error;
    });
    if (!payroll) {
      return res.status(404).json({ success: false, message: "Payroll record not found" });
    }
    return res.json({ success: true, message: "Payroll deleted" });
  } catch (error) {
    return next(error);
  }
};
