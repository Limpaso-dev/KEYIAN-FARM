const moduleRoles = {
  farmers: ["farm_officer"],
  livestock: ["livestock"],
  animalFeeds: ["livestock"],
  dairy: ["dairy", "laboratory"],
  milkCollection: ["dairy"],
  milkLaboratory: ["dairy", "laboratory"],
  milkValueAddition: ["dairy"],
  agriculture: ["farm_officer"],
  hmis: ["doctor", "nurse", "laboratory", "pharmacist"],
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
  salesReports: ["finance"],
  milkCollection: ["laboratory"],
  suppliers: ["livestock", "dairy", "farm_officer", "sales"],
};

const routeModules = [
  ["/farmers", "farmers"],
  ["/livestock", "livestock"],
  ["/animal-feeds", "animalFeeds"],
  ["/dairy", "dairy"],
  ["/agriculture", "agriculture"],
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