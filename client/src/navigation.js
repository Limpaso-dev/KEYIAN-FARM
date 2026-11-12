import {
  ClipboardList,
  FileBarChart2,
  FlaskConical,
  LayoutDashboard,
  PawPrint,
  ShoppingCart,
  Sprout,
  UserCog,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

/** Whether a department appears for this user: their own; all for the General Manager and admins (server-decided). */
export const opensDepartment = (auth, department) => Boolean(auth.permissions?.departments?.includes(department));
const member = (department) => (auth) => opensDepartment(auth, department);
// A section is open to users who can read the resource (or do the action) behind it.
const can = (resource, action) => (auth) => auth.can(resource, action);

export const NAV_GROUPS = [
  { key: "overview", label: "Overview" },
  { key: "departments", label: "Departments" },
  { key: "workflow", label: "Workflow" },
  { key: "admin", label: "Administration" },
];

/**
 * The Requisitions dropdown: requests to Accounts (money and things to buy),
 * and product requests - Sales asks MVA, the administration asks Sales (office
 * use). Each is named from where the user stands. Those who decide
 * requisitions see them first.
 */
const requisitionSections = (auth) => {
  const req = auth.permissions?.requisitions || {};
  const products = auth.permissions?.productRequests || {};
  const asks = (department) => Boolean(products.raiseTo?.includes(department));
  const handles = (department) => Boolean(products.handles?.includes(department));
  const accounts = req.raise || req.seeAll || req.decide || req.fulfil ? [{ key: "accounts", label: req.seeAll ? "Requisitions" : "To Accounts" }] : [];
  const fromMva = asks("mva") || handles("mva") || products.seeAll ? [{ key: "mva", label: handles("mva") ? "Requests from Sales" : asks("mva") ? "Products from MVA" : "Sales requests to MVA" }] : [];
  const fromSales = asks("sales") || handles("sales") || products.seeAll ? [{ key: "sales", label: asks("sales") ? "Products from Sales" : "Office requests" }] : [];
  return req.decide || req.seeAll ? [...accounts, ...fromMva, ...fromSales] : [...fromMva, ...fromSales, ...accounts];
};

/** Where the Reports page opens when no report is named: the user's own department; all departments for those who see several. */
export const defaultReportDepartment = (auth) => {
  const allowed = auth.permissions?.reports || [];
  if (auth.user?.department && allowed.includes(auth.user.department)) return auth.user.department;
  return allowed.length > 1 ? "all" : allowed[0] || "";
};

const reportPath = (department, part) => `/reports?department=${department}${part ? `&part=${part}` : ""}`;

/**
 * The Reports dropdown: every report this user can open. A department whose
 * report comes in parts (Stores: stock out, goods received, stock remaining)
 * lists each part, then its full report. With several departments, those
 * come under the department's name, after the departments with one report.
 */
const reportSections = (auth) => {
  const departments = auth.permissions?.reports || [];
  const several = departments.length > 1;
  const nameOf = (department) => {
    const item = navForDepartment(department);
    return item?.short || item?.label || department;
  };
  const single = [];
  const grouped = [];
  for (const department of departments) {
    const name = nameOf(department);
    const parts = auth.meta?.reportParts?.[department] || [];
    if (!parts.length) {
      single.push({ key: department, label: several ? name : `${name} report`, crumb: `${name} report`, to: reportPath(department) });
      continue;
    }
    if (several) grouped.push({ key: `heading-${department}`, heading: true, label: name });
    for (const part of parts) {
      grouped.push({ key: `${department}:${part.key}`, label: part.title, crumb: several ? `${name}: ${part.title}` : part.title, to: reportPath(department, part.key) });
    }
    grouped.push({ key: department, label: "Full report", crumb: `${name} report`, to: reportPath(department) });
  }
  const all = several ? [{ key: "all", label: "All departments", crumb: "All departments", to: reportPath("all") }] : [];
  return [...all, ...single, ...grouped];
};

/** The report on screen, as the key of its entry in the Reports dropdown. */
const reportKey = (params, auth) => {
  const department = params.get("department") || defaultReportDepartment(auth);
  const part = params.get("part");
  return part && department !== "all" ? `${department}:${part}` : department;
};

// Sidebar and dashboard links. A department appears to its own staff, and to
// the General Manager and administrators (permissions come from the server).
// Its sections open from a dropdown under it in the sidebar, and each user
// sees only the sections they can open. A section's key is its ?tab= in the address, so links such as
// /stores?tab=items open that section directly.
export const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "overview", hint: "Today at a glance", visible: () => true },
  {
    label: "HR", path: "/hr", icon: UserCog, group: "departments", department: "hr", hint: "Staff, payroll, discipline, members", visible: member("hr"),
    sections: [
      { key: "staff", label: "Staff", show: can("employees") },
      { key: "establishment", label: "Staff establishment", show: can("jobAdverts") },
      { key: "contracts", label: "Contracts", show: can("contracts") },
      { key: "reviews", label: "Salary reviews", show: can("salaryReviews") },
      { key: "payroll", label: "Payroll", show: can("payroll") },
      { key: "discipline", label: "Disciplinary", show: can("disciplinary") },
      { key: "terminations", label: "Terminations", show: can("terminations") },
      { key: "members", label: "Members", show: can("members") },
      { key: "succession", label: "Succession register", show: can("members") },
    ],
  },
  {
    label: "Livestock", path: "/livestock", icon: PawPrint, group: "departments", department: "livestock", hint: "Herd, health, milk records", visible: member("livestock"),
    sections: [
      { key: "herd", label: "Herd", show: can("animals") },
      { key: "lactations", label: "Calvings & lactations", show: can("lactations") },
      { key: "vaccinations", label: "Vaccinations", show: can("vaccinations") },
      { key: "health", label: "Health", show: can("healthRecords") },
      { key: "milk", label: "Milk records", show: can("milkRecords") },
      { key: "transfers", label: "To MVA", show: can("milkTransfers") },
    ],
  },
  {
    label: "Milk Value Addition", short: "MVA", path: "/mva", icon: FlaskConical, group: "departments", department: "mva", hint: "Milk intake, processing, to Sales", visible: member("mva"),
    sections: [
      { key: "collection", label: "Farmer milk", show: can("milkDeliveries") },
      { key: "livestock", label: "From Livestock", show: (a) => a.can("milkTransfers", "receive") || a.user?.department === "mva" },
      { key: "allocation", label: "Allocation", show: can("milkAllocations") },
      { key: "processing", label: "Product output", show: can("processingBatches") },
      { key: "transfers", label: "To Sales", show: can("productTransfers") },
      { key: "stock", label: "Stock", show: can("mvaStock") },
      { key: "farmers", label: "Farmers", show: can("milkSuppliers") },
      { key: "prices", label: "Milk price", show: can("milkPrices") },
    ],
  },
  {
    label: "Sales", path: "/sales", icon: ShoppingCart, group: "departments", department: "sales", hint: "Local sales, vehicles, stock", visible: member("sales"),
    sections: [
      { key: "received", label: "From MVA", show: can("productTransfers", "receive") },
      { key: "vehicles-out", label: "Vehicle sales", show: can("dispatches") },
      { key: "sales", label: "Local sales", show: can("sales") },
      { key: "damages", label: "Damages & returns", show: can("damages") },
      { key: "stock", label: "Stock", show: can("salesStock") },
      { key: "vehicles", label: "Vehicles", show: can("vehicles") },
      { key: "products", label: "Prices", show: can("products") },
    ],
  },
  {
    label: "Stores", path: "/stores", icon: Warehouse, group: "departments", department: "stores", hint: "Items, goods received, stock out", visible: member("stores"),
    sections: [
      { key: "items", label: "Items", show: can("storeItems") },
      { key: "receipts", label: "Goods received", show: can("storeReceipts") },
      { key: "issues", label: "Stock out", show: can("storeIssues") },
    ],
  },
  {
    label: "Crops", path: "/crops", icon: Sprout, group: "departments", department: "crops", hint: "Sugarcane, tea, coffee", visible: member("crops"),
    sections: [
      { key: "farms", label: "Farms", show: can("cropFarms") },
      { key: "harvests", label: "Harvests", show: can("cropHarvests") },
      { key: "reports", label: "Reports", show: can("cropFarms") },
    ],
  },
  {
    label: "Accounts", path: "/accounts", icon: Wallet, group: "departments", department: "accounts", hint: "Income, expenses, payments", visible: member("accounts"),
    sections: [
      { key: "entries", label: "Income & expenses", show: can("transactions") },
      { key: "accounts", label: "Accounts", show: can("accounts") },
      { key: "milk", label: "Farmer payments", show: can("milkPayments") },
      { key: "farmers", label: "Farmers", show: can("farmerDetails") },
      { key: "salaries", label: "Salaries", show: can("payroll", "pay") },
      { key: "members", label: "Member payments", show: can("memberPayments") },
      { key: "orders", label: "Purchase orders", show: can("purchaseOrders") },
      { key: "suppliers", label: "Suppliers", show: can("suppliers") },
    ],
  },
  { label: "Requisitions", path: "/requisitions", icon: ClipboardList, group: "workflow", hint: "Request and approve; product requests", visible: (a) => requisitionSections(a).length > 0, sections: requisitionSections },
  // Reports open from a dropdown of every report the user can see; its entries are worked out from their permissions.
  { label: "Reports", path: "/reports", icon: FileBarChart2, group: "workflow", hint: "Daily to annual reports, PDF / CSV", visible: (a) => Boolean(a.permissions?.reports?.length), sections: reportSections, keyOf: reportKey },
  { label: "User accounts", path: "/users", icon: Users, group: "admin", hint: "Create and manage logins", visible: (a) => Boolean(a.permissions?.manageUsers) },
];

export const findNavItem = (pathname) =>
  navigation.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

export const navForDepartment = (department) => navigation.find((item) => item.department === department);

/** The sections of a page this user can open, in sidebar order (a list, or worked out from the user). */
export const sectionsFor = (item, auth) => {
  const sections = typeof item?.sections === "function" ? item.sections(auth) : item?.sections || [];
  return sections.filter((section) => !section.show || section.show(auth));
};

/** The sections that open something, leaving out the headings that group them. */
export const linksOf = (sections) => sections.filter((section) => !section.heading);

/**
 * The section on screen: for a department, the one named in ?tab= when this
 * user can open it, otherwise their first; for Reports, the report shown.
 */
export const currentSection = (item, auth, search = "") => {
  const sections = linksOf(sectionsFor(item, auth));
  const params = new URLSearchParams(search);
  if (item?.keyOf) return sections.find((section) => section.key === item.keyOf(params, auth)) || null;
  return sections.find((section) => section.key === params.get("tab")) || sections[0] || null;
};

/** The address that opens a section. */
export const sectionPath = (item, section) => section.to || `${item.path}?tab=${section.key}`;

/** What identifies a page with a dropdown in the sidebar: its department, or its address. */
export const groupOf = (item) => item?.department || item?.path.slice(1) || null;
