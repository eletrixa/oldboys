/**
 * Vitest configuration for the extension: WXT plugin provides the in-memory fake browser.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/vitest.config.ts
 * Deps:    vitest, wxt/testing
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Run src/**\/__tests__/*.test.ts under Node with WXT aliases (@domain, wxt/browser → fake)
 *
 * Design constraints:
 * - Every test calls fakeBrowser.reset() in beforeEach; no state leaks between tests
 */
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
