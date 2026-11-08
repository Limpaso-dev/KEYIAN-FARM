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

const any = (auth, resources) => resources.some((resource) => auth.can(resource));

export const NAV_GROUPS = [
  { key: "overview", label: "Overview" },
  { key: "departments", label: "Departments" },
  { key: "workflow", label: "Workflow" },
  { key: "admin", label: "Administration" },
];

// Sidebar and dashboard links. A department appears when the user can read
// any part of it (permissions come from the server).
export const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "overview", hint: "Today at a glance", visible: () => true },
  { label: "HR", path: "/hr", icon: UserCog, group: "departments", department: "hr", hint: "Staff, payroll, discipline, members", visible: (a) => any(a, ["employees", "members", "payroll"]) },
  { label: "Livestock", path: "/livestock", icon: PawPrint, group: "departments", department: "livestock", hint: "Herd, health, milk records", visible: (a) => any(a, ["animals", "milkRecords"]) },
  { label: "Milk Value Addition", short: "MVA", path: "/mva", icon: FlaskConical, group: "departments", department: "mva", hint: "Milk intake, processing, to Sales", visible: (a) => any(a, ["milkDeliveries", "processingBatches"]) },
  { label: "Sales", path: "/sales", icon: ShoppingCart, group: "departments", department: "sales", hint: "Local sales, vehicles, stock", visible: (a) => any(a, ["sales", "dispatches"]) },
  { label: "Stores", path: "/stores", icon: Warehouse, group: "departments", department: "stores", hint: "Items, receipts, issues", visible: (a) => any(a, ["storeReceipts"]) || a.can("purchaseOrders", "receive") },
  { label: "Crops", path: "/crops", icon: Sprout, group: "departments", department: "crops", hint: "Sugarcane, tea, coffee", visible: (a) => any(a, ["cropFarms"]) },
  { label: "Accounts", path: "/accounts", icon: Wallet, group: "departments", department: "accounts", hint: "Income, expenses, payments", visible: (a) => any(a, ["transactions", "accounts"]) },
  { label: "Requisitions", path: "/requisitions", icon: ClipboardList, group: "workflow", hint: "Request and approve", visible: (a) => Boolean(a.permissions?.requisitions?.raise || a.permissions?.requisitions?.seeAll || a.permissions?.requisitions?.fulfil) },
  { label: "Reports", path: "/reports", icon: FileBarChart2, group: "workflow", hint: "Daily to annual reports, PDF / CSV", visible: (a) => Boolean(a.permissions?.reports?.length) },
  { label: "User accounts", path: "/users", icon: Users, group: "admin", hint: "Create and manage logins", visible: (a) => Boolean(a.permissions?.manageUsers) },
];

export const findNavItem = (pathname) =>
  navigation.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

export const navForDepartment = (department) => navigation.find((item) => item.department === department);
