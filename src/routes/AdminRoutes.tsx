import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import AdminDashboard from "../pages/admin/Dashboard/Dashboard";
import UserManagement from "../pages/admin/UserManagement/UserManagement";
import RoleManagement from "../pages/admin/RoleManagement/RoleManagement";
import AdminTopicManagement from "../pages/admin/TopicManagement/TopicManagement";
import DebateManagement from "../pages/admin/DebateManagement/DebateManagement";
import ReportManagement from "../pages/admin/ReportManagement/ReportManagement";
import AdminEventManagement from "../pages/admin/EventManagement/EventManagement";
import AdminCompetitionManagement from "../pages/admin/CompetitionManagement/CompetitionManagement";
import PaymentManagement from "../pages/admin/PaymentManagement/PaymentManagement";
import SystemManagement from "../pages/admin/SystemManagement/SystemManagement";
import KnowledgeBaseManagement from "../pages/shared/KnowledgeBase/KnowledgeBaseManagement";
import DebaterProfile from "../pages/debater/Profile/Profile";
import DebaterSettings from "../pages/debater/Settings/Settings";

const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="roles" element={<RoleManagement />} />
      <Route path="topics" element={<AdminTopicManagement />} />
      <Route path="knowledge-base" element={<KnowledgeBaseManagement />} />
      <Route path="payments" element={<PaymentManagement />} />
      <Route path="profile" element={<DebaterProfile />} />
      <Route path="settings" element={<DebaterSettings />} />
      <Route path="debates" element={<DebateManagement />} />
      <Route path="reports" element={<ReportManagement />} />
      <Route path="events" element={<AdminEventManagement />} />
      <Route path="competitions" element={<AdminCompetitionManagement />} />
      <Route path="system" element={<SystemManagement />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default AdminRoutes;
