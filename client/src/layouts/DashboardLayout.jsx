import { Outlet } from "react-router-dom";

import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/common/Topbar";

const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <Topbar />

      <main className="ml-64 pt-20">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;