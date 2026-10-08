/**
 * Playwright configuration for the extension smoke test (Chromium only).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/playwright.config.ts
 * Deps:    @playwright/test
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Run e2e/*.spec.ts serially against the built chrome-mv3 output
 *
 * Design constraints:
 * - Not part of pnpm check (needs a Chromium download); run with pnpm e2e
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
});
