const moduleRoles = {
  farmers: ["farm_officer"],
  livestock: ["livestock"],
  animalFeeds: ["livestock"],
  milkCollection: ["dairy"],
  milkLaboratory: ["dairy", "laboratory"],
  milkValueAddition: ["dairy"],
  tea: ["farm_officer"],
  sugarcane: ["farm_officer"],
  hmisPatients: ["doctor", "nurse", "receptionist"],
  hmisSummary: ["doctor", "nurse", "laboratory", "pharmacist", "receptionist", "cashier"],
  hmisVisits: ["doctor", "nurse", "receptionist"],
  hmisLab: ["doctor", "nurse", "laboratory", "radiology"],
  hmisPrescriptions: ["doctor", "pharmacist", "pharmacy"],
  procurement: ["procurement"],
  suppliers: ["procurement"],
  salesReports: ["sales"],
  inventory: ["procurement", "sales", "livestock", "dairy", "farm_officer"],
  hmisBilling: ["doctor", "nurse", "finance"],
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
  hmisBilling: ["cashier"],
  farmers: ["livestock", "dairy", "doctor", "nurse"],
  milkCollection: ["laboratory"],
  suppliers: ["livestock", "dairy", "farm_officer", "sales"],
  salesReports: ["finance"],
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
