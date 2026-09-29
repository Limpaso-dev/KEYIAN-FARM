import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const routeLabels = {
  "/dashboard": "Dashboard",
  "/farmers": "Farmers",
  "/livestock": "Livestock",
  "/animal-feeds": "Animal Feeds",
  "/dairy": "Dairy",
  "/agriculture": "Agriculture",
  "/hmis": "HMIS",
  "/hmis/patients": "Patients",
  "/hmis/visits": "Medical Visits",
  "/hmis/laboratory": "Medical Laboratory",
  "/hmis/prescriptions": "Prescriptions",
  "/procurement": "Procurement",
  "/inventory": "Inventory",
  "/finance": "Finance",
  "/hr": "HR",
  "/rentals": "Rentals",
  "/sales": "Sales",
  "/reports": "Reports",
  "/settings/users": "User Management",
};

const getBreadcrumbs = (pathname) => {
  const crumbs = [{ label: "Dashboard", to: "/dashboard" }];

  if (pathname === "/dashboard") return [{ label: "Dashboard" }];

  if (pathname.startsWith("/hmis/")) {
    crumbs.push({ label: "HMIS", to: "/hmis" });
  }

  crumbs.push({ label: routeLabels[pathname] || "Page" });
  return crumbs;
};

const getFallbackPath = (pathname) => {
  if (pathname.startsWith("/hmis/")) return "/hmis";
  return "/dashboard";
};

const PageNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const canGoBack = location.pathname !== "/dashboard";

  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(getFallbackPath(location.pathname), { replace: true });
  };

  if (!canGoBack) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex min-h-9 items-center gap-3">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        title="Go back"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
      >
        <ArrowLeft size={17} />
      </button>

      <ol className="flex min-w-0 items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => {
          const isCurrent = index === breadcrumbs.length - 1;

          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />}
              {isCurrent ? (
                <span aria-current="page" className="truncate font-medium text-slate-700">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="truncate text-slate-500 transition hover:text-primary-700">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default PageNavigation;