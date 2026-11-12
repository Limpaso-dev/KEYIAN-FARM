import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCheck, ChevronDown, ChevronRight, ClipboardList, KeyRound, LogOut, Menu, Search } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { get } from "../../lib/api";
import { dateTime, money } from "../../lib/format";
import { currentSection, findNavItem, NAV_GROUPS } from "../../navigation";
import { cx } from "../../lib/cx";
import { Kbd } from "../ui/ui";

const productLines = (items) => (items || []).map((i) => `${i.product?.name} ${Number(i.quantity)}`).join(", ");

/** Requisitions and product requests needing this user's attention. */
const useNotifications = (user, permissions) => {
  const [items, setItems] = useState([]);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    if (!user || user.mustChangePassword) return;
    try {
      const [inbox, mine] = await Promise.all([
        permissions?.requisitions?.decide ? get("/requisitions/inbox") : [],
        user.department ? get("/requisitions", { status: "returned" }) : [],
      ]);
      const toFulfil = permissions?.requisitions?.fulfil ? await get("/requisitions", { status: "approved" }) : [];
      // Product requests: those waiting for this user's department, and products MVA has sent to Sales on request.
      const handles = permissions?.productRequests?.handles || [];
      const [toHandle, sent] = await Promise.all([
        Promise.all(handles.map((to) => get("/product-requests", { to, status: "pending" }))).then((lists) => lists.flat()),
        permissions?.productRequests?.raiseTo?.includes("mva") ? get("/product-requests", { to: "mva", status: "sent" }) : [],
      ]);
      const toAccounts = "/requisitions?tab=accounts";
      setItems([
        ...inbox.map((r) => ({ id: `d-${r.id}`, title: "Requisition waiting for your approval", detail: `${r.requisitionNumber} · ${r.title}`, amount: r.totalAmount, at: r.createdAt, to: toAccounts })),
        ...mine.filter((r) => r.requestedById === user.id).map((r) => ({ id: `r-${r.id}`, title: "Your requisition was returned", detail: `${r.requisitionNumber} · ${r.decisionComment || r.title}`, at: r.decidedAt, to: toAccounts })),
        ...toFulfil.map((r) => ({ id: `f-${r.id}`, title: "Approved requisition to fulfil", detail: `${r.requisitionNumber} · ${r.title} (${r.department})`, amount: r.totalAmount, at: r.decidedAt, to: toAccounts })),
        ...toHandle.map((r) => ({ id: `p-${r.id}`, title: r.toDepartment === "mva" ? "Sales asked for products" : "Office request from the administration", detail: `${r.requestNumber} · ${productLines(r.items)}`, at: r.createdAt, to: `/requisitions?tab=${r.toDepartment}` })),
        ...sent.map((r) => ({ id: `s-${r.id}`, title: "MVA sent the products you asked for", detail: `${r.requestNumber} · receive them under From MVA`, at: r.handledAt, to: "/sales?tab=received" })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [user, permissions]);
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);
  return { items, failed, refresh };
};

/** Closes a popover on outside click or Escape. */
const useDismiss = (open, setOpen) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const esc = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open, setOpen]);
  return ref;
};

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "U";

/**
 * Back to the previous page of this sign-in session. History from before the
 * session started (another account, the login screen) is never stepped into;
 * then it goes to the dashboard instead.
 */
const BackButton = ({ sessionStart = 0 }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (pathname === "/dashboard") return null;
  const index = window.history.state?.idx ?? 0;
  const goBack = () => (index > sessionStart ? navigate(-1) : navigate("/dashboard"));
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back to the previous page"
      title="Back (Alt + Left arrow)"
      className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white pl-2 pr-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:pr-3"
    >
      <ArrowLeft size={16} aria-hidden />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
};

/** Departments › Milk Value Addition › Processing */
const Breadcrumbs = () => {
  const auth = useAuth();
  const { pathname, search } = useLocation();
  const item = findNavItem(pathname);
  const group = NAV_GROUPS.find((g) => g.key === item?.group);
  if (!item) return null;
  const section = currentSection(item, auth, search);
  const chevron = <ChevronRight size={14} className="shrink-0 text-slate-300" aria-hidden />;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      <span className="shrink-0 text-slate-400">{group?.label}</span>
      {chevron}
      {section ? (
        <>
          <span className="truncate text-slate-500">{item.label}</span>
          {chevron}
          <span className="truncate font-medium text-slate-800" aria-current="page">{section.crumb || section.label}</span>
        </>
      ) : (
        <span className="truncate font-medium text-slate-800" aria-current="page">{item.label}</span>
      )}
    </nav>
  );
};

const Notifications = () => {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panel = useDismiss(open, setOpen);
  const { items, failed, refresh } = useNotifications(user, permissions);
  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-label={`Notifications${items.length ? `, ${items.length} pending` : ""}`}
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); refresh(); }}
        className={cx("relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900", open && "bg-slate-100 text-slate-900")}
      >
        <Bell size={19} />
        {items.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{items.length > 99 ? "99+" : items.length}</span>}
      </button>
      {open && (
        <section className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-overlay animate-slide-down" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {items.length > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{items.length} pending</span>}
          </div>
          {items.length ? (
            <ul className="scrollbar-thin max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.slice(0, 15).map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => { setOpen(false); navigate(item.to || "/requisitions"); }} className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><ClipboardList size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{item.detail}</span>
                      <span className="mt-1 flex justify-between text-xs text-slate-400"><span className="font-medium text-slate-600">{item.amount != null ? money(item.amount) : ""}</span><span>{dateTime(item.at)}</span></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCheck size={20} /></span>
              <p className="mt-3 text-sm font-medium text-slate-700">{failed ? "Could not load notifications" : "You're all caught up"}</p>
              <p className="mt-0.5 text-xs text-slate-500">Requisitions and requests that need you will appear here.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const UserMenu = () => {
  const { user, label, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menu = useDismiss(open, setOpen);
  const role = `${label("roles", user?.role)}${user?.department ? ` · ${label("departments", user.department)}` : ""}`;
  return (
    <div ref={menu} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cx("flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100", open && "bg-slate-100")}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-xs font-semibold text-white">{initials(user?.name)}</span>
        <span className="hidden max-w-[11rem] text-left leading-tight lg:block">
          <span className="block truncate text-sm font-semibold text-slate-900">{user?.name}</span>
          <span className="block truncate text-xs text-slate-500">{role}</span>
        </span>
        <ChevronDown size={15} className="hidden text-slate-400 lg:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-overlay animate-slide-down">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <p className="mt-1.5 inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-800">{role}</p>
          </div>
          <div className="p-1.5">
            <Link role="menuitem" to="/change-password" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900">
              <KeyRound size={16} className="text-slate-400" /> Change password
            </Link>
            <button role="menuitem" type="button" onClick={() => { setOpen(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-700 hover:bg-rose-50">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Topbar = ({ onMenuClick = () => {}, onSearch = () => {}, collapsed = false, sessionStart = 0 }) => (
  <header className={cx("fixed right-0 top-0 z-20 h-16 border-b border-slate-200 bg-white/85 backdrop-blur-md transition-[left] duration-200 ease-out left-0", collapsed ? "lg:left-[76px]" : "lg:left-64")}>
    <div className="flex h-full items-center gap-3 px-3 sm:px-6">
      <button type="button" aria-label="Open navigation" onClick={onMenuClick} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
      <BackButton sessionStart={sessionStart} />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={onSearch} aria-label="Go to a page (Ctrl+K)" className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white sm:w-56 lg:w-64">
          <Search size={16} aria-hidden />
          <span className="hidden flex-1 text-left sm:block">Go to...</span>
          <span className="hidden sm:flex"><Kbd>Ctrl K</Kbd></span>
        </button>
        <Notifications />
        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
        <UserMenu />
      </div>
    </div>
  </header>
);

export default Topbar;
