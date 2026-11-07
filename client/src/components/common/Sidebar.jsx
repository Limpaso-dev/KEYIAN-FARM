import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { NAV_GROUPS, navigation } from "../../navigation";
import { cx } from "../../lib/cx";

const Brand = ({ collapsed }) => (
  <div className={cx("flex items-center gap-3", collapsed && "lg:justify-center")}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm ring-1 ring-white/20">
      <img src="/keiyian%20llogo.png" alt="" className="h-full w-full object-contain" />
    </span>
    <p className={cx("min-w-0 text-[13px] font-semibold leading-snug tracking-tight text-white", collapsed && "lg:hidden")}>
      Keiyian Farmers<br />
      <span className="font-medium text-sidebar-text">Cooperative Society Ltd</span>
    </p>
  </div>
);

/**
 * Dark navigation rail. On large screens it collapses to icons (state kept by
 * the layout); on small screens it slides in as a drawer.
 */
const Sidebar = ({ mobileOpen = false, onClose = () => {}, collapsed = false, onToggleCollapsed = () => {} }) => {
  const auth = useAuth();
  const items = navigation.filter((item) => item.visible(auth));
  const groups = NAV_GROUPS.map((group) => ({ ...group, items: items.filter((i) => i.group === group.key) })).filter((g) => g.items.length);

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Close navigation" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px] animate-fade-in lg:hidden" />}
      <aside
        aria-label="Sidebar"
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar transition-[transform,width] duration-200 ease-out lg:z-30 lg:translate-x-0",
          collapsed ? "lg:w-[76px]" : "lg:w-64",
          mobileOpen ? "translate-x-0 shadow-overlay" : "-translate-x-full",
        )}
      >
        <div className={cx("flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4", collapsed && "lg:justify-center lg:px-0")}>
          <Brand collapsed={collapsed} />
          <button type="button" aria-label="Close navigation" onClick={onClose} className="rounded-md p-2 text-sidebar-text hover:bg-sidebar-raised hover:text-white lg:hidden"><X size={18} /></button>
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Main">
          {groups.map((group, index) => (
            <div key={group.key} className={cx(index > 0 && "mt-5")}>
              <p className={cx("mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted", collapsed && "lg:sr-only")}>{group.label}</p>
              {collapsed && index > 0 && <div className="mx-3 mb-2 hidden border-t border-sidebar-border lg:block" aria-hidden />}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) => cx(
                        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        collapsed && "lg:justify-center lg:px-0",
                        isActive ? "bg-white/[0.08] text-white" : "text-sidebar-text hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary-400" aria-hidden />}
                          <item.icon size={18} className={cx("shrink-0", isActive ? "text-primary-300" : "text-sidebar-muted group-hover:text-sidebar-text")} aria-hidden />
                          <span className={cx("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-sidebar-border p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cx("flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-muted transition hover:bg-white/[0.05] hover:text-white", collapsed && "justify-center px-0")}
          >
            {collapsed ? <ChevronsRight size={17} /> : <><ChevronsLeft size={17} /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
