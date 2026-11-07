import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, FileBarChart2 } from "lucide-react";
import { Alert, Card, PageHeader, Spinner, StatCard } from "../components/ui/ui";
import { useAuth } from "../context/useAuth";
import { date, money, number } from "../lib/format";
import { useFetch } from "../lib/useFetch";
import { navigation } from "../navigation";

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const Dashboard = () => {
  const auth = useAuth();
  const { user, label, permissions } = auth;
  const { data, loading, error } = useFetch("/dashboard");
  const links = navigation.filter((item) => item.path !== "/dashboard" && item.visible(auth));
  const req = data?.requisitions;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(" ")[0] || ""}`}
        description={`${label("roles", user?.role)}${user?.department ? ` · ${label("departments", user.department)}` : ""} · ${date(new Date())}`}
      />
      <Alert tone="error">{error}</Alert>

      {req && (req.toDecide > 0 || req.toFulfil > 0 || req.department?.returned > 0) && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <ClipboardCheck className="text-primary-700" />
            <div className="flex-1 text-sm text-slate-700">
              {req.toDecide > 0 && <p><strong>{req.toDecide}</strong> requisition(s) waiting for your approval.</p>}
              {req.toFulfil > 0 && permissions?.requisitions?.fulfil && <p><strong>{req.toFulfil}</strong> approved requisition(s) to fulfil.</p>}
              {req.department?.returned > 0 && <p><strong>{req.department.returned}</strong> of your department's requisitions were returned for changes.</p>}
            </div>
            <Link to="/requisitions" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">Open requisitions <ArrowRight size={15} /></Link>
          </div>
        </Card>
      )}

      {loading && !data ? <Spinner /> : data?.cards?.map((card) => (
        <section key={card.department}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{card.title} today</h2>
            <Link to={`/reports?department=${card.department}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"><FileBarChart2 size={14} /> End of day report</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {card.summary.map((s) => <StatCard key={s.label} label={s.label} value={s.type === "money" ? money(s.value) : number(s.value)} />)}
          </div>
        </section>
      ))}

      {links.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Go to</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {links.map((item) => (
              <Link key={item.path} to={item.path} className="group flex items-center gap-3 rounded-lg border border-[#dfe8dc] bg-white p-4 transition hover:border-primary-300 hover:shadow-sm">
                <item.icon className="text-primary-700" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary-700" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
