import { randomInt } from "node:crypto";
import prisma from "../config/prisma.js";
import { logAudit } from "../utils/globalRules.js";
import {
  calculatePatientBillingSummary,
} from "../utils/billing.js";
import { serializePrismaRecord } from "../utils/prismaRecords.js";

const billInclude = {
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      phone: true,
      dateOfBirth: true,
      estimatedAge: true,
      sex: true,
      address: true,
      status: true,
    },
  },
  visit: { select: { id: true, visitDate: true, visitType: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  items: true,
  payments: true,
};

export const listMedicalBills = async (req, res, next) => {
  try {
    const where = { deletedAt: null };
    if (req.user.role === "cashier") {
      where.status = { in: ["approved", "partially_paid", "paid"] };
    } else if (!["finance", "admin", "super_admin", "manager"].includes(req.user.role)) {
      where.createdById = req.user.id;
    }
    const bills = await prisma.medicalBill.findMany({
      where,
      include: billInclude,
      orderBy: { createdAt: "desc" },
    });
    const historyUserIds = [...new Set(bills.flatMap((bill) =>
      (Array.isArray(bill.history) ? bill.history : [])
        .map((entry) => entry.by)
        .filter((id) => typeof id === "string")))];
    const historyUsers = historyUserIds.length
      ? await prisma.user.findMany({
        where: { id: { in: historyUserIds } },
        select: { id: true, name: true, role: true },
      })
      : [];
    const userById = new Map(historyUsers.map((user) => [user.id, user]));
    const data = bills.map((bill) => ({
      ...serializePrismaRecord(bill),
      history: (bill.history || []).map((entry) => ({
        ...entry,
        by: userById.get(entry.by) || entry.by,
      })),
    }));
    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalPaymentAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { status: "active", accountType: "asset" },
      select: { id: true, accountCode: true, accountName: true },
      orderBy: { accountCode: "asc" },
    });
    res.json({
      success: true,
      count: accounts.length,
      data: serializePrismaRecord(accounts),
    });
  } catch (error) {
    next(error);
  }
};

export const getBillableMedicalVisits = async (req, res, next) => {
  try {
    const isDoctor = ["doctor", "admin", "super_admin"].includes(req.user.role);
    if (!isDoctor && !["pharmacist", "pharmacy"].includes(req.user.role)) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const department = isDoctor ? "doctor" : "pharmacy";
    const [visits, billedVisits] = await Promise.all([
      prisma.medicalVisit.findMany({
        where: {
          status: { in: ["awaiting_pharmacy", "awaiting_billing"] },
          deletedAt: null,
        },
        include: {
          patient: { select: { id: true, patientNumber: true, firstName: true, lastName: true } },
        },
        orderBy: { visitDate: "desc" },
      }),
      prisma.medicalBill.findMany({
        where: {
          department: { in: [department, "hmis"] },
          status: { notIn: ["rejected", "returned", "voided"] },
        },
        select: { visitId: true },
        distinct: ["visitId"],
      }),
    ]);
    const billedVisitIds = new Set(billedVisits.map((bill) => bill.visitId));
    const billableVisits = serializePrismaRecord(visits.filter((visit) => !billedVisitIds.has(visit.id)));
    return res.json({ success: true, count: billableVisits.length, data: billableVisits });
  } catch (error) {
    return next(error);
  }
};

export const getPatientBillSummary = async (req, res, next) => {
  try {
    const visit = await prisma.medicalVisit.findUnique({ where: { id: req.params.id } });
    if (!visit) return res.status(404).json({ success: false, message: "Medical visit not found" });
    const [labResults, prescriptions, bill] = await Promise.all([
      prisma.medicalLabResult.findMany({
        where: {
          visitId: visit.id,
          status: { notIn: ["cancelled", "voided"] },
          deletedAt: null,
        },
      }),
      prisma.prescription.findMany({
        where: {
          visitId: visit.id,
          status: { notIn: ["cancelled", "voided"] },
          deletedAt: null,
        },
        include: { medications: true },
      }),
      prisma.medicalBill.findFirst({
        where: {
          visitId: visit.id,
          status: { notIn: ["rejected", "returned", "voided"] },
        },
      }),
    ]);
    const summary = calculatePatientBillingSummary({
      visit: serializePrismaRecord(visit),
      labResults: serializePrismaRecord(labResults),
      prescriptions: serializePrismaRecord(prescriptions),
      amountPaid: bill?.amountPaid || 0,
      existingBill: bill ? serializePrismaRecord(bill) : null,
    });
    return res.json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
};

export const createMedicalBill = async (req, res, next) => {
  try {
    if (!["doctor", "pharmacist", "pharmacy", "admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only the doctor or pharmacy can send visit charges to the cashier",
      });
    }
    const department = ["pharmacist", "pharmacy"].includes(req.user.role) ? "pharmacy" : "doctor";
    const visit = await prisma.medicalVisit.findUnique({ where: { id: req.body.visit } });
    if (!visit) return res.status(404).json({ success: false, message: "Medical visit not found" });
    if (visit.status === "cancelled") {
      return res.status(409).json({ success: false, message: "A cancelled visit cannot be billed" });
    }
    const allowedStatus = ["awaiting_pharmacy", "awaiting_billing"];
    if (!["admin", "super_admin"].includes(req.user.role) && !allowedStatus.includes(visit.status)) {
      return res.status(409).json({
        success: false,
        message: department === "doctor"
          ? "Complete the consultation and any requested lab work before sending the doctor bill"
          : "The pharmacy bill can be sent after the prescription has been dispensed",
      });
    }
    if (["pharmacist", "pharmacy"].includes(req.user.role) &&
        Array.isArray(req.body.items) && req.body.items.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Pharmacy staff cannot add manual charges to a patient bill",
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const activeBill = await transaction.medicalBill.findFirst({
        where: {
          visitId: visit.id,
          department: { in: [department, "hmis"] },
          status: { notIn: ["rejected", "returned", "voided"] },
        },
      });
      if (activeBill) {
        return { status: 409, message: `This visit already has an active ${department} bill` };
      }

      const [labResults, prescriptions] = await Promise.all([
        transaction.medicalLabResult.findMany({
          where: { visitId: visit.id, status: "completed", deletedAt: null },
        }),
        transaction.prescription.findMany({
          where: {
            visitId: visit.id,
            status: department === "pharmacy"
              ? { in: ["prescribed", "dispensed"] }
              : { notIn: ["cancelled", "voided"] },
            deletedAt: null,
          },
          include: { medications: true },
        }),
      ]);
      const billingSummary = calculatePatientBillingSummary({
        visit: serializePrismaRecord(visit),
        labResults: serializePrismaRecord(labResults),
        prescriptions: serializePrismaRecord(prescriptions),
        amountPaid: 0,
      });
      const departmentItems = department === "pharmacy"
        ? billingSummary.items.filter((item) => item.stage === "pharmacy")
        : billingSummary.items.filter((item) => item.stage !== "pharmacy");
      if (department === "pharmacy" && departmentItems.length === 0) {
        return { status: 409, message: "No prescribed medicines are linked to this visit" };
      }
      const extraItems = Array.isArray(req.body.items) ? req.body.items.map((item) => {
        const description = String(item.description || "").trim();
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        if (!description || !Number.isFinite(quantity) || quantity <= 0 ||
            !Number.isFinite(unitPrice) || unitPrice < 0) {
          throw Object.assign(new Error("Each charge needs a description, positive quantity, and valid rate"), { status: 400 });
        }
        return { description, quantity, unitPrice, total: quantity * unitPrice };
      }) : [];
      const items = [...departmentItems, ...extraItems];
      const totalAmount = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const bill = await transaction.medicalBill.create({
        data: {
          billNumber: `HB-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
          patientId: visit.patientId,
          visitId: visit.id,
          department,
          createdById: req.user.id,
          items: { create: items },
          totalAmount,
          amountPaid: 0,
          status: "approved",
          history: [{
            action: "sent_to_cashier",
            by: req.user.id,
            at: new Date().toISOString(),
            comment: `${department} charges sent to cashier`,
          }],
        },
        include: billInclude,
      });
      return { bill, billingSummary, departmentItems, totalAmount };
    }, { isolationLevel: "Serializable" });

    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    await logAudit({
      actor: req.user,
      action: "create",
      entity: "MedicalBill",
      entityId: result.bill.id,
      before: null,
      after: serializePrismaRecord(result.bill),
      metadata: { ip: req.ip },
    });
    return res.status(201).json({
      success: true,
      message: `${department === "doctor" ? "Doctor and completed lab" : "Pharmacy"} bill sent to the cashier`,
      data: {
        ...serializePrismaRecord(result.bill),
        billingSummary: {
          ...result.billingSummary,
          items: result.departmentItems,
          totalAmount: result.totalAmount,
        },
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return next(error);
  }
};
