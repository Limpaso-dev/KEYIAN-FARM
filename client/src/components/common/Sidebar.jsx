import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  X,
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
  FileBarChart2,
  BadgeDollarSign,
  Inbox,
  LogOut,
} from "lucide-react";

import { useAuth } from "../../context/useAuth";
import { canAccessModule } from "../../utils/permissions";
import { getLifecycleTasks, getPurchaseRequests } from "../../services/workflow.service";

const navigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    module: "dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Workflows",
    path: "/workflows",
    module: "workflows",
    icon: Inbox,
  },
  {
    label: "Farmers",
    path: "/farmers",
    module: "farmers",
    icon: Users,
  },
  {
    label: "Livestock",
    path: "/livestock",
    module: "livestock",
    icon: Tractor,
  },
  {
    label: "Animal Feeds",
    path: "/animal-feeds",
    module: "animalFeeds",
    icon: Wheat,
  },
  {
    label: "Dairy",
    path: "/dairy",
    module: "dairy",
    icon: Milk,
  },
  {
    label: "Agriculture",
    path: "/agriculture",
    module: "agriculture",
    icon: Wheat,
  },
  {
    label: "HMIS",
    path: "/hmis",
    module: "hmis",
    icon: Stethoscope,
  },
  {
    label: "HMIS Billing",
    path: "/hmis/billing",
    module: "hmisBilling",
    icon: BadgeDollarSign,
  },
  {
    label: "Procurement",
    path: "/procurement",
    module: "procurement",
    icon: ShoppingCart,
  },
  {
    label: "Inventory",
    path: "/inventory",
    module: "inventory",
    icon: Package,
  },
  {
    label: "Finance",
    path: "/finance",
    module: "finance",
    icon: Wallet,
  },
  {
    label: "HR",
    path: "/hr",
    module: "hr",
    icon: UserCog,
  },
  {
    label: "Rentals",
    path: "/rentals",
    module: "rentals",
    icon: Building2,
  },
  {
    label: "Sales",
    path: "/sales",
    module: "sales",
    icon: BarChart3,
  },
  {
    label: "Reports",
    path: "/reports",
    module: "reports",
    icon: FileBarChart2,
  },
];

const Sidebar = ({ mobileOpen = false, onClose = () => {} }) => {
  const { logout, user } = useAuth();
  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  useEffect(() => {
    if (!user?._id) return undefined;
    let active = true;
    const refreshTaskCount = async () => {
      try {
        const [requestData, taskData] = await Promise.all([getPurchaseRequests(), getLifecycleTasks()]);
        if (active) {
          const requestCount = (requestData.data || []).filter((item) => item.canDecide).length;
          const lifecycleCount = (taskData.data || []).filter((item) => item.canDecide).length;
          setPendingTaskCount(requestCount + lifecycleCount);
        }
      } catch { if (active) setPendingTaskCount(0); }
    };
    refreshTaskCount();
    const timer = window.setInterval(refreshTaskCount, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?._id]);
  const visibleNavigation = navigation.filter(
    (item) => item.module === "dashboard" || item.module === "workflows" || canAccessModule(user?.role, item.module)
  );

  return (
    <>
    {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" />}
    <aside className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#dfe6dc] bg-[#edf2ea] transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-[#dfe6dc] bg-[#f8faf6] px-6">
        <img
          src="/keiyian%20llogo.png"
          alt="Keiyian Farmers Cooperative Society"
          className="h-12 w-full object-contain object-left"
        />
        <button type="button" aria-label="Close navigation" onClick={onClose} className="ml-2 rounded p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><X size={18} /></button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-emerald-950/50">
          Main Menu
        </p>

        <div className="space-y-1">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-[#dce8d8] text-[#234b37]"
                      : "text-slate-700 hover:bg-white/75 hover:text-[#234b37]"
                  }`
                }
              >
                <Icon size={19} />

                <span className="flex-1">{item.label}</span>
                {item.module === "workflows" && pendingTaskCount > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{pendingTaskCount > 99 ? "99+" : pendingTaskCount}</span>}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#d6dfd3] p-4">
        {canAccessModule(user?.role, "settings") && (
          <NavLink
            to="/settings"
            onClick={onClose}
            className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-white/75 hover:text-[#234b37]"
          >
            <Users size={19} />
            User Management
          </NavLink>
        )}

        <button
          onClick={() => { onClose(); logout(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        >
          <LogOut size={19} />
          Logout
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
