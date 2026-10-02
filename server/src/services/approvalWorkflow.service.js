import WorkflowPolicy from "../models/WorkflowPolicy.js";

export const isWorkflowAdmin = (role) => ["admin", "super_admin"].includes(role);
export const userDepartment = (user) => (user.department || user.role || "").trim();

export const getApprovalSteps = async ({ workflowType, department, amount }) => {
  const policies = await WorkflowPolicy.find({
    workflowType,
    department: department.toLowerCase(),
    isActive: true,
  }).sort({ minAmount: -1 });
  const policy = policies.find((candidate) =>
    amount >= candidate.minAmount &&
    (candidate.maxAmount == null || amount <= candidate.maxAmount)
  );
  if (!policy) {
    const error = new Error(`No active ${workflowType.replaceAll("_", " ")} approval policy covers ${department} requests of this amount`);
    error.status = 409;
    error.statusCode = 409;
    throw error;
  }
  return {
    policyId: policy._id,
    steps: policy.steps.map(({ label, approverRole }) => ({
      label,
      approverRole,
      approverDepartment: approverRole === "manager" ? department : undefined,
      status: "pending",
    })),
  };
};

export const canApproveStep = (user, step) =>
  isWorkflowAdmin(user.role) || (
    step?.approverRole === user.role &&
    (step.approverRole !== "manager" || step.approverDepartment?.toLowerCase() === userDepartment(user).toLowerCase())
  );

export const applyWorkflowDecision = (record, user, decision, comment = "") => {
  const step = record.approvalSteps?.[record.currentStep];
  if (!step || !canApproveStep(user, step)) {
    const error = new Error("This item is not assigned to your approval role");
    error.status = 403;
    throw error;
  }
  if (String(record.requestedBy || record.submittedBy || record.createdBy) === String(user._id)) {
    const error = new Error("You cannot approve your own submission");
    error.status = 403;
    throw error;
  }
  if (!["approve", "reject", "return"].includes(decision)) {
    const error = new Error("Choose approve, reject, or return");
    error.status = 400;
    throw error;
  }
  if (["reject", "return"].includes(decision) && !String(comment).trim()) {
    const error = new Error("Add a comment when rejecting or returning an item");
    error.status = 400;
    throw error;
  }

  const action = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "returned";
  step.status = action;
  step.decidedBy = user._id;
  step.decidedAt = new Date();
  step.comment = String(comment).trim();
  record.history.push({ action, by: user._id, at: new Date(), comment: step.comment, stepLabel: step.label });
  if (decision === "reject") record.status = "rejected";
  else if (decision === "return") record.status = "returned";
  else if (record.currentStep + 1 >= record.approvalSteps.length) record.status = "approved";
  else record.currentStep += 1;
  return decision === "approve" && record.status === "approved";
};
