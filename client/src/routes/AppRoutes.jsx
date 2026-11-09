import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Login from "../pages/auth/Login";
import VerifyAccountPage from "../pages/auth/VerifyAccountPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import Dashboard from "../pages/Dashboard";
import ProtectedRoute from "./ProtectedRoute";
import { Spinner } from "../components/ui/ui";

// Department screens load on demand to keep the first load small.
const HRPage = lazy(() => import("../modules/hr/HRPage"));
const StaffProfile = lazy(() => import("../modules/hr/StaffProfile"));
const AdvertPage = lazy(() => import("../modules/hr/AdvertPage"));
const LivestockPage = lazy(() => import("../modules/livestock/LivestockPage"));
const MvaPage = lazy(() => import("../modules/mva/MvaPage"));
const SalesPage = lazy(() => import("../modules/sales/SalesPage"));
const StoresPage = lazy(() => import("../modules/stores/StoresPage"));
const CropsPage = lazy(() => import("../modules/crops/CropsPage"));
const AccountsPage = lazy(() => import("../modules/accounts/AccountsPage"));
const RequisitionsPage = lazy(() => import("../modules/requisitions/RequisitionsPage"));
const ReportsPage = lazy(() => import("../modules/reports/ReportsPage"));
const UsersPage = lazy(() => import("../modules/users/UsersPage"));

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/verify-account" element={<VerifyAccountPage />} />

    <Route element={<ProtectedRoute />}>
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        {[
          ["/hr", HRPage],
          ["/hr/staff/:id", StaffProfile],
          ["/hr/establishment/:id", AdvertPage],
          ["/livestock", LivestockPage],
          ["/mva", MvaPage],
          ["/sales", SalesPage],
          ["/stores", StoresPage],
          ["/crops", CropsPage],
          ["/accounts", AccountsPage],
          ["/requisitions", RequisitionsPage],
          ["/reports", ReportsPage],
          ["/users", UsersPage],
        ].map(([path, Page]) => (
          <Route key={path} path={path} element={<Suspense fallback={<Spinner />}><Page /></Suspense>} />
        ))}
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default AppRoutes;
