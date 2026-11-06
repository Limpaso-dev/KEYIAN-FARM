import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { findNavItem } from "../navigation";
import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/common/Topbar";

const DashboardLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const auth = useAuth();
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const denied = item && !item.visible(auth);
  return (
    <div className="flex min-h-screen flex-col bg-[#f2f6ef]">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <Topbar onMenuClick={() => setMobileMenuOpen(true)} />
      <main className="ml-0 flex flex-1 flex-col bg-[#f2f6ef] pt-20 lg:ml-64">
        <div className="app-content flex-1 p-4 sm:p-6">
          {denied ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
                <p className="mt-2 text-sm text-slate-600">Your account does not have access to {item.label}. Ask the system administrator if you need it.</p>
              </div>
            </div>
          ) : <Outlet />}
        </div>
        <footer className="border-t border-[#dfe8dc] bg-[#f8faf6] px-6 py-4">
          <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Keiyian Farmers Cooperative Society</p>
            <p>
              Developed &amp; Managed by{" "}
              <a href="https://payiani-technologies.vercel.app/" target="_blank" rel="noreferrer" className="font-bold text-primary-700 transition-colors hover:text-primary-800 hover:underline">Payiani Technologies</a>
            </p>
            <p>Keiyian ERP · &copy; {new Date().getFullYear()}</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default DashboardLayout;
