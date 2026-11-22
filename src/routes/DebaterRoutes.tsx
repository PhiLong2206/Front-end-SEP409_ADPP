import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import DebaterDashboard from "../pages/debater/Dashboard/Dashboard";
import Topics from "../pages/debater/Topics/Topics";
import TopicDetail from "../pages/debater/Topics/TopicDetail";
import DebatePractice from "../pages/debater/DebatePractice/DebatePractice";
import DebateRoomEntry from "../pages/debater/DebatePractice/DebateRoomEntry";
import DebateResult from "../pages/debater/DebatePractice/DebateResult";
import Debate1v1 from "../pages/debater/Debate1v1/Debate1v1";
import Debate1v1Result from "../pages/debater/Debate1v1/Debate1v1Result";
import Debate2v2Lobby from "../pages/debater/Debate2v2/Debate2v2Lobby";
import DebateHistory from "../pages/debater/DebateHistory/DebateHistory";
import Feedback from "../pages/debater/Feedback/Feedback";
import Progress from "../pages/debater/Progress/Progress";
import Events from "../pages/debater/Events/Events";
import Competitions from "../pages/debater/Competitions/Competitions";
import Payments from "../pages/debater/Payments/Payments";
import DebaterProfile from "../pages/debater/Profile/Profile";
import DebaterSettings from "../pages/debater/Settings/Settings";

const DebaterRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="dashboard" element={<DebaterDashboard />} />
      <Route path="topics" element={<Topics />} />
      <Route path="topics/:id" element={<TopicDetail />} />
      <Route path="debate" element={<DebatePractice />} />
      <Route path="debate-practice" element={<DebatePractice />} />
      <Route path="debate/:sessionId" element={<DebateRoomEntry />} />
      <Route path="debate/:sessionId/result" element={<DebateResult />} />
      <Route path="debate-1v1" element={<Debate1v1 />} />
      <Route path="debate-1v1/:matchId/result" element={<Debate1v1Result />} />
      <Route path="debate-2v2" element={<Debate2v2Lobby />} />
      <Route path="debate-2v2/lobby" element={<Debate2v2Lobby />} />
      <Route path="history" element={<DebateHistory />} />
      <Route path="debate-history" element={<DebateHistory />} />
      <Route path="feedback" element={<Feedback />} />
      <Route path="progress" element={<Progress />} />
      <Route path="events" element={<Events />} />
      <Route path="competitions" element={<Competitions />} />
      <Route path="payments" element={<Payments />} />
      <Route path="profile" element={<DebaterProfile />} />
      <Route path="settings" element={<DebaterSettings />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default DebaterRoutes;
