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
