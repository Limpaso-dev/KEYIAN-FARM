import { randomInt } from "node:crypto";
import MedicalBill from "../models/MedicalBill.js";
import MedicalVisit from "../models/MedicalVisit.js";
import MedicalLabResult from "../models/MedicalLabResult.js";
import Prescription from "../models/Prescription.js";
import { logAudit } from "../utils/globalRules.js";
import { getApprovalSteps } from "../services/approvalWorkflow.service.js";
import { normalizeBillStatus, calculateBillBalance, calculatePatientBillingSummary } from "../utils/billing.js";

export const listMedicalBills = async (req, res, next) => {
  try {
    const filter = ["finance", "admin", "super_admin", "manager"].includes(req.user.role)
      ? { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
      : { createdBy: req.user._id, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
    const bills = await MedicalBill.find(filter)
      .populate("patient", "patientNumber")
      .populate("visit", "visitDate visitType")
      .populate("createdBy", "name role")
      .populate("history.by", "name role")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bills.length, data: bills });
  } catch (error) { next(error); }
};

export const getPatientBillSummary = async (req, res, next) => {
  try {
    const visit = await MedicalVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: "Medical visit not found" });

    const [labResults, prescriptions, bill] = await Promise.all([
      MedicalLabResult.find({ patient: visit.patient, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
      Prescription.find({ patient: visit.patient, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
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
    if (!["doctor", "nurse", "admin", "super_admin"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Only clinical staff can create a patient bill" });
    const visit = await MedicalVisit.findById(req.body.visit);
    if (!visit) return res.status(404).json({ success: false, message: "Medical visit not found" });
    if (visit.status === "cancelled") return res.status(409).json({ success: false, message: "A cancelled visit cannot be billed" });
    if (await MedicalBill.exists({ visit: visit._id, status: { $nin: ["rejected", "returned"] } })) {
      return res.status(409).json({ success: false, message: "This visit already has an active bill" });
    }

    const [labResults, prescriptions] = await Promise.all([
      MedicalLabResult.find({ patient: visit.patient, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
      Prescription.find({ patient: visit.patient, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }).lean(),
    ]);

    const billingSummary = calculatePatientBillingSummary({
      visit: visit.toObject(),
      labResults,
      prescriptions,
      amountPaid: 0,
    });

    const items = Array.isArray(req.body.items) && req.body.items.length > 0
      ? req.body.items.map((item) => {
          const description = String(item.description || "").trim();
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Each charge needs a description, positive quantity, and valid rate");
          return { description, quantity, unitPrice, total: quantity * unitPrice };
        })
      : billingSummary.items;

    const totalAmount = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const { policyId, steps } = await getApprovalSteps({ workflowType: "hmis_bill", department: "hmis", amount: totalAmount });
    const bill = await MedicalBill.create({
      billNumber: `HB-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
      patient: visit.patient, visit: visit._id, createdBy: req.user._id,
      items, totalAmount, amountPaid: 0, status: "pending_approval", approvalSteps: steps,
      policy: policyId, history: [{ action: "submitted", by: req.user._id }],
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
    res.status(201).json({ success: true, message: "Patient bill sent to Finance for approval", data: { ...bill.toObject(), billingSummary } });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};
