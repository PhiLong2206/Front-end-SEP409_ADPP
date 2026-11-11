
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        clearMocks: true,
        // Each file builds a jsdom and renders a large room. By default one worker per CPU fights over the machine:
        // measured on 18 logical CPUs, 17 workers took 76 s with tests timing out, 4 workers took 53 s with none.
        maxWorkers: 4,
        // Real time, so it includes waiting for a CPU: leaves room for a slower CI runner, a real hang still fails.
        testTimeout: 15_000,
    },
});
