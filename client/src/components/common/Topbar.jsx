import { Bell, Search } from "lucide-react";
import { useAuth } from "../../context/useAuth";

const Topbar = () => {
  const { user } = useAuth();

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
          <button className="relative text-slate-500 hover:text-slate-900">
            <Bell size={21} />

            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          </button>

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