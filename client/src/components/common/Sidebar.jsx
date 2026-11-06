import { NavLink } from "react-router-dom";
import { KeyRound, LogOut, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { navigation } from "../../navigation";

const Sidebar = ({ mobileOpen = false, onClose = () => {} }) => {
  const auth = useAuth();
  const items = navigation.filter((item) => item.visible(auth));

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" />}
      <aside className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#dfe6dc] bg-[#edf2ea] transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center border-b border-[#dfe6dc] bg-[#f8faf6] px-6">
          <img src="/keiyian%20llogo.png" alt="Keiyian Farmers Cooperative Society" className="h-12 w-full object-contain object-left" />
          <button type="button" aria-label="Close navigation" onClick={onClose} className="ml-2 rounded p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4" aria-label="Main">
          <div className="space-y-1">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-[#dce8d8] text-[#234b37]" : "text-slate-700 hover:bg-white/75 hover:text-[#234b37]"}`}
              >
                <item.icon size={19} />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-[#d6dfd3] p-4">
          <NavLink to="/change-password" onClick={onClose} className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-white/75 hover:text-[#234b37]">
            <KeyRound size={19} /> Change password
          </NavLink>
          <button type="button" onClick={() => { onClose(); auth.logout(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-700 hover:bg-rose-50 hover:text-rose-800">
            <LogOut size={19} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
