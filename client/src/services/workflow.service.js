import api from "./api";

export const getPurchaseRequests = async () => (await api.get("/workflows/purchase-requests")).data;
export const getLifecycleTasks = async () => (await api.get("/workflows/tasks")).data;
export const decideLifecycleTask = async (type, id, payload) => (await api.post(`/workflows/tasks/${type}/${id}/decision`, payload)).data;
export const resubmitLifecycleTask = async (type, id, payload) => (await api.post(`/workflows/tasks/${type}/${id}/resubmit`, payload)).data;
export const submitPurchaseRequest = async (payload) => (await api.post("/workflows/purchase-requests", payload)).data;
export const resubmitPurchaseRequest = async (id, payload) => (await api.post(`/workflows/purchase-requests/${id}/resubmit`, payload)).data;
export const decidePurchaseRequest = async (id, payload) => (await api.post(`/workflows/purchase-requests/${id}/decision`, payload)).data;
export const getWorkflowPolicies = async () => (await api.get("/workflows/policies")).data;
export const createWorkflowPolicy = async (payload) => (await api.post("/workflows/policies", payload)).data;
export const updateWorkflowPolicy = async (id, payload) => (await api.put(`/workflows/policies/${id}`, payload)).data;
export const deleteWorkflowPolicy = async (id) => (await api.delete(`/workflows/policies/${id}`)).data;
