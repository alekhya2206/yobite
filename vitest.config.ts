import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.tsx"],
    environment: "node", // per-file override via `// @vitest-environment jsdom`
    pool: "vmForks",     // Node 26 has an experimental localStorage that bleeds into forks/threads
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
