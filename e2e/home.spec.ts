/**
 * E2E smoke: a logged-in recruiter sees the start form; a logged-out visitor is sent to /login.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/home.spec.ts
 * Deps:    @playwright/test, e2e/session
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Anonymous `/?positionId=x` lands on `/login?next=...`
 * - After registering, heading, profile URL input, submit button and the Positions link are present
 *
 * Design constraints:
 * - No network calls to /api/start; the form is never submitted
 */
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./session";

test("logged-out visitors go to login and keep the position", async ({ page }) => {
  await page.goto("/?positionId=abc");
  await expect(page).toHaveURL(/\/login\?next=%2F%3FpositionId%3Dabc$/);
});

test("home page renders the start form", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("input[name=profileUrl]")).toBeVisible();
  await expect(page.getByRole("button", { name: /\S/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /see positions/i })).toBeVisible();
});
