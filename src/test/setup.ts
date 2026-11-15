import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Room tests mock aiApi.generateOpponentTurn (POST .../turns); the streamed path has its own tests
vi.stubEnv("VITE_AI_TURN_STREAM", "false");

afterEach(() => {
    cleanup();
});