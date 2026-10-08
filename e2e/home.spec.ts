/**
 * E2E smoke: the home page renders the start form and links to the roles overview.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/home.spec.ts
 * Deps:    @playwright/test
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Heading, profile URL input, submit button and the Roles/Positions link are present
 *
 * Design constraints:
 * - No network calls to /api/start; the form is never submitted
 */
import { expect, test } from "@playwright/test";

test("home page renders the start form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("input[name=profileUrl]")).toBeVisible();
  await expect(page.getByRole("button", { name: /\S/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /roles|positions/i })).toBeVisible();
});
