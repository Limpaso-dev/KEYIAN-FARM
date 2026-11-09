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
    label: "Stores", path: "/stores", icon: Warehouse, group: "departments", department: "stores", hint: "Items, receipts, issues", visible: member("stores"),
    sections: [
      { key: "items", label: "Items", show: can("storeItems") },
      { key: "issues", label: "Issues", show: can("storeIssues") },
      { key: "receipts", label: "Goods received", show: can("storeReceipts") },
      { key: "orders", label: "Purchase orders", show: can("purchaseOrders", "receive") },
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
  { label: "Requisitions", path: "/requisitions", icon: ClipboardList, group: "workflow", hint: "Request and approve", visible: (a) => Boolean(a.permissions?.requisitions?.raise || a.permissions?.requisitions?.seeAll || a.permissions?.requisitions?.fulfil) },
  { label: "Reports", path: "/reports", icon: FileBarChart2, group: "workflow", hint: "Daily to annual reports, PDF / CSV", visible: (a) => Boolean(a.permissions?.reports?.length) },
  { label: "User accounts", path: "/users", icon: Users, group: "admin", hint: "Create and manage logins", visible: (a) => Boolean(a.permissions?.manageUsers) },
];

export const findNavItem = (pathname) =>
  navigation.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

export const navForDepartment = (department) => navigation.find((item) => item.department === department);

/** The sections of a department this user can open, in sidebar order. */
export const sectionsFor = (item, auth) => (item?.sections || []).filter((section) => section.show(auth));

/** The section on screen: the one named in ?tab= when this user can open it, otherwise their first. */
export const currentSection = (item, auth, search = "") => {
  const sections = sectionsFor(item, auth);
  const key = new URLSearchParams(search).get("tab");
  return sections.find((section) => section.key === key) || sections[0] || null;
};

/** The address that opens a section. */
export const sectionPath = (item, section) => `${item.path}?tab=${section.key}`;
