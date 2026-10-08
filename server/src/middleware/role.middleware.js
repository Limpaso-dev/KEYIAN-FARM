const moduleRoles = {
  farmers: ["farm_officer"],
  livestock: ["livestock"],
  animalFeeds: ["livestock"],
  milkCollection: ["dairy"],
  milkLaboratory: ["dairy", "laboratory"],
  milkValueAddition: ["dairy"],
  tea: ["farm_officer"],
  sugarcane: ["farm_officer"],
  procurement: ["procurement"],
  suppliers: ["procurement"],
  salesReports: ["sales"],
  inventory: ["procurement", "sales", "livestock", "dairy", "farm_officer"],
  receiving: ["procurement", "stores"],
  finance: ["finance"],
  hr: ["hr"],
  sales: ["sales"],
  rentals: [],
};

const readOnlyModuleRoles = {
  procurement: ["stores"],
  inventory: ["stores"],
  livestock: ["farm_officer"],
  farmers: ["livestock", "dairy", "doctor", "nurse"],
  milkCollection: ["laboratory"],
  suppliers: ["livestock", "dairy", "farm_officer", "sales"],
  salesReports: ["finance"],
};

const hmisActionRoles = {
  summary: ["doctor", "nurse", "laboratory", "pharmacist", "pharmacy", "receptionist", "cashier", "finance"],
  patientsRead: ["doctor", "nurse", "receptionist", "pharmacist", "pharmacy"],
  patientsCreate: ["receptionist"],
  patientsUpdate: ["receptionist"],
  visitsRead: ["doctor", "nurse", "receptionist"],
  visitsCreate: ["receptionist"],
  visitsUpdate: ["doctor", "nurse", "receptionist"],
  visitsClinicalActions: ["doctor"],
  labRead: ["doctor", "nurse", "laboratory"],
  labWrite: ["laboratory"],
  prescriptionsRead: ["doctor", "nurse", "pharmacist", "pharmacy"],
  prescriptionsCreate: ["doctor"],
  prescriptionsUpdate: ["doctor", "pharmacist", "pharmacy"],
  billsRead: ["doctor", "nurse", "pharmacist", "pharmacy", "finance", "cashier"],
  billsCreate: ["doctor", "pharmacist", "pharmacy"],
  billsPay: ["finance", "cashier"],
};

export const authorizeHMIS = (action) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const allowedRoles = hmisActionRoles[action] || [];
  if (["admin", "super_admin"].includes(req.user.role) || allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ success: false, message: "You are not authorized to perform this HMIS action" });
};

export const authorizeModule = (moduleName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const role = req.user.role;
    const isReadRequest = ["GET", "HEAD", "OPTIONS"].includes(req.method);
    const hasModuleAccess = moduleRoles[moduleName]?.includes(role);
    const hasReadOnlyModuleAccess =
      isReadRequest && readOnlyModuleRoles[moduleName]?.includes(role);
    const isAdministrator = ["admin", "super_admin"].includes(role);
    const isReadOnlyManager = role === "manager" && isReadRequest;

    if (
      !isAdministrator &&
      !isReadOnlyManager &&
      !hasModuleAccess &&
      !hasReadOnlyModuleAccess
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action",
      });
    }

    next();
  };
};
