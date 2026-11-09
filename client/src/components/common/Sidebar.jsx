import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { currentSection, findNavItem, NAV_GROUPS, navigation, sectionPath, sectionsFor } from "../../navigation";
import { cx } from "../../lib/cx";

// The sidebar folds to an icon rail on large screens only (Tailwind's lg).
const LARGE = "(min-width: 1024px)";
const watchLarge = (onChange) => {
  const query = window.matchMedia(LARGE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isLarge = () => window.matchMedia(LARGE).matches;

const ROW = "group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors";
const IDLE = "text-sidebar-text hover:bg-white/[0.05] hover:text-white";
const CURRENT = "bg-white/[0.08] text-white";

const Accent = ({ className }) => <span className={cx("absolute w-[3px] bg-primary-400", className)} aria-hidden />;

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

/** One section of a department: in its dropdown, or in the rail's pop-out (menu). */
const SectionLink = ({ to, label, current, menu = false, onNavigate }) => (
  <li>
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cx("relative flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors", current ? "bg-white/[0.08] font-medium text-white" : IDLE)}
    >
      {/* In the dropdown the marker sits on the guide line; in the pop-out, at the edge. */}
      {current && <Accent className={menu ? "inset-y-1.5 left-0 rounded-r-full" : "inset-y-1.5 -left-3 rounded-full"} />}
      <span className="truncate">{label}</span>
    </Link>
  </li>
);

/**
 * A department's sections beside the icon rail. Focus moves into it and the
 * arrow keys move between sections; Escape, a click elsewhere, scrolling the
 * sidebar or tabbing out closes it.
 */
const PopoutMenu = ({ id, item, sections, activeKey, position, trigger, onClose, onNavigate }) => {
  const box = useRef(null);

  useEffect(() => {
    const first = box.current?.querySelector('[aria-current="page"]') || box.current?.querySelector("a");
    first?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onPointer = (event) => {
      if (!box.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose();
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      onClose();
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, trigger]);

  const onKeyDown = (event) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const links = [...box.current.querySelectorAll("a")];
    const at = links.indexOf(document.activeElement);
    const next = at < 0 ? (step > 0 ? 0 : links.length - 1) : (at + step + links.length) % links.length;
    links[next]?.focus();
  };

  return (
    <div
      ref={box}
      id={id}
      onKeyDown={onKeyDown}
      style={{ top: position.top, left: position.left, maxHeight: `calc(100vh - ${position.top + 8}px)` }}
      className="sidebar-scroll fixed z-50 w-56 overflow-y-auto rounded-lg border border-sidebar-border bg-sidebar shadow-overlay animate-fade-in"
    >
      <p className="border-b border-sidebar-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{item.label}</p>
      <ul className="space-y-0.5 p-1.5">
        {sections.map((section) => (
          <SectionLink key={section.key} menu to={sectionPath(item, section)} label={section.label} current={section.key === activeKey} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
};

/**
 * A department with sections. On the full sidebar its name opens and closes
 * a dropdown of its sections; on the icon rail its icon opens a pop-out.
 */
const DepartmentGroup = ({ item, sections, activeKey, here, open, rail, popout, onToggle, onPopout, onClosePopout, onNavigate }) => {
  const trigger = useRef(null);
  const listId = `nav-sections-${item.department}`;
  const expanded = rail ? Boolean(popout) : open;
  // While its sections are out of sight, the department itself shows where you are.
  const marked = here && (rail || !open);

  const onClick = () => {
    if (!rail) {
      onToggle();
    } else if (popout) {
      onClosePopout();
    } else {
      const row = trigger.current.getBoundingClientRect();
      const right = trigger.current.closest("aside")?.getBoundingClientRect().right ?? row.right;
      const height = 46 + sections.length * 34;
      // Beside the icon, kept below the top bar and on screen.
      onPopout({ top: Math.max(72, Math.min(row.top, window.innerHeight - height - 8)), left: right + 6 });
    }
  };

  return (
    <li data-department={item.department} onBlur={(event) => popout && !event.currentTarget.contains(event.relatedTarget) && onClosePopout()}>
      <button
        ref={trigger}
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        title={rail ? item.label : undefined}
        className={cx(ROW, rail && "justify-center px-0", marked ? CURRENT : here ? "text-white hover:bg-white/[0.05]" : IDLE)}
      >
        {marked && <Accent className="inset-y-2 left-0 rounded-r-full" />}
        <item.icon size={18} className={cx("shrink-0", here ? "text-primary-300" : "text-sidebar-muted group-hover:text-sidebar-text")} aria-hidden />
        <span className={cx("min-w-0 flex-1 truncate", rail && "sr-only")}>{item.label}</span>
        {!rail && <ChevronDown size={16} className={cx("shrink-0 text-sidebar-muted transition-transform duration-200", open && "rotate-180")} aria-hidden />}
      </button>
      {!rail && open && (
        <ul id={listId} className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-white/[0.14] pl-2.5 animate-slide-down">
          {sections.map((section) => (
            <SectionLink key={section.key} to={sectionPath(item, section)} label={section.label} current={section.key === activeKey} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
      {rail && popout && (
        <PopoutMenu id={listId} item={item} sections={sections} activeKey={activeKey} position={popout} trigger={trigger} onClose={onClosePopout} onNavigate={onNavigate} />
      )}
    </li>
  );
};

/**
 * Dark navigation rail. On large screens it collapses to icons (state kept by
 * the layout); on small screens it slides in as a drawer. A department with
 * more than one section the user can open lists them in a dropdown under it.
 */
const Sidebar = ({ mobileOpen = false, onClose = () => {}, collapsed = false, onToggleCollapsed = () => {} }) => {
  const auth = useAuth();
  const location = useLocation();
  const large = useSyncExternalStore(watchLarge, isLarge);
  const rail = collapsed && large;
  const nav = useRef(null);
  const items = navigation.filter((item) => item.visible(auth));
  const groups = NAV_GROUPS.map((group) => ({ ...group, items: items.filter((i) => i.group === group.key) })).filter((g) => g.items.length);
  const current = findNavItem(location.pathname);
  const activeKey = currentSection(current, auth, location.search)?.key;

  // One department's sections show at a time: those of the department you are
  // in, unless you have opened or closed one since the page last changed.
  const [choice, setChoice] = useState({ at: null, department: null });
  const openDepartment = choice.at === location.key ? choice.department : current?.department ?? null;
  const toggle = (department) => setChoice({ at: location.key, department: openDepartment === department ? null : department });

  // The rail's pop-out closes when the page changes.
  const [popout, setPopout] = useState(null);
  const closePopout = useCallback(() => setPopout(null), [setPopout]);
  const openPopout = rail && popout?.at === location.key ? popout : null;

  // Bring a dropdown that opens below the fold into view, keeping its department in sight.
  useEffect(() => {
    if (rail || !openDepartment || !nav.current) return;
    const group = nav.current.querySelector(`[data-department="${openDepartment}"]`);
    if (!group) return;
    const box = nav.current.getBoundingClientRect();
    const rect = group.getBoundingClientRect();
    if (rect.bottom > box.bottom) nav.current.scrollTop += Math.min(rect.bottom - box.bottom + 8, rect.top - box.top - 8);
  }, [openDepartment, rail]);

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

        <nav ref={nav} onScroll={openPopout ? closePopout : undefined} className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Main">
          {groups.map((group, index) => (
            <div key={group.key} className={cx(index > 0 && "mt-5")}>
              <p className={cx("mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted", collapsed && "lg:sr-only")}>{group.label}</p>
              {collapsed && index > 0 && <div className="mx-3 mb-2 hidden border-t border-sidebar-border lg:block" aria-hidden />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const sections = sectionsFor(item, auth);
                  if (sections.length > 1) {
                    return (
                      <DepartmentGroup
                        key={item.path}
                        item={item}
                        sections={sections}
                        here={current === item}
                        activeKey={current === item ? activeKey : null}
                        open={openDepartment === item.department}
                        rail={rail}
                        popout={openPopout?.department === item.department ? openPopout : null}
                        onToggle={() => toggle(item.department)}
                        onPopout={(position) => setPopout({ ...position, at: location.key, department: item.department })}
                        onClosePopout={closePopout}
                        onNavigate={onClose}
                      />
                    );
                  }
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) => cx(ROW, collapsed && "lg:justify-center lg:px-0", isActive ? CURRENT : IDLE)}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <Accent className="inset-y-2 left-0 rounded-r-full" />}
                            <item.icon size={18} className={cx("shrink-0", isActive ? "text-primary-300" : "text-sidebar-muted group-hover:text-sidebar-text")} aria-hidden />
                            <span className={cx("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-sidebar-border p-3 lg:block">
          <button
            type="button"
            onClick={() => {
              setPopout(null);
              onToggleCollapsed();
            }}
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
