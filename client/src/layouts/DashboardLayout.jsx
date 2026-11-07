import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldX } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { findNavItem } from "../navigation";
import CommandPalette from "../components/common/CommandPalette";
import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/common/Topbar";
import { cx } from "../lib/cx";

const COLLAPSE_KEY = "keiyian.sidebarCollapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const AccessDenied = ({ item }) => (
  <div className="flex min-h-[55vh] items-center justify-center">
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600"><ShieldX size={22} /></span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Access denied</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">Your account does not have access to {item.label}. Ask the system administrator if you need it.</p>
      <Link to="/dashboard" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"><ArrowLeft size={15} /> Back to dashboard</Link>
    </div>
  </div>
);

const DashboardLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Where this sign-in session began in the browser history, for the back button.
  const [sessionStart] = useState(() => window.history.state?.idx ?? 0);
  const auth = useAuth();
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const denied = item && !item.visible(auth);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        // Private mode: the choice just isn't remembered.
      }
      return !value;
    });
  };

  // Ctrl+K / Cmd+K opens the quick navigator.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-raised">Skip to content</a>
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <Topbar onMenuClick={() => setMobileMenuOpen(true)} onSearch={() => setPaletteOpen(true)} collapsed={collapsed} sessionStart={sessionStart} />
      <div className={cx("flex min-h-screen flex-col pt-16 transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <main id="main" className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {denied ? <AccessDenied item={item} /> : <Outlet />}
        </main>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1680px] flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Keiyian Farmers Cooperative Society Ltd · <span className="italic">Nuru ya Jamii</span></p>
            <p>
              Developed &amp; managed by{" "}
              <a href="https://payiani-technologies.vercel.app/" target="_blank" rel="noreferrer" className="font-semibold text-primary-700 transition-colors hover:text-primary-800 hover:underline">Payiani Technologies</a>
              {" "}· &copy; {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
