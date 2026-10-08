/**
 * Chromium smoke test: the built extension mounts its button on a LinkedIn profile and starts a run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/e2e/launcher.spec.ts
 * Deps:    @playwright/test (persistent context with --load-extension), built .output/chrome-mv3
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Intercept linkedin.com and the oldboys API so nothing leaves the machine
 * - Assert: shadow-root button mounts; click → POST /api/runs with the parsed mark; run stored; badge logic reachable
 *
 * Design constraints:
 * - Chromium only (Playwright cannot load Firefox extensions); run with `pnpm e2e` after `pnpm build`
 */
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXT = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));
const FIXTURE = readFileSync(fileURLToPath(new URL("./fixtures/linkedin-profile.html", import.meta.url)), "utf8");

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
});

test.afterAll(async () => {
  await context.close();
});

test("button mounts on a profile page and a click starts a run", async () => {
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent("serviceworker");
  await worker.evaluate(() =>
    chrome.storage.local.set({ settings: { apiBase: "https://oldboys.asajj.cz", token: "t0k", goal: "hiring" } }),
  );

  const posted: unknown[] = [];
  await context.route("https://www.linkedin.com/in/**", (route) => route.fulfill({ contentType: "text/html", body: FIXTURE }));
  await context.route("https://oldboys.asajj.cz/api/runs", (route) => {
    posted.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "run-e2e" }) });
  });

  const page = await context.newPage();
  await page.goto("https://www.linkedin.com/in/jan-novak-1a2b3c/");
  const host = page.locator("#oldboys-research-host");
  await expect(host).toBeAttached();
  const button = host.locator("button");
  await expect(button).toHaveText("Research with oldboys");

  await button.click();
  await expect(button).toHaveText("Researching (hiring)…");
  expect(posted).toEqual([
    { subject: "Jan Novák", anchor: "Prague, Czechia", goal: "hiring", sourceUrl: "https://www.linkedin.com/in/jan-novak-1a2b3c" },
  ]);

  const stored = await worker.evaluate(() => chrome.storage.local.get("runs"));
  expect(stored).toMatchObject({ runs: [{ runId: "run-e2e", status: "queued", subject: "Jan Novák" }] });
  const alarm = await worker.evaluate(() => chrome.alarms.get("poll"));
  expect(alarm).toMatchObject({ periodInMinutes: 1 });
});
