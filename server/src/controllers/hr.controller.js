import Employee from "../models/Employee.js";
import Payroll from "../models/Payroll.js";

// ===============================
// EMPLOYEES
// ===============================

export const createEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.create(req.body);

    res.status(201).json({
      success: true,
      message: "Employee created",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: "Employee updated",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndDelete(
      req.params.id
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: "Employee deleted",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// PAYROLL
// ===============================

export const createPayroll = async (req, res, next) => {
  try {
    const {
      basicSalary = 0,
      allowances = 0,
      deductions = 0,
    } = req.body;

    const grossSalary =
      Number(basicSalary) + Number(allowances);

    const netSalary =
      grossSalary - Number(deductions);

    const payroll = await Payroll.create({
      ...req.body,
      grossSalary,
      netSalary,
    });

    res.status(201).json({
      success: true,
      message: "Payroll record created",
      data: payroll,
    });
  } catch (error) {
    next(error);
  }
};

export const getPayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.find()
      .populate("employee")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: payroll.length,
      data: payroll,
    });
  } catch (error) {
    next(error);
  }
};

export const getPayrollById = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate("employee");

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      });
    }

    res.json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      });
    }

    res.json({
      success: true,
      message: "Payroll updated",
      data: payroll,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(
      req.params.id
    );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      });
    }

    res.json({
      success: true,
      message: "Payroll deleted",
    });
  } catch (error) {
    next(error);
  }
};