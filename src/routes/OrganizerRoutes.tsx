import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import OrganizerDashboard from "../pages/organizer/Dashboard/Dashboard";
import TopicManagement from "../pages/organizer/TopicManagement/TopicManagement";
import EventManagement from "../pages/organizer/EventManagement/EventManagement";
import CompetitionManagement from "../pages/organizer/CompetitionManagement/CompetitionManagement";
import OrganizerProfile from "../pages/organizer/Profile/Profile";
import KnowledgeBaseManagement from "../pages/shared/KnowledgeBase/KnowledgeBaseManagement";

const OrganizerRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="dashboard" element={<OrganizerDashboard />} />
      <Route path="topics" element={<TopicManagement />} />
      <Route path="knowledge-base" element={<KnowledgeBaseManagement />} />
      <Route path="events" element={<EventManagement />} />
      <Route path="competitions" element={<CompetitionManagement />} />
      <Route path="profile" element={<OrganizerProfile />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default OrganizerRoutes;
