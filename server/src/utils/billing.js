export const calculateBillBalance = ({ totalAmount, amountPaid }) => {
  const total = Number(totalAmount) || 0;
  const paid = Number(amountPaid) || 0;
  return Math.max(total - paid, 0);
};

export const normalizeBillStatus = ({ totalAmount, amountPaid, currentStatus }) => {
  const status = String(currentStatus || "").trim();
  const total = Number(totalAmount) || 0;
  const paid = Number(amountPaid) || 0;

  if (paid >= total && total > 0) return "paid";
  if (paid > 0 && paid < total) return "partially_paid";
  if (status && ["approved", "pending_approval", "rejected", "returned", "partially_paid", "paid", "voided"].includes(status)) {
    return status;
  }

  return "approved";
};

const DEFAULT_STAGE_CHARGES = {
  registration: 500,
  triage: 800,
  consultation: 1500,
  lab: 2000,
  pharmacy: 250,
  admission: 12000,
  discharge: 3000,
};

const addLineItem = (items, description, quantity, unitPrice, stage) => {
  const safeQuantity = Number(quantity) || 1;
  const safeUnitPrice = Number(unitPrice) || 0;

  if (safeUnitPrice <= 0) return;

  items.push({
    description,
    quantity: safeQuantity,
    unitPrice: safeUnitPrice,
    total: safeQuantity * safeUnitPrice,
    stage,
  });
};

export const calculatePatientBillingSummary = ({
  visit = {},
  labResults = [],
  prescriptions = [],
  amountPaid = 0,
  existingBill = null,
  additionalItems = [],
}) => {
  const items = [];

  if (visit?.visitNumber || visit?.chiefComplaint || visit?.assessment || visit?.diagnosis) {
    addLineItem(items, "Registration & initial assessment", 1, DEFAULT_STAGE_CHARGES.registration, "registration");
  }

  if (visit?.triageCompletedAt || visit?.triagePriority) {
    addLineItem(items, "Triage assessment", 1, DEFAULT_STAGE_CHARGES.triage, "triage");
  }

  if (visit?.assessment || visit?.diagnosis || visit?.clinicalNotes) {
    addLineItem(items, "Consultation & clinical review", 1, DEFAULT_STAGE_CHARGES.consultation, "consultation");
  }

  if (visit?.status === "admitted" || visit?.admissionReason || visit?.ward || visit?.bedNumber) {
    addLineItem(items, "Admission & ward stay", 1, DEFAULT_STAGE_CHARGES.admission, "admission");
  }

  if (visit?.dischargeSummary || visit?.dischargePlan || visit?.disposition === "discharge") {
    addLineItem(items, "Discharge summary & follow-up planning", 1, DEFAULT_STAGE_CHARGES.discharge, "discharge");
  }

  (labResults || []).filter((labResult) => !["cancelled", "voided"].includes(labResult?.status) && !labResult?.deletedAt).forEach((labResult) => {
    const unitPrice = Number(labResult?.unitPrice || DEFAULT_STAGE_CHARGES.lab);
    const testName = labResult?.testName || "Investigation";
    addLineItem(items, `Lab: ${testName}`, 1, unitPrice, "lab");
  });

  (prescriptions || []).filter((prescription) => !["cancelled", "voided"].includes(prescription?.status) && !prescription?.deletedAt).forEach((prescription) => {
    const medications = Array.isArray(prescription?.medications) ? prescription.medications : [];

    medications.forEach((medication, index) => {
      const medicationName = medication?.name || `Medication ${index + 1}`;
      const quantity = Number(medication?.quantity || 1);
      const unitPrice = Number(medication?.unitPrice || DEFAULT_STAGE_CHARGES.pharmacy);
      addLineItem(items, `Prescription: ${medicationName}`, quantity, unitPrice, "pharmacy");
    });
  });

  (additionalItems || []).forEach((item) => {
    const quantity = Number(item?.quantity || 1);
    const unitPrice = Number(item?.unitPrice || item?.total || 0);
    if (!item?.description) return;
    addLineItem(items, item.description, quantity, unitPrice, item?.stage || "additional");
  });

  const totalAmount = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const paid = Number(amountPaid ?? existingBill?.amountPaid ?? 0) || 0;

  return {
    items,
    totalAmount,
    amountPaid: paid,
    balance: Math.max(totalAmount - paid, 0),
    status: normalizeBillStatus({
      totalAmount,
      amountPaid: paid,
      currentStatus: existingBill?.status || "approved",
    }),
  };
};
