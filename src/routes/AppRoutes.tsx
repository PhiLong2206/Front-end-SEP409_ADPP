import React from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import DashboardLayout from "../components/layout/DashboardLayout";
import AdminLayout from "../components/layout/AdminLayout";
import RoleProtectedRoute from "./RoleProtectedRoute";
import GuestRoute from "./GuestRoute";
import { ROLES } from "../utils/constants";
import { useAuth } from "../hooks/useAuth";

// Public pages
import Home from "../pages/public/Home/Home";
import Login from "../pages/public/Login/Login";
import Register from "../pages/public/Register/Register";
import ForgotPassword from "../pages/public/ForgotPassword/ForgotPassword";
import ResetPassword from "../pages/public/ResetPassword/ResetPassword";
import VerifyOtp from "../pages/public/VerifyOtp/VerifyOtp";
import NotFound from "../pages/public/NotFound/NotFound";
import Unauthorized from "../pages/public/Unauthorized/Unauthorized";

// Child portals
import DebaterRoutes from "./DebaterRoutes";
import OrganizerRoutes from "./OrganizerRoutes";

// Admin pages & Reusable Profile/Settings
import AdminDashboard from "../pages/admin/Dashboard/Dashboard";
import UserManagement from "../pages/admin/UserManagement/UserManagement";
import RoleManagement from "../pages/admin/RoleManagement/RoleManagement";
import AdminTopicManagement from "../pages/admin/TopicManagement/TopicManagement";
import PaymentManagement from "../pages/admin/PaymentManagement/PaymentManagement";
import DebateManagement from "../pages/admin/DebateManagement/DebateManagement";
import ReportManagement from "../pages/admin/ReportManagement/ReportManagement";
import AdminEventManagement from "../pages/admin/EventManagement/EventManagement";
import AdminCompetitionManagement from "../pages/admin/CompetitionManagement/CompetitionManagement";
import SystemManagement from "../pages/admin/SystemManagement/SystemManagement";
import KnowledgeBaseManagement from "../pages/shared/KnowledgeBase/KnowledgeBaseManagement";
import DebaterProfile from "../pages/debater/Profile/Profile";
import DebaterSettings from "../pages/debater/Settings/Settings";

/**
 * Smart redirect for /profile based on authenticated role.
 */
const ProfileRedirect: React.FC = () => {
  const { role } = useAuth();
  if (role === ROLES.ADMIN) return <Navigate to="/admin/profile" replace />;
  if (role === ROLES.ORGANIZER) return <Navigate to="/organizer/profile" replace />;
  return <Navigate to="/debater/profile" replace />;
};

/**
 * PayOS redirect handler: forwards user back to /debater/payments with query params intact.
 */
const PaymentReturnRedirect: React.FC<{ defaultRoute?: "success" | "cancel" }> = ({ defaultRoute }) => {
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams(searchParams);
  if (defaultRoute === "cancel") {
    nextParams.set("cancel", "true");
    nextParams.set("payos_route", "cancel");
  } else if (defaultRoute === "success") {
    nextParams.set("payos_route", "success");
  }
  const query = nextParams.toString();
  return <Navigate to={`/debater/payments${query ? `?${query}` : ""}`} replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Direct /profile shortcut: protected, redirects to portal matching user role */}
      <Route
        path="/profile"
        element={
          <RoleProtectedRoute>
            <ProfileRedirect />
          </RoleProtectedRoute>
        }
      />

      {/* PayOS Return & Cancel redirects */}
      <Route path="/payment/success" element={<PaymentReturnRedirect defaultRoute="success" />} />
      <Route path="/payment/cancel" element={<PaymentReturnRedirect defaultRoute="cancel" />} />

      {/* Public Pages wrapped in PublicLayout */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/403" element={<Unauthorized />} />

        {/* Guest Only Routes (Redirects to role dashboard if already authenticated) */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
        </Route>
      </Route>

      {/* Protected Debater Portal (Debater & Admin can preview) */}
      <Route
        path="/debater/*"
        element={
          <RoleProtectedRoute allowedRoles={[ROLES.DEBATER, ROLES.ADMIN]}>
            <DashboardLayout />
          </RoleProtectedRoute>
        }
      >
        <Route path="*" element={<DebaterRoutes />} />
      </Route>

      {/* Protected Organizer Portal */}
      <Route
        path="/organizer/*"
        element={
          <RoleProtectedRoute allowedRoles={[ROLES.ORGANIZER, ROLES.ADMIN]}>
            <DashboardLayout />
          </RoleProtectedRoute>
        }
      >
        <Route path="*" element={<OrganizerRoutes />} />
      </Route>

      {/* Protected Administrator Portal (Strictly Admin only: Debaters redirected to 403) */}
      <Route
        path="/admin"
        element={
          <RoleProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout />
          </RoleProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="roles" element={<RoleManagement />} />
        <Route path="topics" element={<AdminTopicManagement />} />
        <Route path="knowledge-base" element={<KnowledgeBaseManagement />} />
        <Route path="payments" element={<PaymentManagement />} />

        {/* Reusable Profile & Settings for Admin */}
        <Route path="profile" element={<DebaterProfile />} />
        <Route path="settings" element={<DebaterSettings />} />

        {/* Preserved routes (hidden from sidebar but accessible) */}
        <Route path="debates" element={<DebateManagement />} />
        <Route path="reports" element={<ReportManagement />} />
        <Route path="events" element={<AdminEventManagement />} />
        <Route path="competitions" element={<AdminCompetitionManagement />} />
        <Route path="system" element={<SystemManagement />} />

        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* 404 Not Found Page */}
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

export default AppRoutes;
