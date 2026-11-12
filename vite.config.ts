import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/opponent": {
        target: "http://localhost:8002",
        changeOrigin: true,
        secure: false,
      },
      "/api/opponent": {
        target: "http://localhost:8002",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/evaluate": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/api/evaluate": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/coaching": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/api/coaching": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/multimodal-health": {
        target: "http://localhost:8003",
        changeOrigin: true,
        secure: false,
        rewrite: () => "/health",
      },
      "/multimodal": {
        target: "http://localhost:8003",
        changeOrigin: true,
        secure: false,
      },
      "/api/multimodal": {
        target: "http://localhost:8003",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/ai-health": {
        target: "http://localhost:8002",
        changeOrigin: true,
        secure: false,
        rewrite: () => "/health",
      },
      "/evaluator-health": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        rewrite: () => "/health",
      },
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

