import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Milk,
  Tractor,
  Wheat,
  Stethoscope,
  ShoppingCart,
  Package,
  Wallet,
  UserCog,
  Building2,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

const navigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Farmers",
    path: "/farmers",
    icon: Users,
  },
  {
    label: "Livestock",
    path: "/livestock",
    icon: Tractor,
  },
  {
    label: "Dairy",
    path: "/dairy",
    icon: Milk,
  },
  {
    label: "Agriculture",
    path: "/agriculture",
    icon: Wheat,
  },
  {
    label: "HMIS",
    path: "/hmis",
    icon: Stethoscope,
  },
  {
    label: "Procurement",
    path: "/procurement",
    icon: ShoppingCart,
  },
  {
    label: "Inventory",
    path: "/inventory",
    icon: Package,
  },
  {
    label: "Finance",
    path: "/finance",
    icon: Wallet,
  },
  {
    label: "HR",
    path: "/hr",
    icon: UserCog,
  },
  {
    label: "Rentals",
    path: "/rentals",
    icon: Building2,
  },
  {
    label: "Sales",
    path: "/sales",
    icon: BarChart3,
  },
];

const Sidebar = () => {
  const { logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-slate-200 px-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            KEIYIAN
          </h1>

          <p className="text-xs font-medium text-primary-600">
            FARMERS COOPERATIVE
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Main Menu
        </p>

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={19} />

                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-200 p-4">
        <NavLink
          to="/settings"
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Settings size={19} />
          Settings
        </NavLink>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut size={19} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;