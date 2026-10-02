import express from "express";
import {
  decidePurchaseRequest,
  deleteWorkflowPolicy,
  listPurchaseRequests,
  listLifecycleTasks,
  listWorkflowPolicies,
  resubmitPurchaseRequest,
  saveWorkflowPolicy,
  submitPurchaseRequest,
  decideLifecycleTask,
  resubmitLifecycleTask,
} from "../controllers/workflow.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();
const adminsOnly = (req, res, next) => {
  if (["admin", "super_admin"].includes(req.user?.role)) return next();
  return res.status(403).json({ success: false, message: "Only administrators can manage approval policies" });
};

router.use(protect);
router.get("/purchase-requests", listPurchaseRequests);
router.post("/purchase-requests", submitPurchaseRequest);
router.post("/purchase-requests/:id/resubmit", resubmitPurchaseRequest);
router.post("/purchase-requests/:id/decision", decidePurchaseRequest);
router.get("/tasks", listLifecycleTasks);
router.post("/tasks/:workflowType/:id/decision", decideLifecycleTask);
router.post("/tasks/:workflowType/:id/resubmit", resubmitLifecycleTask);
router.get("/policies", adminsOnly, listWorkflowPolicies);
router.post("/policies", adminsOnly, saveWorkflowPolicy);
router.put("/policies/:id", adminsOnly, saveWorkflowPolicy);
router.delete("/policies/:id", adminsOnly, deleteWorkflowPolicy);

export default router;
