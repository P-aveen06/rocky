import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Component tests render <App /> directly rather than through <AuthGate />,
    // so Clerk stays off regardless of whether the developer running them has a
    // publishable key in web/.env.local. Without this the suite passes in CI and
    // fails on a Clerk-configured machine.
    env: { VITE_CLERK_PUBLISHABLE_KEY: "" },
  },
});
