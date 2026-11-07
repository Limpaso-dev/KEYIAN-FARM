import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Spinner } from "../components/ui/ui";

/** Requires a signed-in user; sends temporary-password users to change it. */
const ProtectedRoute = () => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading || (auth.isAuthenticated && !auth.user.mustChangePassword && !auth.meta)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner /></div>;
  }
  if (!auth.isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (auth.user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
