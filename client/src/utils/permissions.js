const moduleRoles = {
  workflows: ["super_admin", "admin", "manager", "finance", "hr", "procurement", "stores", "livestock", "dairy", "laboratory", "doctor", "nurse", "pharmacist", "sales", "farm_officer", "staff"],
  farmers: ["farm_officer"],
  livestock: ["livestock"],
  animalFeeds: ["livestock"],
  dairy: ["dairy"],
  milkCollection: ["dairy"],
  milkLaboratory: ["dairy", "laboratory"],
  milkValueAddition: ["dairy"],
  agriculture: ["farm_officer"],
  hmis: ["doctor", "nurse", "laboratory", "pharmacist", "receptionist", "cashier", "finance", "pharmacy"],
  hmisBilling: ["doctor", "nurse", "pharmacist", "pharmacy", "finance", "cashier"],
  hmisPatients: ["doctor", "nurse", "receptionist"],
  hmisVisits: ["doctor", "nurse", "receptionist"],
  hmisLab: ["doctor", "nurse", "laboratory"],
  hmisPrescriptions: ["doctor", "nurse", "pharmacist", "pharmacy"],
  hmisSummary: ["doctor", "nurse", "laboratory", "pharmacist", "receptionist", "cashier"],
  procurement: ["procurement"],
  suppliers: ["procurement"],
  inventory: ["procurement", "sales", "livestock", "dairy", "farm_officer"],
  finance: ["finance"],
  hr: ["hr"],
  sales: ["sales"],
  salesReports: ["sales"],
  reports: ["farm_officer", "finance", "sales"],
  rentals: [],
  settings: [],
};

const readOnlyModuleRoles = {
  hmisPatients: ["pharmacist", "pharmacy"],
  inventory: ["stores"],
  livestock: ["farm_officer"],
  salesReports: ["finance"],
  milkCollection: ["laboratory"],
  suppliers: ["livestock", "dairy", "farm_officer", "sales"],
};

const routeModules = [
  ["/workflows", "workflows"],
  ["/hmis/billing", "hmisBilling"],
  ["/farmers", "farmers"],
  ["/livestock", "livestock"],
  ["/animal-feeds", "animalFeeds"],
  ["/dairy", "dairy"],
  ["/agriculture", "agriculture"],
  ["/hmis/patients", "hmisPatients"],
  ["/hmis/visits", "hmisVisits"],
  ["/hmis/laboratory", "hmisLab"],
  ["/hmis/prescriptions", "hmisPrescriptions"],
  ["/hmis", "hmis"],
  ["/procurement", "procurement"],
  ["/inventory", "inventory"],
  ["/finance", "finance"],
  ["/hr", "hr"],
  ["/rentals", "rentals"],
  ["/sales", "sales"],
  ["/reports", "reports"],
  ["/settings", "settings"],
];

export const canAccessModule = (role, moduleName, method = "GET") => {
  if (["admin", "super_admin"].includes(role)) return true;
  const isReadRequest = ["GET", "HEAD", "OPTIONS"].includes(method);
  if (role === "manager") return isReadRequest && moduleName !== "settings";
  return (
    moduleRoles[moduleName]?.includes(role) ||
    (isReadRequest && readOnlyModuleRoles[moduleName]?.includes(role)) ||
    false
  );
};

export const getModuleForPath = (pathname) =>
  routeModules.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] || null;
