const relationAliases = {
  actorId: "actor",
  accountId: "account",
  approvedById: "approvedBy",
  billId: "bill",
  clinicianId: "clinician",
  createdById: "createdBy",
  customerId: "customer",
  deletedById: "deletedBy",
  employeeId: "employee",
  farmId: "farm",
  farmerId: "farmer",
  goodsReceiptId: "goodsReceipt",
  inventoryItemId: "inventoryItem",
  invoiceId: "invoice",
  leaseId: "lease",
  milkCollectionId: "milkCollection",
  patientId: "patient",
  performedById: "performedBy",
  policyId: "policy",
  prescribedById: "prescribedBy",
  propertyId: "property",
  purchaseOrderId: "purchaseOrder",
  purchaseRequestId: "purchaseRequest",
  recordedById: "recordedBy",
  receivedById: "receivedBy",
  releasedById: "releasedBy",
  requestedById: "requestedBy",
  saleId: "sale",
  supplierId: "supplier",
  submittedById: "submittedBy",
  testedById: "testedBy",
  transactionId: "transaction",
  visitId: "visit",
  voidedById: "voidedBy",
};

export const serializePrismaRecord = (record) => {
  if (Array.isArray(record)) return record.map(serializePrismaRecord);
  if (!record || typeof record !== "object") return record;
  if (record instanceof Date) return record;
  if (typeof record.toNumber === "function" && record.constructor?.name === "Decimal") {
    return record.toNumber();
  }

  const serialized = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "id") {
      serialized.id = value;
      serialized._id = value;
      continue;
    }

    const alias = relationAliases[key];
    if (alias) {
      if (!(alias in record)) serialized[alias] = value;
      continue;
    }

    serialized[key] = serializePrismaRecord(value);
  }
  return serialized;
};

export const prismaData = (body, fields, relationFields = {}, dateFields = []) => {
  const data = {};
  for (const field of fields) {
    const inputField = Object.entries(relationFields).find(([, target]) => target === field)?.[0] || field;
    if (!Object.hasOwn(body, inputField)) continue;
    const value = body[inputField];
    if (value === undefined) continue;
    data[field] = dateFields.includes(field) && value !== null && !(value instanceof Date)
      ? new Date(value)
      : value;
  }
  return data;
};
