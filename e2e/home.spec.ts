/**
 * E2E smoke: a logged-in recruiter sees the start form; a logged-out visitor sees the landing, or /login with a position.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/home.spec.ts
 * Deps:    @playwright/test, e2e/session
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Anonymous `/` shows the landing with Create account in the body and Log in in the header
 * - Anonymous `/?positionId=x` lands on `/login?next=...`
 * - After registering, heading, profile field, submit button and the Positions link are present
 * - Profile picker (plans/011): a pasted URL fills the hidden profileUrl; a name plus "Find profiles" calls
 *   /api/profiles/suggest (mocked by the test) and the picked row lands in profileUrl; 503 degrades to calm copy
 *
 * Design constraints:
 * - One registration per file (10 per hour per IP), cookies shared across the tests
 * - No network calls to /api/start; the form is never submitted; the suggest route is answered by page.route so no
 *   search provider or key is needed
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { registerAndLogin } from "./session";

// Registration is limited to 10 per hour per IP, so the file registers once and every test reuses the cookies.
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await registerAndLogin(page);
  cookies = await page.context().cookies();
  await page.close();
});

test("logged-out visitors go to login and keep the position", async ({ page }) => {
  await page.goto("/?positionId=abc");
  await expect(page).toHaveURL(/\/login\?next=%2F%3FpositionId%3Dabc$/);
});

test("logged-out visitors see the landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("interview knowing");
  await expect(page.getByRole("main").getByRole("link", { name: "Create account" }).first()).toHaveAttribute("href", "/register");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
});

test("home page renders the start form", async ({ page }) => {
  await page.context().addCookies(cookies);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /linkedin profile or name/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /create brief/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /see positions/i })).toBeVisible();
});

test("a pasted profile URL fills profileUrl and hides the search button", async ({ page }) => {
  await page.context().addCookies(cookies);
  await page.goto("/");
  const field = page.getByRole("combobox", { name: /linkedin profile or name/i });
  await field.fill("https://www.linkedin.com/in/jan-novak");
  await expect(page.getByRole("button", { name: /find profiles/i })).toHaveCount(0);
  await expect(page.locator("input[name=profileUrl]")).toHaveValue("https://www.linkedin.com/in/jan-novak");
});

test("a name offers profiles to pick and the pick lands in profileUrl", async ({ page }) => {
  await page.context().addCookies(cookies);
  await page.route("**/api/profiles/suggest?*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("q")).toBe("Jan Novák");
    expect(url.searchParams.get("hint")).toBe("Seznam");
    await route.fulfill({
      json: {
        source: "web-search",
        suggestions: [
          { url: "https://www.linkedin.com/in/jan-novak-1a2b", name: "Jan Novák", headline: "Data Engineer · Seznam", snippet: "" },
          { url: "https://www.linkedin.com/in/jan-novak-77", name: "Jan Novák", headline: "Teacher", snippet: "" },
        ],
      },
    });
  });
  await page.goto("/");
  await page.getByRole("combobox", { name: /linkedin profile or name/i }).fill("Jan Novák");
  await page.getByLabel(/company or city/i).fill("Seznam");
  await page.getByRole("button", { name: /find profiles/i }).click();
  const list = page.getByRole("listbox");
  await expect(list.getByRole("option")).toHaveCount(2);
  await list.getByRole("option", { name: /teacher/i }).click();
  await expect(page.locator("input[name=profileUrl]")).toHaveValue("https://www.linkedin.com/in/jan-novak-77");
  await expect(page.getByText("linkedin.com/in/jan-novak-77")).toBeVisible();
  await page.getByRole("button", { name: /^change$/i }).click();
  await expect(page.getByRole("combobox", { name: /linkedin profile or name/i })).toBeVisible();
  await expect(page.locator("input[name=profileUrl]")).toHaveValue("");
});

test("without a search provider the field degrades to the pasted link", async ({ page }) => {
  await page.context().addCookies(cookies);
  await page.route("**/api/profiles/suggest?*", (route) => route.fulfill({ status: 503, json: { error: "suggest unavailable" } }));
  await page.goto("/");
  await page.getByRole("combobox", { name: /linkedin profile or name/i }).fill("Jan Novák");
  await page.getByRole("button", { name: /find profiles/i }).click();
  await expect(page.getByRole("status")).toContainText(/not available right now/i);
});
