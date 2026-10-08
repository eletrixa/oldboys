/**
 * Vitest configuration: plain Node environment for pure domain and recipe tests.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  vitest.config.ts
 * Deps:    vitest
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Run src/**\/__tests__/*.test.ts under Node with the @/ alias
 *
 * Design constraints:
 * - Workers pool (@cloudflare/vitest-pool-workers) deliberately not used yet; domain code must stay
 *   runnable without bindings
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
