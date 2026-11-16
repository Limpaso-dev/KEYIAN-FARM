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
 * product requests - Sales asks MVA, the administration asks Sales (office
 * use) - and requests to Stores for its items. Each is named from where the
 * user stands. Those who decide requisitions see them first. Stores answers
 * its requests under Stores > Requests, so they are not listed here for it.
 * To Accounts and To Stores count the answers (approved, rejected, dispatched
 * ...) to the department's requests since the user last opened them.
 */
const requisitionSections = (auth) => {
  const req = auth.permissions?.requisitions || {};
  const products = auth.permissions?.productRequests || {};
  const asks = (department) => Boolean(products.raiseTo?.includes(department));
  const handles = (department) => Boolean(products.handles?.includes(department));
  const accounts = req.raise || req.seeAll || req.decide || req.fulfil ? [{ key: "accounts", label: req.seeAll ? "Requisitions" : "To Accounts", ...(req.raise ? { count: "requisitionAnswers" } : {}) }] : [];
  const fromMva = asks("mva") || handles("mva") || products.seeAll ? [{ key: "mva", label: handles("mva") ? "Requests from Sales" : asks("mva") ? "Products from MVA" : "Sales requests to MVA" }] : [];
  const fromSales = asks("sales") || handles("sales") || products.seeAll ? [{ key: "sales", label: asks("sales") ? "Products from Sales" : "Office requests" }] : [];
  const store = auth.permissions?.storeRequests || {};
  const toStores = store.raise || (store.seeAll && !store.handle) ? [{ key: "stores", label: store.raise ? "To Stores" : "Store requests", ...(store.raise ? { count: "storeRequestAnswers" } : {}) }] : [];
  return req.decide || req.seeAll ? [...accounts, ...fromMva, ...fromSales, ...toStores] : [...fromMva, ...fromSales, ...accounts, ...toStores];
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
// /stores?tab=items open that section directly. Neighbouring sections with the same `group` fold
// into a dropdown of their own, one open at a time; `count` names a figure shown beside a
// section (lib/useNavCounts.js).
export const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "overview", hint: "Today at a glance", visible: () => true },
  {
    label: "HR", path: "/hr", icon: UserCog, group: "departments", department: "hr", hint: "Staff, payroll, discipline, members", visible: member("hr"),
    sections: [
      { key: "staff", label: "Staff", group: "Staffing", show: can("employees") },
      { key: "establishment", label: "Staff establishment", group: "Staffing", show: can("jobAdverts") },
      { key: "contracts", label: "Contracts", group: "Staffing", show: can("contracts") },
      { key: "reviews", label: "Salary reviews", group: "Pay", show: can("salaryReviews") },
      { key: "payroll", label: "Payroll", group: "Pay", show: can("payroll") },
      { key: "discipline", label: "Disciplinary", group: "Discipline & exits", show: can("disciplinary") },
      { key: "terminations", label: "Terminations", group: "Discipline & exits", show: can("terminations") },
      { key: "members", label: "Members", group: "Membership", show: can("members") },
      { key: "succession", label: "Succession register", group: "Membership", show: can("members") },
    ],
  },
  {
    label: "Livestock", path: "/livestock", icon: PawPrint, group: "departments", department: "livestock", hint: "Herd, health, milk records", visible: member("livestock"),
    sections: [
      { key: "herd", label: "Herd", group: "Animals", show: can("animals") },
      { key: "lactations", label: "Calvings & lactations", group: "Animals", show: can("lactations") },
      { key: "vaccinations", label: "Vaccinations", group: "Animal health", show: can("vaccinations") },
      { key: "health", label: "Health", group: "Animal health", show: can("healthRecords") },
      { key: "milk", label: "Milk records", group: "Milk", show: can("milkRecords") },
      { key: "transfers", label: "To MVA", group: "Milk", show: can("milkTransfers") },
    ],
  },
  {
    label: "Milk Value Addition", short: "MVA", path: "/mva", icon: FlaskConical, group: "departments", department: "mva", hint: "Milk intake, processing, to Sales", visible: member("mva"),
    sections: [
      { key: "collection", label: "Farmer milk", group: "Farmers", show: can("milkDeliveries") },
      { key: "farmers", label: "Farmer register", group: "Farmers", show: can("milkSuppliers") },
      { key: "prices", label: "Milk price", group: "Farmers", show: can("milkPrices") },
      { key: "livestock", label: "From Livestock", count: "milkFromLivestock", show: (a) => a.can("milkTransfers", "receive") || a.user?.department === "mva" },
      { key: "allocation", label: "Allocation", group: "Production & Processing", show: can("milkAllocations") },
      { key: "processing", label: "Product output", group: "Production & Processing", show: can("processingBatches") },
      { key: "transfers", label: "To Sales", show: can("productTransfers") },
      { key: "stock", label: "Stock", show: can("mvaStock") },
    ],
  },
  {
    label: "Sales", path: "/sales", icon: ShoppingCart, group: "departments", department: "sales", hint: "Local sales, vehicles, stock", visible: member("sales"),
    sections: [
      { key: "received", label: "From MVA", show: can("productTransfers", "receive") },
      { key: "vehicles-out", label: "Vehicle sales", group: "Sales & returns", show: can("dispatches") },
      { key: "sales", label: "Local sales", group: "Sales & returns", show: can("sales") },
      { key: "damages", label: "Damages & returns", group: "Sales & returns", show: can("damages") },
      { key: "stock", label: "Stock", show: can("salesStock") },
      { key: "vehicles", label: "Vehicles", group: "Vehicles & prices", show: can("vehicles") },
      { key: "products", label: "Prices", group: "Vehicles & prices", show: can("products") },
    ],
  },
  {
    label: "Stores", path: "/stores", icon: Warehouse, group: "departments", department: "stores", hint: "Stock, requests, goods received, stock out", visible: member("stores"),
    sections: [
      { key: "stock", label: "Stock", show: can("storeItems") },
      { key: "requests", label: "Requests", show: (a) => Boolean(a.permissions?.storeRequests?.seeAll) },
      { key: "receipts", label: "Goods received", group: "Goods in & out", show: can("storeReceipts") },
      { key: "issues", label: "Stock out", group: "Goods in & out", show: can("storeIssues") },
      { key: "items", label: "Items", show: can("storeItems") },
    ],
  },
  {
    // Its reports (a summary, then one per crop) are under Reports, like every department's.
    label: "Crops", path: "/crops", icon: Sprout, group: "departments", department: "crops", hint: "Sugarcane, tea, coffee, fodder", visible: member("crops"),
    sections: [
      { key: "farms", label: "Farms", show: can("cropFarms") },
      { key: "harvests", label: "Harvests", show: can("cropHarvests") },
    ],
  },
  {
    label: "Accounts", path: "/accounts", icon: Wallet, group: "departments", department: "accounts", hint: "Income, expenses, payments", visible: member("accounts"),
    sections: [
      { key: "entries", label: "Income & expenses", group: "Books", show: can("transactions") },
      { key: "accounts", label: "Accounts", group: "Books", show: can("accounts") },
      { key: "milk", label: "Farmer payments", group: "Farmers", show: can("milkPayments") },
      { key: "farmers", label: "Farmer details", group: "Farmers", show: can("farmerDetails") },
      { key: "salaries", label: "Salaries", group: "Staff & members", show: can("payroll", "pay") },
      { key: "members", label: "Member payments", group: "Staff & members", show: can("memberPayments") },
      { key: "orders", label: "Purchase orders", group: "Purchasing", show: can("purchaseOrders") },
      { key: "suppliers", label: "Suppliers", group: "Purchasing", show: can("suppliers") },
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
