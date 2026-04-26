import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      // v8 ships with Node so no native dep to compile in CI.
      provider: "v8",
      reporter: ["text-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      // Generated UI primitives, types, and the test harness itself
      // would inflate coverage numbers without telling us anything
      // about our own code.
      exclude: [
        "src/components/ui/**",
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "**/node_modules/**",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
