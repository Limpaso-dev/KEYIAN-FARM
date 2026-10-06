import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  Milk,
  Package,
  ShoppingCart,
  Tractor,
  Users,
  UserCog,
  Wallet,
  Wheat,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import { getFarmers } from "../../services/farmer.service";
import { getMilkCollections } from "../../services/milkCollection.service";
import { canAccessModule } from "../../utils/permissions";
import "./Dashboard.css";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(value);

const getDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const sumLitres = (collections) =>
  collections.reduce((total, collection) => total + Number(collection.quantityLitres || 0), 0);

const Dashboard = () => {
  const { user } = useAuth();
  const canReadFarmers = canAccessModule(user?.role, "farmers");
  const canReadMilkCollections = canAccessModule(user?.role, "milkCollection");
  const [farmerCount, setFarmerCount] = useState(null);
  const [milkCollections, setMilkCollections] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;

    const loadDashboardData = async () => {
      const [farmersResult, collectionsResult] = await Promise.allSettled([
        canReadFarmers ? getFarmers() : Promise.resolve(null),
        canReadMilkCollections ? getMilkCollections() : Promise.resolve(null),
      ]);

      if (!current) return;

      if (farmersResult.status === "fulfilled" && farmersResult.value) {
        const response = farmersResult.value;
        const count = Number.isFinite(response.count)
          ? response.count
          : Array.isArray(response.data)
            ? response.data.length
            : null;
        setFarmerCount(count);
      }

      if (collectionsResult.status === "fulfilled" && collectionsResult.value) {
        const records = collectionsResult.value.milkCollections;
        setMilkCollections(Array.isArray(records) ? records : null);
      }

      setLoading(false);
    };

    loadDashboardData().catch((error) => {
      console.error("Failed to load dashboard data:", error);
      if (current) setLoading(false);
    });

    return () => {
      current = false;
    };
  }, [canReadFarmers, canReadMilkCollections]);

  const today = new Date();
  const greeting = today.getHours() < 12
    ? "Good morning"
    : today.getHours() < 18
      ? "Good afternoon"
      : "Good evening";
  const todayKey = getDateKey(today);
  const currentMonthKey = todayKey.slice(0, 7);

  const collectionsToday = (milkCollections || []).filter((collection) =>
    collection.collectionDate && getDateKey(new Date(collection.collectionDate)) === todayKey
  );

  const collectionsThisMonth = (milkCollections || []).filter((collection) =>
    collection.collectionDate && getDateKey(new Date(collection.collectionDate)).startsWith(currentMonthKey)
  );

  const weeklyCollections = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dateKey = getDateKey(date);
      const records = (milkCollections || []).filter((collection) =>
        collection.collectionDate && getDateKey(new Date(collection.collectionDate)) === dateKey
      );

      return {
        dateKey,
        label: date.toLocaleDateString("en", { weekday: "short" }),
        litres: sumLitres(records),
      };
    });

  const recentCollections = [...(milkCollections || [])]
    .sort((first, second) => new Date(second.collectionDate) - new Date(first.collectionDate))
    .slice(0, 5);
  const maxDailyMilk = Math.max(0, ...weeklyCollections.map((day) => day.litres));

  const stats = [
    ...(canReadFarmers ? [{
      label: "Registered farmers",
      value: loading ? "..." : farmerCount === null ? "Unavailable" : formatNumber(farmerCount),
      icon: Users,
      tone: "green",
      note: "total registered members",
    }] : []),
    ...(canReadMilkCollections ? [{
      label: "Milk collected today",
      value: loading ? "..." : milkCollections === null ? "Unavailable" : `${formatNumber(sumLitres(collectionsToday))} L`,
      icon: Milk,
      tone: "gold",
      note: "from recorded collections",
    }, {
      label: "Milk collected this month",
      value: loading ? "..." : milkCollections === null ? "Unavailable" : `${formatNumber(sumLitres(collectionsThisMonth))} L`,
      icon: Milk,
      tone: "green",
      note: "current calendar month",
    }] : []),
  ];

  const workflows = [
    { number: "01", name: "Milk to farmer payment", detail: "Collection → quality check → payout", icon: Milk, path: "/dairy", tag: "DAIRY", accent: "green" },
    { number: "02", name: "Procurement to inventory", detail: "Request → approval → goods received", icon: ShoppingCart, path: "/procurement", tag: "SUPPLY CHAIN", accent: "gold" },
    { number: "03", name: "Patient care to billing", detail: "Registration → consultation → invoice", icon: HeartPulse, path: "/hmis", tag: "MEDICAL CENTRE", accent: "coral" },
    { number: "04", name: "Employee to payroll", detail: "People → payroll → finance", icon: Wallet, path: "/hr", tag: "PEOPLE & FINANCE", accent: "blue" },
  ];

  const departments = [
    { label: "Farmers", icon: Users, path: "/farmers" },
    { label: "Livestock", icon: Tractor, path: "/livestock" },
    { label: "Dairy", icon: Milk, path: "/dairy" },
    { label: "Agriculture", icon: Wheat, path: "/agriculture" },
    { label: "Medical centre", icon: HeartPulse, path: "/hmis" },
    { label: "Procurement", icon: ShoppingCart, path: "/procurement" },
    { label: "Inventory", icon: Package, path: "/inventory" },
    { label: "Finance", icon: Wallet, path: "/finance" },
    { label: "HR & payroll", icon: UserCog, path: "/hr" },
    { label: "Sales", icon: BarChart3, path: "/sales" },
    { label: "Rentals", icon: Building2, path: "/rentals" },
  ];

  return (
    <div className="keiyian-dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="dashboard-greeting">{greeting}, {user?.name || "there"}</p>
          <h1>Cooperative overview</h1>
        </div>
        <div className="heading-tools">
          <span className="dashboard-period"><CalendarDays size={16} /> {today.toLocaleDateString("en", { month: "long", year: "numeric" })}</span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Cooperative key figures">
        {stats.map(({ label, value, icon: Icon, tone, note }) => (
          <article className="metric-item" key={label}>
            <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
            <p className="metric-label">{label}</p>
            <div className="metric-value-row"><strong>{value}</strong></div>
            <p className="metric-note">{note}</p>
          </article>
        ))}
      </section>

      {canReadMilkCollections && <div className="dashboard-content-grid">
        <section className="production-panel">
          <div className="section-heading">
            <div><p className="eyebrow">RECORDED DAIRY OPERATIONS</p><h2>Milk collection</h2></div>
            <Link to="/reports" className="text-link">View reports <ArrowRight size={15} /></Link>
          </div>
          <div className="production-summary">
            <div><span className="summary-mark"><Milk size={17} /></span><span className="summary-label">COLLECTED TODAY</span></div>
            <div className="production-total"><strong>{loading ? "..." : milkCollections === null ? "Unavailable" : formatNumber(sumLitres(collectionsToday))}</strong><span>litres</span></div>
          </div>
          {milkCollections === null ? (
            <p className="chart-unavailable">{loading ? "Loading collection totals..." : "Collection totals are unavailable."}</p>
          ) : (
            <div className="chart-area" role="img" aria-label={`Milk collected over the last seven days: ${weeklyCollections.map((day) => `${day.label} ${formatNumber(day.litres)} litres`).join(", ")}`}>
              <div className="bar-chart">
                {weeklyCollections.map((day, index) => (
                  <div className="bar-column" key={day.dateKey} title={`${formatNumber(day.litres)} L`}><div className={`bar ${index === weeklyCollections.length - 1 ? "bar-current" : ""}`} style={{ height: `${maxDailyMilk ? day.litres / maxDailyMilk * 100 : 0}%` }} /><span>{day.label}</span></div>
                ))}
              </div>
            </div>
          )}
          <div className="production-footer"><span><span className="legend-dot" /> Last seven days</span><span>Recorded total <strong>{milkCollections === null ? "Unavailable" : `${formatNumber(weeklyCollections.reduce((total, day) => total + day.litres, 0))} L`}</strong></span></div>
        </section>

        <section className="activity-panel">
          <div className="section-heading">
            <div><p className="eyebrow">LIVE RECORDS</p><h2>Recent milk collections</h2></div>
          </div>
          <div className="activity-list">
            {loading ? <p className="activity-empty">Loading recorded collections...</p> : milkCollections === null ? <p className="activity-empty">Collection records are unavailable.</p> : recentCollections.length === 0 ? <p className="activity-empty">No milk collections recorded yet.</p> : recentCollections.map((collection) => (
              <div className="activity-row" key={collection._id}>
                <span className="activity-icon green"><Milk size={15} /></span>
                <div className="activity-copy"><strong>{collection.farmer ? `${collection.farmer.firstName || ""} ${collection.farmer.lastName || ""}`.trim() : "Farmer record"}</strong><span>{collection.collectionCentre} · {new Date(collection.collectionDate).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</span></div>
                <time>{formatNumber(Number(collection.quantityLitres || 0))} L</time>
              </div>
            ))}
          </div>
          <Link to="/dairy" className="activity-link">View dairy records <ChevronRight size={16} /></Link>
        </section>
      </div>}

      <section className="workflow-section">
        <div className="section-heading">
          <div><p className="eyebrow">FROM RECORDING TO RESULT</p><h2>See how the work connects</h2></div>
          <span className="section-caption">Choose a workflow to explore</span>
        </div>
        <div className="workflow-grid">
          {workflows.map(({ number, name, detail, icon: Icon, path, tag, accent }) => (
            <Link to={path} className={`workflow-link ${accent}`} key={number}>
              <div className="workflow-top"><span className="workflow-number">{number}</span><Icon size={19} /><span className="workflow-tag">{tag}</span></div>
              <strong>{name}</strong>
              <span className="workflow-detail">{detail}</span>
              <span className="workflow-go">Explore workflow <ArrowUpRight size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="department-section">
        <div className="section-heading"><div><p className="eyebrow">ONE SHARED PLATFORM</p><h2>Across every department</h2></div><span className="section-caption">Connected data. Clear decisions.</span></div>
        <div className="department-list">
          {departments.map(({ label, icon: Icon, path }) => <Link to={path} className="department-link" key={label}><Icon size={17} /><span>{label}</span><ArrowDownRight size={14} /></Link>)}
        </div>
      </section>

    </div>
  );
};

export default Dashboard;