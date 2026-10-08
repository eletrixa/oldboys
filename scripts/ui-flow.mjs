/**
 * Browser flow for Screen 1 -> Screen 2 against a running preview (pnpm preview on :8787).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  scripts/ui-flow.mjs
 * Deps:    @playwright/test from the extension workspace, system chromium at /usr/bin/chromium
 * Tested:  n/a (manual, used by the CEO review loop)
 *
 * Key responsibilities:
 * - Fill the start form, submit, wait for lineup questions, answer them (first Yes, then No), screenshot every state
 * - Usage: node scripts/ui-flow.mjs "<subject>" "<anchor>" "<role>" <screenshot-prefix>
 *
 * Design constraints:
 * - Spends real Apify money through the Worker; never run in CI
 */
import { chromium } from "../extension/node_modules/@playwright/test/index.mjs";
const [subject, anchor, role, prefix] = process.argv.slice(2);
const log = (...parts) => process.stdout.write(parts.join(" ") + "\n");
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) log("console.error:", m.text()); });
await page.goto("http://127.0.0.1:8787/", { waitUntil: "networkidle" });
await page.fill('input[name="name"]', subject);
await page.fill('input[name="anchor"]', anchor);
await page.fill('input[name="role"]', role);
await page.screenshot({ path: `${prefix}-1-start.png`, fullPage: true });
await page.click('button[type="submit"]');
await page.waitForURL(/\/runs\//, { timeout: 30000 });
log("run url:", page.url());
await page.waitForTimeout(5000);
await page.screenshot({ path: `${prefix}-2-progress.png`, fullPage: true });
// wait for the lineup question (paused) or completion, up to 6 minutes
const started = Date.now();
let shot = 0;
while (Date.now() - started < 360000) {
  const q = page.locator("text=Quick question");
  if (await q.count()) {
    await page.screenshot({ path: `${prefix}-3-question${shot}.png`, fullPage: true });
    const text = await q.first().textContent();
    log("question:", text);
    await page.locator("button", { hasText: shot === 0 ? "Yes, it's them" : "No" }).first().click();
    shot++;
    await page.waitForTimeout(800);
    continue;
  }
  const done = await page.locator("text=Something went wrong").count() + await page.locator("#brief").count();
  if (done) break;
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(3000);
await page.screenshot({ path: `${prefix}-4-end.png`, fullPage: true });
log("body:", (await page.locator("main").innerText()).slice(0, 400).replace(/\n+/g, " | "));
await browser.close();
