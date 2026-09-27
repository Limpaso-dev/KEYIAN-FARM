import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Milk,
  Users,
  Wheat,
} from "lucide-react";

const stats = [
  {
    title: "Total Farmers",
    value: "0",
    change: "Registered farmers",
    icon: Users,
  },
  {
    title: "Milk Collected",
    value: "0 L",
    change: "This month",
    icon: Milk,
  },
  {
    title: "Revenue",
    value: "KES 0",
    change: "This month",
    icon: DollarSign,
  },
  {
    title: "Active Employees",
    value: "0",
    change: "Current employees",
    icon: ClipboardList,
  },
];

const Dashboard = () => {
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Overview of Keiyian Cooperative operations.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
          <CalendarDays size={17} />

          <span>Today</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.title}
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {stat.value}
                  </h2>
                </div>

                <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
                  <Icon size={21} />
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                {stat.change}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main dashboard */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Operations */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Cooperative Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Key operational areas will appear here as data is
              connected.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-green-100 p-2 text-green-600">
                  <Milk size={20} />
                </div>

                <ArrowUpRight
                  size={18}
                  className="text-green-500"
                />
              </div>

              <p className="text-sm text-slate-500">
                Dairy Operations
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-900">
                Milk Collection
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                  <Wheat size={20} />
                </div>

                <ArrowUpRight
                  size={18}
                  className="text-amber-500"
                />
              </div>

              <p className="text-sm text-slate-500">
                Agriculture
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-900">
                Tea & Sugarcane
              </p>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            System activity will appear here.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-slate-100 p-4">
              <ClipboardList
                size={24}
                className="text-slate-400"
              />
            </div>

            <p className="mt-4 text-sm font-medium text-slate-600">
              No recent activity
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Activity will appear once users start working
              in the system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;