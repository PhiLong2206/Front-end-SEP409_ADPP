import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSharedDeviceStream } from "../pages/debater/DebatePractice/useSharedDeviceStream";

type FakeTrack = {
  kind: string;
  readyState: string;
  stop: ReturnType<typeof vi.fn>;
  listeners: Record<string, () => void>;
  addEventListener: (type: string, cb: () => void) => void;
};
const track = (kind = "audio"): FakeTrack => {
  const t: FakeTrack = {
    kind,
    readyState: "live",
    stop: vi.fn(),
    listeners: {},
    addEventListener: (type, cb) => {
      t.listeners[type] = cb;
    },
  };
  return t;
};
const stream = (...tracks: FakeTrack[]) => ({
  getTracks: () => tracks,
  getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
  getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
});

const setUserMedia = (impl: () => Promise<unknown>) => {
  const getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, writable: true, value: { getUserMedia } });
  return getUserMedia;
};

describe("useSharedDeviceStream", () => {
  beforeEach(() => {
    localStorage.setItem("adpp.media.cameraEnabled", "0"); // microphone only: one getUserMedia call per open
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("a late answer of the entry request does not stop a stream a recording already opened", async () => {
    const entry = track();
    const recording = track();
    let answerEntry!: (s: unknown) => void;
    let calls = 0;
    setUserMedia(() => {
      calls += 1;
      return calls === 1 ? new Promise((r) => (answerEntry = r)) : Promise.resolve(stream(recording));
    });
    const { result } = renderHook(() => useSharedDeviceStream(true));

    await act(async () => {
      await result.current.acquire();
    });
    await act(async () => {
      answerEntry(stream(entry));
    });

    expect(recording.stop).not.toHaveBeenCalled(); // still in use
    expect(entry.stop).toHaveBeenCalled(); // the duplicate is given back
    expect(result.current.phase).toBe("ready");
  });

  it("two recordings started at once share one request", async () => {
    const first = track();
    const getUserMedia = setUserMedia(async () => stream(first));
    const { result } = renderHook(() => useSharedDeviceStream(false));

    let a!: Awaited<ReturnType<typeof result.current.acquire>>;
    let b!: Awaited<ReturnType<typeof result.current.acquire>>;
    await act(async () => {
      [a, b] = await Promise.all([result.current.acquire(), result.current.acquire()]);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(a.stream).toBe(b.stream);
    expect(first.stop).not.toHaveBeenCalled();
  });

  it("a camera that ends is noticed, and the preview is dropped", async () => {
    localStorage.setItem("adpp.media.cameraEnabled", "1");
    const mic = track("audio");
    const cam = track("video");
    setUserMedia(async () => stream(mic, cam));
    const { result } = renderHook(() => useSharedDeviceStream(true));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.hasVideo).toBe(true);

    await act(async () => {
      cam.readyState = "ended";
      cam.listeners.ended();
    });

    expect(result.current.deviceLost).toBe(true);
    expect(result.current.hasVideo).toBe(false);
  });
});
