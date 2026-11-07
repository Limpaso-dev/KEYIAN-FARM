import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Menu, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { get } from "../../lib/api";
import { dateTime, money } from "../../lib/format";

/** Requisitions needing this user's attention. */
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
      setItems([
        ...inbox.map((r) => ({ id: `d-${r.id}`, title: "Requisition waiting for your approval", detail: `${r.requisitionNumber} · ${r.title}`, amount: r.totalAmount, at: r.createdAt })),
        ...mine.filter((r) => r.requestedById === user.id).map((r) => ({ id: `r-${r.id}`, title: "Your requisition was returned", detail: `${r.requisitionNumber} · ${r.decisionComment || r.title}`, at: r.decidedAt })),
        ...toFulfil.map((r) => ({ id: `f-${r.id}`, title: "Approved requisition to fulfil", detail: `${r.requisitionNumber} · ${r.title} (${r.department})`, amount: r.totalAmount, at: r.decidedAt })),
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

const Topbar = ({ onMenuClick = () => {} }) => {
  const { user, permissions, label } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const { items, failed, refresh } = useNotifications(user, permissions);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !panel.current?.contains(event.target) && setOpen(false);
    const esc = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <header className="fixed left-0 right-0 top-0 z-30 h-20 border-b border-[#dfe8dc] bg-[#f8faf6] lg:left-64">
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-6">
        <button type="button" aria-label="Open navigation" onClick={onMenuClick} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
        <p className="hidden text-sm font-medium text-slate-600 sm:block">Keiyian Farmers Cooperative Society</p>

        <div className="ml-auto flex items-center gap-5">
          <div ref={panel} className="relative">
            <button type="button" aria-label={`Notifications${items.length ? `, ${items.length} pending` : ""}`} aria-expanded={open} onClick={() => { setOpen((v) => !v); refresh(); }} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <Bell size={21} />
              {items.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{items.length > 99 ? "99+" : items.length}</span>}
            </button>
            {open && (
              <section className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" aria-label="Notifications">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                  <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
                </div>
                {items.length ? (
                  <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                    {items.slice(0, 15).map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => { setOpen(false); navigate("/requisitions"); }} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                          <span className="block text-sm font-medium text-slate-800">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{item.detail}</span>
                          <span className="mt-1 flex justify-between text-xs text-slate-400"><span>{item.amount != null ? money(item.amount) : ""}</span><span>{dateTime(item.at)}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <CheckCheck size={24} className="mx-auto text-emerald-500" />
                    <p className="mt-2 text-sm font-medium text-slate-700">{failed ? "Could not load notifications" : "You're all caught up"}</p>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">{user?.name?.charAt(0)?.toUpperCase() || "U"}</div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{label("roles", user?.role)}{user?.department ? ` · ${label("departments", user.department)}` : ""}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
