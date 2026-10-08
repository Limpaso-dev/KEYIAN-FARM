import { randomInt } from "node:crypto";
import MedicalBill from "../models/MedicalBill.js";
import MedicalVisit from "../models/MedicalVisit.js";
import MedicalLabResult from "../models/MedicalLabResult.js";
import Prescription from "../models/Prescription.js";
import Account from "../models/Account.js";
import { logAudit } from "../utils/globalRules.js";
import { normalizeBillStatus, calculateBillBalance, calculatePatientBillingSummary } from "../utils/billing.js";

export const listMedicalBills = async (req, res, next) => {
  try {
    const activeFilter = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
    const filter = req.user.role === "cashier"
      ? { ...activeFilter, status: { $in: ["approved", "partially_paid", "paid"] } }
      : ["finance", "admin", "super_admin", "manager"].includes(req.user.role)
        ? activeFilter
        : { createdBy: req.user._id, ...activeFilter };
    const bills = await MedicalBill.find(filter)
      .populate("patient", "patientNumber firstName lastName nationalId phone dateOfBirth estimatedAge sex address status")
      .populate("visit", "visitDate visitType")
      .populate("createdBy", "name role")
      .populate("history.by", "name role")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bills.length, data: bills });
  } catch (error) { next(error); }
};

export const getMedicalPaymentAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ status: "active", accountType: "asset" })
      .select("accountCode accountName")
      .sort({ accountCode: 1 })
      .lean();
    res.json({ success: true, count: accounts.length, data: accounts });
  } catch (error) { next(error); }
};

export const getBillableMedicalVisits = async (req, res, next) => {
  try {
    const isDoctor = ["doctor", "admin", "super_admin"].includes(req.user.role);
    if (!isDoctor && !["pharmacist", "pharmacy"].includes(req.user.role)) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const department = isDoctor ? "doctor" : "pharmacy";
    const statuses = ["awaiting_pharmacy", "awaiting_billing"];
    const [visits, billedVisits] = await Promise.all([MedicalVisit.find({
      status: { $in: statuses },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .populate("patient", "patientNumber firstName lastName")
      .select("patient visitNumber visitDate visitType status")
      .sort({ visitDate: -1 })
      .lean(), MedicalBill.distinct("visit", { department: { $in: [department, "hmis"] }, status: { $nin: ["rejected", "returned", "voided"] } })]);
    const billableVisits = visits.filter((visit) => !billedVisits.some((id) => String(id) === String(visit._id)));
    res.json({ success: true, count: billableVisits.length, data: billableVisits });
  } catch (error) { next(error); }
};

export const getPatientBillSummary = async (req, res, next) => {
  try {
    const visit = await MedicalVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: "Medical visit not found" });

    const [labResults, prescriptions, bill] = await Promise.all([
      MedicalLabResult.find({ visit: visit._id, status: { $nin: ["cancelled", "voided"] }, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
      Prescription.find({ visit: visit._id, status: { $nin: ["cancelled", "voided"] }, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
      MedicalBill.findOne({ visit: visit._id, status: { $nin: ["rejected", "returned", "voided"] } }).lean(),
    ]);

    const summary = calculatePatientBillingSummary({
      visit: visit.toObject(),
      labResults,
      prescriptions,
      amountPaid: bill?.amountPaid || 0,
      existingBill: bill,
    });

    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
};

export const createMedicalBill = async (req, res, next) => {
  try {
    if (!["doctor", "pharmacist", "pharmacy", "admin", "super_admin"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Only the doctor or pharmacy can send visit charges to the cashier" });
    const department = ["pharmacist", "pharmacy"].includes(req.user.role) ? "pharmacy" : "doctor";
    const visit = await MedicalVisit.findById(req.body.visit);
    if (!visit) return res.status(404).json({ success: false, message: "Medical visit not found" });
    if (visit.status === "cancelled") return res.status(409).json({ success: false, message: "A cancelled visit cannot be billed" });
    const allowedStatus = ["awaiting_pharmacy", "awaiting_billing"];
    if (!['admin', 'super_admin'].includes(req.user.role) && !allowedStatus.includes(visit.status)) {
      return res.status(409).json({ success: false, message: department === "doctor" ? "Complete the consultation and any requested lab work before sending the doctor bill" : "The pharmacy bill can be sent after the prescription has been dispensed" });
    }
    if (["pharmacist", "pharmacy"].includes(req.user.role) && Array.isArray(req.body.items) && req.body.items.length > 0) {
      return res.status(403).json({ success: false, message: "Pharmacy staff cannot add manual charges to a patient bill" });
    }
    if (await MedicalBill.exists({ visit: visit._id, department: { $in: [department, "hmis"] }, status: { $nin: ["rejected", "returned", "voided"] } })) {
      return res.status(409).json({ success: false, message: `This visit already has an active ${department} bill` });
    }

    const [labResults, prescriptions] = await Promise.all([
      MedicalLabResult.find({ visit: visit._id, status: "completed", $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
      Prescription.find({ visit: visit._id, status: department === "pharmacy" ? { $in: ["prescribed", "dispensed"] } : { $nin: ["cancelled", "voided"] }, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
    ]);

    const billingSummary = calculatePatientBillingSummary({
      visit: visit.toObject(),
      labResults,
      prescriptions,
      amountPaid: 0,
    });

    const departmentItems = department === "pharmacy"
      ? billingSummary.items.filter((item) => item.stage === "pharmacy")
      : billingSummary.items.filter((item) => item.stage !== "pharmacy");
    if (department === "pharmacy" && departmentItems.length === 0) {
      return res.status(409).json({ success: false, message: "No prescribed medicines are linked to this visit" });
    }
    const extraItems = Array.isArray(req.body.items) ? req.body.items.map((item) => {
          const description = String(item.description || "").trim();
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Each charge needs a description, positive quantity, and valid rate");
          return { description, quantity, unitPrice, total: quantity * unitPrice };
        }) : [];
    const items = [...departmentItems, ...extraItems];

    const totalAmount = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const bill = await MedicalBill.create({
      billNumber: `HB-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
      patient: visit.patient, visit: visit._id, department, createdBy: req.user._id,
      items, totalAmount, amountPaid: 0,
      status: "approved", history: [{ action: "sent_to_cashier", by: req.user._id, comment: `${department} charges sent to cashier` }],
    });
    await logAudit({
      actor: req.user,
      action: "create",
      entity: "MedicalBill",
      entityId: bill._id,
      before: null,
      after: bill.toObject(),
      metadata: { ip: req.ip },
    });
    await bill.populate([{ path: "patient", select: "patientNumber" }, { path: "visit", select: "visitDate visitType" }, { path: "createdBy", select: "name role" }]);
    res.status(201).json({ success: true, message: `${department === "doctor" ? "Doctor and completed lab" : "Pharmacy"} bill sent to the cashier`, data: { ...bill.toObject(), billingSummary: { ...billingSummary, items: departmentItems, totalAmount } } });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};
