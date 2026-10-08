/**
 * E2E helper: register a throwaway account in the browser so the page holds a session cookie.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/session.ts
 * Deps:    @playwright/test
 * Tested:  n/a (used by the specs)
 *
 * Key responsibilities:
 * - registerAndLogin: POST /api/auth/register from the page (same-origin, so the browser headers pass), manual organization
 *
 * Design constraints:
 * - Unique email per call; registration is rate limited to 10 per hour per IP, so specs register once per file
 * - No ARES call, no password printed
 */
import { expect, type Page } from "@playwright/test";

export async function registerAndLogin(page: Page): Promise<void> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/register");
  const status = await page.evaluate(async (suffix) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `e2e-${suffix}@example.test`,
        password: `pw-${suffix}-e2e-only`,
        name: "E2E Recruiter",
        organization: { name: `E2E Org ${suffix}`, source: "manual" },
      }),
    });
    return res.status;
  }, id);
  expect(status).toBe(201);
}
