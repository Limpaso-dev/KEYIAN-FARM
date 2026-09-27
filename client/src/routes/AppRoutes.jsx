import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../pages/auth/Login";
import Dashboard from "../pages/dashboard/Dashboard";

import DashboardLayout from "../layouts/DashboardLayout";
import ProtectedRoute from "./ProtectedRoute";

import FarmersPage from "../modules/farmers/FarmersPage";
import LivestockPage from "../modules/livestock/LivestockPage";
import DairyPage from "../modules/dairy/DairyPage";
import AgriculturePage from "../modules/agriculture/AgriculturePage";

// HMIS
import HMISPage from "../modules/hmis/HMISPage";
import PatientsPage from "../modules/hmis/PatientsPage";
import MedicalVisitsPage from "../modules/hmis/MedicalVisitsPage";
import MedicalLabPage from "../modules/hmis/MedicalLabPage";
import PrescriptionsPage from "../modules/hmis/PrescriptionsPage";

// Procurement
import ProcurementPage from "../modules/procurement/ProcurementPage";

// Inventory
import InventoryPage from "../modules/inventory/InventoryPage";

// Finance
import FinancePage from "../modules/finance/FinancePage";

// HR
import HRPage from "../modules/hr/HRPage";

// Rentals
import RentalsPage from "../modules/rentals/RentalsPage";

// Sales
import SalesPage from "../modules/sales/SalesPage";

const AppRoutes = () => {
  return (
    <Routes>
      {/* =====================================================
          PUBLIC
      ===================================================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      {/* =====================================================
          PROTECTED ERP
      ===================================================== */}

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>

          {/* =================================================
              DASHBOARD
          ================================================= */}

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          {/* =================================================
              FARMERS
          ================================================= */}

          <Route
            path="/farmers"
            element={<FarmersPage />}
          />

          {/* =================================================
              LIVESTOCK
          ================================================= */}

          <Route
            path="/livestock"
            element={<LivestockPage />}
          />

          {/* =================================================
              DAIRY
          ================================================= */}

          <Route
            path="/dairy"
            element={<DairyPage />}
          />

          {/* =================================================
              AGRICULTURE
          ================================================= */}

          <Route
            path="/agriculture"
            element={<AgriculturePage />}
          />

          {/* =================================================
              HMIS / MEDICAL CENTRE
          ================================================= */}

          <Route
            path="/hmis"
            element={<HMISPage />}
          />

          {/* ---------------- PATIENTS ---------------- */}

          <Route
            path="/hmis/patients"
            element={<PatientsPage />}
          />

          {/* ---------------- MEDICAL VISITS ---------------- */}

          <Route
            path="/hmis/visits"
            element={<MedicalVisitsPage />}
          />

          {/* ---------------- MEDICAL LABORATORY ---------------- */}

          <Route
            path="/hmis/laboratory"
            element={<MedicalLabPage />}
          />

          {/* ---------------- PRESCRIPTIONS ---------------- */}

          <Route
            path="/hmis/prescriptions"
            element={<PrescriptionsPage />}
          />

          {/* =================================================
              PROCUREMENT
          ================================================= */}

          <Route
            path="/procurement"
            element={<ProcurementPage />}
          />

          {/* =================================================
              INVENTORY
          ================================================= */}

          <Route
            path="/inventory"
            element={<InventoryPage />}
          />

          {/* =================================================
              FINANCE
          ================================================= */}

          <Route
            path="/finance"
            element={<FinancePage />}
          />

          {/* =================================================
              HR
          ================================================= */}

          <Route
            path="/hr"
            element={<HRPage />}
          />

          {/* =================================================
              RENTALS
          ================================================= */}

          <Route
            path="/rentals"
            element={<RentalsPage />}
          />

          {/* =================================================
              SALES
          ================================================= */}

          <Route
            path="/sales"
            element={<SalesPage />}
          />

          {/* =================================================
              SETTINGS
          ================================================= */}

          <Route
            path="/settings"
            element={
              <div>Settings</div>
            }
          />

        </Route>
      </Route>

      {/* =====================================================
          DEFAULT ROUTE
      ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
};

export default AppRoutes;