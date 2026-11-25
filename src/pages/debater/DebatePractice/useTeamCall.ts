import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { getIceServers, TeamCall, type TeamCallState } from "../../../services/teamCall";
import type { TeamCallEndedEvent, TeamCallSignalEvent, TeamCallSignalResult, TeamCallSignalType } from "../../../services/debateHub";
import type { IceServersResponse } from "../../../types/debate.types";
import { secondsUntilServerTime } from "../../../utils/debatePreparation";

export type TeamCallStatus = "idle" | "connecting" | "connected" | "failed";

interface UseTeamCallParams {
  /** A Backend session, I am a debater, and a teammate who is not the AI shares my side. */
  eligible: boolean;
  isPreparing: boolean;
  sessionEnded: boolean;
  sessionId: number;
  myUserId: number | null;
  teammate: { userId: number; name: string } | null;
  preparationEndsAt: string | null;
  serverOffsetRef: MutableRefObject<number>;
  /** The shared microphone stream (opened if it is not yet). */
  acquireStream: () => Promise<MediaStream>;
  fetchIceServers: (sessionId: number) => Promise<{ success?: boolean; data?: IceServersResponse | null }>;
  sendSignal: (type: TeamCallSignalType, payload: string) => Promise<TeamCallSignalResult>;
}

const MAX_BUFFERED_SIGNALS = 50;

/**
 * The voice call with the teammate during the preparation minute of each round: it connects by itself when the minute
 * starts and hangs up when the server says it ended (TeamCallEnded), when the minute is over on the server clock, when
 * the preparation stops, or when the room closes. A failure never blocks the preparation.
 */
export function useTeamCall(params: UseTeamCallParams) {
  const { eligible, isPreparing, sessionEnded, sessionId, myUserId, teammate, preparationEndsAt } = params;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [status, setStatus] = useState<TeamCallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // The minute (by its end time) whose call was ended: it does not start again before the next minute
  const [endedFor, setEndedFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const callRef = useRef<TeamCall | null>(null);
  // Signals of the teammate that arrive before our own call exists (they were quicker)
  const bufferRef = useRef<TeamCallSignalEvent[]>([]);
  const mutedRef = useRef(false);

  const teammateId = teammate?.userId ?? null;
  const active =
    eligible &&
    isPreparing &&
    !sessionEnded &&
    teammateId !== null &&
    myUserId !== null &&
    preparationEndsAt !== null &&
    endedFor !== preparationEndsAt;
  const activeRef = useRef(false);
  activeRef.current = active;

  // Ask for the ICE servers early (also while the session is still waiting): the call then starts without delay
  useEffect(() => {
    if (!eligible || teammateId === null) return;
    void getIceServers(sessionId, (id) => paramsRef.current.fetchIceServers(id)).catch(() => {});
  }, [eligible, teammateId, sessionId]);

  useEffect(() => {
    if (!active || teammateId === null || myUserId === null || preparationEndsAt === null) return;
    let cancelled = false;
    let call: TeamCall | null = null;
    setStatus("connecting");
    setMuted(false);
    mutedRef.current = false;
    setAudioBlocked(false);

    void (async () => {
      try {
        const [stream, iceServers] = await Promise.all([
          paramsRef.current.acquireStream(),
          getIceServers(sessionId, (id) => paramsRef.current.fetchIceServers(id)),
        ]);
        if (cancelled) return;
        call = new TeamCall({
          sessionId,
          myUserId,
          teammateUserId: teammateId,
          localStream: stream,
          iceServers,
          sendSignal: (type, payload) => paramsRef.current.sendSignal(type, payload),
          onState: (state: TeamCallState) => {
            if (cancelled) return;
            if (state === "ended") {
              // The teammate hung up, or the server closed the call: it is over for this minute, nothing to show
              setStatus("idle");
              setEndedFor(preparationEndsAt);
            } else {
              setStatus(state);
            }
          },
          onRemoteStream: (remote) => {
            if (!cancelled) setRemoteStream(remote);
          },
          onAudioBlocked: (blocked) => {
            if (!cancelled) setAudioBlocked(blocked);
          },
        });
        callRef.current = call;
        call.start();
        const buffered = bufferRef.current;
        bufferRef.current = [];
        for (const event of buffered) call.handleSignal(event);
      } catch (err) {
        console.warn("Team call: could not start", err);
        if (!cancelled) setStatus("failed");
      }
    })();

    // Back-up of TeamCallEnded: the minute is over on the server clock
    const msLeft = Math.max(0, secondsUntilServerTime(preparationEndsAt, paramsRef.current.serverOffsetRef.current)) * 1000;
    const timer = setTimeout(() => setEndedFor(preparationEndsAt), msLeft);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void call?.hangup();
      callRef.current = null;
      bufferRef.current = [];
      setStatus("idle");
      setRemoteStream(null);
      setAudioBlocked(false);
    };
  }, [active, attempt, sessionId, myUserId, teammateId, preparationEndsAt]);

  const handleSignal = useCallback(
    (event: TeamCallSignalEvent) => {
      if (event.sessionId !== sessionId || teammateId === null || Number(event.fromUserId) !== teammateId) return;
      if (callRef.current) {
        callRef.current.handleSignal(event);
      } else if (activeRef.current && bufferRef.current.length < MAX_BUFFERED_SIGNALS && event.type !== "hangup") {
        // Only while this minute's call is about to start: a signal of an earlier minute must not replay into the next
        bufferRef.current.push(event);
      }
    },
    [sessionId, teammateId]
  );

  const handleEnded = useCallback(
    (event: TeamCallEndedEvent) => {
      if (event.sessionId !== sessionId) return;
      bufferRef.current = [];
      void callRef.current?.hangup();
      setEndedFor(paramsRef.current.preparationEndsAt);
    },
    [sessionId]
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    callRef.current?.setMuted(next);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const enableAudio = useCallback(() => callRef.current?.resumeAudio(), []);

  return {
    /** The call exists for this preparation minute (connecting, connected or failed): the room shows its panel. */
    isActive: active,
    /** Voice is flowing or about to: live transcript and speaking status are not sent meanwhile. */
    isBusy: active && (status === "connecting" || status === "connected"),
    status,
    muted,
    audioBlocked,
    remoteStream,
    teammateName: teammate?.name ?? "",
    handleSignal,
    handleEnded,
    toggleMute,
    retry,
    enableAudio,
  };
}
