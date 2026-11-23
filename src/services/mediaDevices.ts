import { RAW_VOICE_AUDIO_CONSTRAINTS } from "./realtimeStt";

/**
 * The microphone / camera the learner picked on the device check before the room, remembered in the browser so the
 * room records with the same devices. A missing or unreadable store means "browser default".
 */
export const MIC_DEVICE_STORAGE_KEY = "adpp.media.micDeviceId";
export const CAMERA_DEVICE_STORAGE_KEY = "adpp.media.cameraDeviceId";
export const CAMERA_ENABLED_STORAGE_KEY = "adpp.media.cameraEnabled";
/** Per session (sessionStorage): the device check was passed, so a reload of the room does not show it again. */
export const DEVICE_CHECK_PASSED_PREFIX = "adpp.deviceCheck.passed.";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice simply is not remembered */
  }
}

export interface StoredMediaChoice {
  micDeviceId: string | null;
  cameraDeviceId: string | null;
  cameraEnabled: boolean;
}

export function readStoredMediaChoice(): StoredMediaChoice {
  return {
    micDeviceId: readLocal(MIC_DEVICE_STORAGE_KEY) || null,
    cameraDeviceId: readLocal(CAMERA_DEVICE_STORAGE_KEY) || null,
    cameraEnabled: readLocal(CAMERA_ENABLED_STORAGE_KEY) !== "0",
  };
}

export function storeMediaChoice(choice: StoredMediaChoice) {
  writeLocal(MIC_DEVICE_STORAGE_KEY, choice.micDeviceId);
  writeLocal(CAMERA_DEVICE_STORAGE_KEY, choice.cameraDeviceId);
  writeLocal(CAMERA_ENABLED_STORAGE_KEY, choice.cameraEnabled ? "1" : "0");
}

/** Raw (unprocessed) voice from the chosen microphone; `ideal` so a device that vanished falls back to the default. */
export function micConstraints(deviceId: string | null): MediaTrackConstraints {
  return deviceId ? { ...RAW_VOICE_AUDIO_CONSTRAINTS, deviceId: { ideal: deviceId } } : RAW_VOICE_AUDIO_CONSTRAINTS;
}

export function cameraConstraints(deviceId: string | null, small = true): MediaTrackConstraints | true {
  const size = small ? { width: { ideal: 320 }, height: { ideal: 240 } } : {};
  if (deviceId) return { ...size, deviceId: { ideal: deviceId } };
  return small ? size : true;
}

export function hasPassedDeviceCheck(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(DEVICE_CHECK_PASSED_PREFIX + sessionId) === "1";
  } catch {
    return false;
  }
}

export function markDeviceCheckPassed(sessionId: string) {
  try {
    sessionStorage.setItem(DEVICE_CHECK_PASSED_PREFIX + sessionId, "1");
  } catch {
    /* without storage, a reload shows the check again: harmless */
  }
}

/** Human-readable reason of a getUserMedia failure. */
export function mediaErrorMessage(err: unknown, device: "mic" | "camera"): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const what = device === "mic" ? "micro" : "camera";
  if (name === "NotAllowedError" || name === "SecurityError")
    return `Trình duyệt đang chặn quyền dùng ${what}. Bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép, rồi thử lại.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `Không tìm thấy ${what} nào trên máy.`;
  if (name === "NotReadableError" || name === "AbortError")
    return `${what === "micro" ? "Micro" : "Camera"} đang bị ứng dụng khác dùng (Zoom, Meet, ...). Hãy tắt ứng dụng đó rồi thử lại.`;
  return `Không mở được ${what}.`;
}

export interface OpenedMedia {
  stream: MediaStream;
  hasVideo: boolean;
  /** Why the camera could not be used (undefined: it works, or the learner switched it off). */
  cameraError?: unknown;
}

/**
 * Opens the devices picked on the device check: microphone + camera, then microphone only when the camera is off or
 * unavailable. Rejects only when not even the microphone can be opened.
 */
export async function openMediaStream(): Promise<OpenedMedia> {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) throw Object.assign(new Error("getUserMedia is not available"), { name: "NotFoundError" });
  const media = readStoredMediaChoice();
  const audio = micConstraints(media.micDeviceId);
  let cameraError: unknown;
  if (media.cameraEnabled) {
    for (const small of [true, false]) {
      try {
        const stream = await devices.getUserMedia({ video: cameraConstraints(media.cameraDeviceId, small), audio });
        return { stream, hasVideo: stream.getVideoTracks().length > 0 };
      } catch (err) {
        cameraError = err;
      }
    }
    console.warn("Camera unavailable, falling back to microphone-only:", cameraError);
  }
  const stream = await devices.getUserMedia({ audio });
  return { stream, hasVideo: false, cameraError };
}

/** A track that can still deliver media (tolerates track objects without a readyState). */
export const isTrackLive = (track: MediaStreamTrack): boolean => track.readyState !== "ended";

export const hasLiveAudio = (stream: MediaStream | null | undefined): boolean =>
  Boolean(stream && stream.getAudioTracks().some(isTrackLive));
