import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DeviceCheck from "../components/debate/DeviceCheck";
import DebateRoomEntry from "../pages/debater/DebatePractice/DebateRoomEntry";

vi.mock("../pages/debater/DebatePractice/DebateRoom", () => ({ default: () => <div data-testid="room">room</div> }));

type Req = { audio?: { deviceId?: unknown }; video?: unknown };

const fakeStream = (kind: "audio" | "video") => {
  const track = { kind, stop: vi.fn() };
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => (kind === "audio" ? [track] : []), getVideoTracks: () => (kind === "video" ? [track] : []) } };
};

describe("DeviceCheck: microphone / camera check before the debate room", () => {
  let requests: Req[];
  let opened: Array<{ stop: ReturnType<typeof vi.fn> }>;
  let failCamera: Error | null;
  let failMic: Error | null;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    requests = [];
    opened = [];
    failCamera = null;
    failMic = null;
    // Web Audio is missing in jsdom: a silent analyser stands in for it
    vi.stubGlobal("AudioContext", class {
      createAnalyser() {
        return { fftSize: 512, getByteTimeDomainData: (d: Uint8Array) => d.fill(128) };
      }
      createMediaStreamSource() {
        return { connect() {} };
      }
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (c: Req) => {
          requests.push(c);
          if (c.video && failCamera) throw failCamera;
          if (c.audio && failMic) throw failMic;
          const { track, stream } = fakeStream(c.video ? "video" : "audio");
          opened.push(track);
          return stream;
        }),
        enumerateDevices: vi.fn(async () => [
          { kind: "audioinput", deviceId: "mic-a", label: "Micro laptop" },
          { kind: "audioinput", deviceId: "mic-b", label: "Tai nghe USB" },
          { kind: "videoinput", deviceId: "cam-a", label: "Webcam" },
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens mic and camera, lists the devices, remembers the choice and stops every stream on join", async () => {
    const onJoin = vi.fn();
    const { unmount } = render(<DeviceCheck onJoin={onJoin} />);
    await screen.findByText("Camera hoạt động tốt.");
    const select = await screen.findByTestId("device-check-mic-select");
    expect(screen.getByText("Tai nghe USB")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(select, { target: { value: "mic-b" } });
    });
    await waitFor(() => expect(requests[requests.length - 1]?.audio?.deviceId).toEqual({ ideal: "mic-b" }));

    fireEvent.click(screen.getByTestId("device-check-join"));
    expect(onJoin).toHaveBeenCalledWith({ micDeviceId: "mic-b", cameraDeviceId: null, cameraEnabled: true });
    expect(localStorage.getItem("adpp.media.micDeviceId")).toBe("mic-b");
    unmount();
    for (const t of opened) expect(t.stop).toHaveBeenCalled();
  });

  it("switching the camera off stops it and is remembered", async () => {
    const onJoin = vi.fn();
    render(<DeviceCheck onJoin={onJoin} />);
    await screen.findByText("Camera hoạt động tốt.");
    const camTrack = opened.find((t) => (t as unknown as { kind: string }).kind === "video")!;
    fireEvent.click(screen.getByTestId("device-check-camera-toggle"));
    expect(await screen.findByText("Camera đang tắt")).toBeInTheDocument();
    expect(camTrack.stop).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("device-check-join"));
    expect(onJoin.mock.calls[0][0].cameraEnabled).toBe(false);
    expect(localStorage.getItem("adpp.media.cameraEnabled")).toBe("0");
  });

  it("a blocked microphone says how to allow it, offers a retry, and still lets the learner join", async () => {
    failMic = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const onJoin = vi.fn();
    render(<DeviceCheck onJoin={onJoin} />);
    expect(await screen.findByText(/đang chặn quyền dùng micro/)).toBeInTheDocument();
    expect(screen.getByText(/gõ lập luận bằng bàn phím/)).toBeInTheDocument();
    failMic = null;
    await act(async () => {
      fireEvent.click(screen.getByTestId("device-check-retry"));
    });
    expect(await screen.findByText(/Hãy nói thử một câu/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("device-check-join"));
    expect(onJoin).toHaveBeenCalled();
  });

  it("without a camera the learner is told it still works, and joins with the camera setting unchanged", async () => {
    failCamera = Object.assign(new Error("none"), { name: "NotFoundError" });
    const onJoin = vi.fn();
    render(<DeviceCheck onJoin={onJoin} />);
    expect(await screen.findByText("Không tìm thấy camera nào trên máy.")).toBeInTheDocument();
    expect(screen.getByText(/vẫn vào phòng được, chỉ không chấm biểu cảm/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("device-check-join"));
    expect(onJoin).toHaveBeenCalledWith({ micDeviceId: null, cameraDeviceId: null, cameraEnabled: true });
  });

  it("without Web Audio the opened microphone does not keep asking to speak", async () => {
    vi.stubGlobal("AudioContext", undefined);
    render(<DeviceCheck onJoin={vi.fn()} />);
    expect(await screen.findByText(/Micro đã mở/)).toBeInTheDocument();
  });

  it("the room opens only after joining, and a reload of the same session skips the check", async () => {
    const view = () =>
      render(
        <MemoryRouter initialEntries={["/debater/debate/s-1"]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoomEntry />} />
          </Routes>
        </MemoryRouter>
      );
    const first = view();
    expect(screen.getByTestId("device-check")).toBeInTheDocument();
    expect(screen.queryByTestId("room")).not.toBeInTheDocument();
    await screen.findByText("Camera hoạt động tốt.");
    fireEvent.click(screen.getByTestId("device-check-join"));
    expect(screen.getByTestId("room")).toBeInTheDocument();
    first.unmount();

    view();
    expect(screen.getByTestId("room")).toBeInTheDocument();
    expect(screen.queryByTestId("device-check")).not.toBeInTheDocument();
  });
});
