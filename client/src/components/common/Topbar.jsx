import { Bell, CheckCheck, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getLifecycleTasks, getPurchaseRequests } from "../../services/workflow.service";

const currency = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number(amount) || 0);

const Topbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState(false);
  const panelRef = useRef(null);

  const refreshNotifications = useCallback(async () => {
    if (!user?._id) return;
    setNotificationsLoading(true);
    setNotificationError(false);
    try {
      const [requestResult, taskResult] = await Promise.all([getPurchaseRequests(), getLifecycleTasks()]);
      const requests = (requestResult.data || [])
        .filter((request) => request.canDecide || (request.status === "returned" && String(request.createdBy?._id) === String(user._id)))
        .map((request) => ({
          id: `purchase_request-${request._id}`,
          title: request.canDecide ? "Purchase request needs your approval" : "Purchase request returned for correction",
          detail: `${request.requestNumber} · ${request.title}`,
          amount: request.totalAmount,
          updatedAt: request.updatedAt,
          returned: request.status === "returned",
        }));
      const tasks = (taskResult.data || [])
        .filter((task) => task.canDecide || (task.status === "returned" && task.requestedById === String(user._id)))
        .map((task) => ({
          id: `${task.workflowType}-${task.id}`,
          title: task.canDecide ? `${task.label || task.workflowType.replaceAll("_", " ")} needs your approval` : `${task.label || task.workflowType.replaceAll("_", " ")} returned for correction`,
          detail: `${task.reference} · ${task.department}`,
          amount: task.amount,
          updatedAt: task.updatedAt,
          returned: task.status === "returned",
        }));
      setNotifications([...requests, ...tasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch {
      setNotifications([]);
      setNotificationError(true);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openWorkflows = () => {
    setOpen(false);
    navigate("/workflows");
  };

  return (
    <header className="fixed left-64 right-0 top-0 z-30 h-20 border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="relative w-96">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary-400 focus:bg-white"
          />
        </div>

        {/* User */}
        <div className="flex items-center gap-5">
          <div ref={panelRef} className="relative">
          <button type="button" aria-label={`Notifications${notifications.length ? `, ${notifications.length} pending` : ""}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); refreshNotifications(); }} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <Bell size={21} />
            {notifications.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{notifications.length > 99 ? "99+" : notifications.length}</span>}
          </button>
          {open && <section className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" aria-label="Pending notifications">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">Notifications</h2><p className="text-xs text-slate-500">{notifications.length} pending item{notifications.length === 1 ? "" : "s"}</p></div><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={17}/></button></div>
            {notifications.length ? <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">{notifications.slice(0, 10).map((item) => <li key={item.id}><button type="button" onClick={openWorkflows} className="w-full px-4 py-3 text-left hover:bg-slate-50"><span className="flex items-start gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.returned ? "bg-orange-500" : "bg-primary-600"}`}/><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{item.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.detail}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400"><span>{item.amount != null ? currency(item.amount) : "Open workflow inbox"}</span><span>{item.updatedAt ? new Date(item.updatedAt).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" }) : ""}</span></span></span></span></button></li>)}</ul> : <div className="px-4 py-8 text-center">{notificationError ? <><Bell size={24} className="mx-auto text-amber-500"/><p className="mt-2 text-sm font-medium text-slate-700">Could not load notifications</p><p className="mt-1 text-xs text-slate-500">Check that the server is running, then reopen this panel.</p></> : notificationsLoading ? <p className="text-sm text-slate-500">Loading notifications…</p> : <><CheckCheck size={24} className="mx-auto text-emerald-500"/><p className="mt-2 text-sm font-medium text-slate-700">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">No pending approvals or returned items.</p></>}</div>}
            <button type="button" onClick={openWorkflows} className="w-full border-t border-slate-100 px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50">Open workflow inbox</button>
          </section>}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="hidden md:block">
              <p className="text-sm font-semibold text-slate-900">
                {user?.name || "User"}
              </p>

              <p className="text-xs capitalize text-slate-500">
                {user?.role?.replace("_", " ") || "Staff"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
