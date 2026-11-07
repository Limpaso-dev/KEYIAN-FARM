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

// Sidebar and dashboard links. A department appears when the user can read
// any part of it (permissions come from the server).
export const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, hint: "Today at a glance", visible: () => true },
  { label: "HR", path: "/hr", icon: UserCog, hint: "Staff, payroll, discipline, members", visible: (a) => any(a, ["employees", "members", "payroll"]) },
  { label: "Livestock", path: "/livestock", icon: PawPrint, hint: "Herd, health, milk records", visible: (a) => any(a, ["animals", "milkRecords"]) },
  { label: "Milk Value Addition", path: "/mva", icon: FlaskConical, hint: "Milk intake, processing, to Sales", visible: (a) => any(a, ["milkDeliveries", "processingBatches"]) },
  { label: "Sales", path: "/sales", icon: ShoppingCart, hint: "Local sales, vehicles, stock", visible: (a) => any(a, ["sales", "dispatches"]) },
  { label: "Stores", path: "/stores", icon: Warehouse, hint: "Items, receipts, issues", visible: (a) => any(a, ["storeReceipts"]) || a.can("purchaseOrders", "receive") },
  { label: "Crops", path: "/crops", icon: Sprout, hint: "Sugarcane, tea, coffee", visible: (a) => any(a, ["cropFarms"]) },
  { label: "Accounts", path: "/accounts", icon: Wallet, hint: "Income, expenses, payments", visible: (a) => any(a, ["transactions", "accounts"]) },
  { label: "Requisitions", path: "/requisitions", icon: ClipboardList, hint: "Request and approve", visible: (a) => Boolean(a.permissions?.requisitions?.raise || a.permissions?.requisitions?.seeAll || a.permissions?.requisitions?.fulfil) },
  { label: "Reports", path: "/reports", icon: FileBarChart2, hint: "End of day PDF / CSV", visible: (a) => Boolean(a.permissions?.reports?.length) },
  { label: "User accounts", path: "/users", icon: Users, hint: "Create and manage logins", visible: (a) => Boolean(a.permissions?.manageUsers) },
];

export const findNavItem = (pathname) =>
  navigation.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
