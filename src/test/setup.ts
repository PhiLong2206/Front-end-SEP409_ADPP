import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Room tests mock aiApi.generateOpponentTurn (POST .../turns); the streamed path has its own tests
vi.stubEnv("VITE_AI_TURN_STREAM", "false");

// Rooms open the microphone on entry before they start a session; jsdom has no devices, so give it a working one.
// Tests that exercise device behaviour redefine navigator.mediaDevices themselves.
Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    writable: true,
    value: {
        getUserMedia: async () => {
            const track = { kind: "audio", label: "Mic", readyState: "live", stop() {} };
            return { getAudioTracks: () => [track], getVideoTracks: () => [], getTracks: () => [track] };
        },
    },
});

afterEach(() => {
    cleanup();
});