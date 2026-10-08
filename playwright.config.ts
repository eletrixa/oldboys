/**
 * Playwright configuration for the web app e2e smoke tests (Chromium only).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  playwright.config.ts
 * Deps:    @playwright/test
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Run e2e/*.spec.ts serially against the Next dev server on port 3141 (started or reused)
 *
 * Design constraints:
 * - Not part of pnpm check (needs a Chromium download); run with pnpm e2e
 * - The extension has its own config in extension/playwright.config.ts
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: { baseURL: "http://localhost:3141" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3141",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
