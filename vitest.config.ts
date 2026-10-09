import { defineConfig } from "vitest/config";

// Tests unitarios y de integración de los paquetes (pnpm test). Las evals con modelos van aparte (pnpm evals).
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
