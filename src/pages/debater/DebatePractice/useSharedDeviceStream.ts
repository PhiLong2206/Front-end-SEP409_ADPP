import { useCallback, useEffect, useRef, useState } from "react";
import { hasLiveAudio, mediaErrorMessage, openMediaStream, type OpenedMedia } from "../../../services/mediaDevices";

export type DevicePhase = "connecting" | "ready" | "failed" | "skipped";

/** After this long without an answer from the browser the learner may retry or go on without the microphone. */
export const DEVICE_SOFT_TIMEOUT_MS = 10_000;

export interface SharedDeviceStream {
  phase: DevicePhase;
  /** The microphone has a live track (start of the debate waits for this, or for the learner's "continue without"). */
  devicesReady: boolean;
  stream: MediaStream | null;
  hasVideo: boolean;
  micError: string | null;
  cameraError: string | null;
  softTimedOut: boolean;
  /** A track of the shared stream ended (unplugged, permission revoked) after it was ready. */
  deviceLost: boolean;
  retry: () => void;
  skip: () => void;
  /** The live shared stream; opens the devices again when there is none or its tracks ended. */
  acquire: () => Promise<OpenedMedia & { reopened: boolean }>;
  /** Stops every track of the shared stream (leaving the room, unmount, end of the debate). */
  release: () => void;
}

/**
 * One microphone/camera stream for the whole room: opened once on entry and reused for every round, so a later
 * round does not ask the browser again. Recorders and STT clients are created per recording; the tracks are only
 * stopped by `release`.
 */
export function useSharedDeviceStream(enabled: boolean): SharedDeviceStream {
  const streamRef = useRef<MediaStream | null>(null);
  const hasVideoRef = useRef(false);
  const unmountedRef = useRef(false);
  const attemptRef = useRef(0);
  const [phase, setPhase] = useState<DevicePhase>("connecting");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [softTimedOut, setSoftTimedOut] = useState(false);
  const [deviceLost, setDeviceLost] = useState(false);
  const [nonce, setNonce] = useState(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const adopt = useCallback((opened: OpenedMedia) => {
    stopTracks();
    streamRef.current = opened.stream;
    hasVideoRef.current = opened.hasVideo;
    setStream(opened.stream);
    setHasVideo(opened.hasVideo);
    setCameraError(opened.cameraError ? mediaErrorMessage(opened.cameraError, "camera") : null);
    setDeviceLost(false);
    opened.stream.getTracks().forEach((t) => {
      // Tracks that end later (unplugged, permission revoked) are noticed; the next recording opens them again
      t.addEventListener?.("ended", () => {
        if (streamRef.current !== opened.stream) return;
        if (t.kind === "video") setHasVideo(false); // the preview would freeze on a dead camera
        // A dead microphone makes the stream unusable; a dead camera is only worth a notice
        if (t.kind === "video" || !hasLiveAudio(opened.stream)) setDeviceLost(true);
      });
    });
  }, [stopTracks]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopTracks();
    };
  }, [stopTracks]);

  useEffect(() => {
    if (!enabled) return;
    const attempt = ++attemptRef.current;
    setPhase("connecting");
    setMicError(null);
    setSoftTimedOut(false);
    const timer = window.setTimeout(() => {
      if (attemptRef.current === attempt) setSoftTimedOut(true);
    }, DEVICE_SOFT_TIMEOUT_MS);
    openMediaStream().then(
      (opened) => {
        if (unmountedRef.current || attemptRef.current !== attempt) {
          opened.stream.getTracks().forEach((t) => t.stop());
          return;
        }
        window.clearTimeout(timer);
        if (hasLiveAudio(streamRef.current)) {
          // A recording (acquire) already opened the devices: that stream may be in use, keep it
          opened.stream.getTracks().forEach((t) => t.stop());
          setPhase("ready");
          return;
        }
        adopt(opened);
        if (hasLiveAudio(opened.stream)) setPhase("ready");
        else {
          setMicError("Không tìm thấy micro nào trên máy.");
          setPhase("failed");
        }
      },
      (err) => {
        if (unmountedRef.current || attemptRef.current !== attempt) return;
        window.clearTimeout(timer);
        setMicError(mediaErrorMessage(err, "mic"));
        setPhase("failed");
      }
    );
    return () => {
      window.clearTimeout(timer);
      // A newer attempt (or unmount) makes this one's answer be dropped above
      attemptRef.current += 1;
    };
  }, [enabled, nonce, adopt]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  // While "skipped" there is no shared stream yet: the first recording opens it through acquire()
  const skip = useCallback(() => {
    attemptRef.current += 1; // a late answer of the pending request is dropped (its tracks stopped)
    setPhase((p) => (p === "ready" ? p : "skipped"));
  }, []);

  // Concurrent callers (a double click on record) share one request, so none adopts a stream another is holding
  const pendingAcquireRef = useRef<Promise<OpenedMedia & { reopened: boolean }> | null>(null);
  const acquire = useCallback(async () => {
    const current = streamRef.current;
    if (current && hasLiveAudio(current)) {
      return { stream: current, hasVideo: hasVideoRef.current, reopened: false };
    }
    if (pendingAcquireRef.current) return pendingAcquireRef.current;
    const reopened = current !== null; // had one that died
    const request = (async () => {
      const opened = await openMediaStream();
      if (unmountedRef.current) {
        opened.stream.getTracks().forEach((t) => t.stop());
        throw new Error("room closed");
      }
      adopt(opened);
      setPhase((p) => (p === "skipped" || p === "failed" ? "ready" : p));
      return { ...opened, reopened };
    })();
    pendingAcquireRef.current = request;
    try {
      return await request;
    } finally {
      pendingAcquireRef.current = null;
    }
  }, [adopt]);

  const release = useCallback(() => {
    stopTracks();
    setStream(null);
    setHasVideo(false);
  }, [stopTracks]);

  return {
    phase,
    devicesReady: phase === "ready" || phase === "skipped",
    stream,
    hasVideo,
    micError,
    cameraError,
    softTimedOut,
    deviceLost,
    retry,
    skip,
    acquire,
    release,
  };
}
