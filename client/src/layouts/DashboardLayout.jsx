import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/common/Topbar";
import PageNavigation from "../components/common/PageNavigation";

const DashboardLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f6ef]">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <Topbar onMenuClick={() => setMobileMenuOpen(true)} />

      <main className="ml-0 flex flex-1 flex-col bg-[#f2f6ef] pt-20 lg:ml-64">
        <div className="flex-1 p-4 sm:p-6">
          <PageNavigation />
          <Outlet />
        </div>
        <footer className="border-t border-[#dfe8dc] bg-[#f8faf6] px-6 py-4">
          <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Keiyian Farmers Cooperative Society</p>
            <p>
              Developed &amp; Managed by{" "}
              <a
                href="https://payiani-technologies.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-primary-700 transition-colors hover:text-primary-800 hover:underline"
              >
                Payiani Technologies
              </a>
            </p>
            <p>Keiyian ERP &amp; HMIS · &copy; {new Date().getFullYear()}</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default DashboardLayout;
