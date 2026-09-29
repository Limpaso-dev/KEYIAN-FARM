import { Outlet } from "react-router-dom";

import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/common/Topbar";
import PageNavigation from "../components/common/PageNavigation";

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Sidebar />

      <Topbar />

      <main className="ml-64 flex flex-1 flex-col pt-20">
        <div className="flex-1 p-6">
          <PageNavigation />
          <Outlet />
        </div>
        <footer className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Keiyian Farmers Cooperative Society</p>
            <p>
              Developed &amp; Managed by{" "}
              <a
                href="https://payiani-technologies.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-amber-600 transition-colors hover:text-amber-700 hover:underline"
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