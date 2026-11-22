import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DeviceCheck from "../../../components/debate/DeviceCheck";
import { hasPassedDeviceCheck, markDeviceCheckPassed } from "../../../services/mediaDevices";
import DebateRoom from "./DebateRoom";

/**
 * /debater/debate/:sessionId: the microphone / camera check first, then the room. The room (timers, sockets, AI turns)
 * only mounts once the learner joins. Passing the check is remembered for the session in this tab, so a reload of a
 * room already entered goes straight back in.
 */
const DebateRoomEntry: React.FC = () => {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  // Kept in state too: with sessionStorage blocked the stored flag never sticks, and the learner must still get in
  const [joinedSession, setJoinedSession] = useState<string | null>(null);

  if (!sessionId || joinedSession === sessionId || hasPassedDeviceCheck(sessionId)) return <DebateRoom />;

  return (
    <DeviceCheck
      onJoin={() => {
        markDeviceCheckPassed(sessionId);
        setJoinedSession(sessionId);
      }}
      onCancel={() => navigate(-1)}
    />
  );
};

export default DebateRoomEntry;
