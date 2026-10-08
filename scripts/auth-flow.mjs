/**
 * Browser and API smoke for the recruiter account flow against a running preview (pnpm preview on :8787).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  scripts/auth-flow.mjs
 * Deps:    @playwright/test from the extension workspace, system chromium at /usr/bin/chromium, pnpm exec wrangler (local D1)
 * Tested:  n/a (manual smoke)
 *
 * Key responsibilities:
 * - Register (with ARES lookup), onboarding, first brief, briefs list, roles, audit, logout, route guards
 * - Cookie flags, login throttle, duplicate email, bearer routes, ARES validation and cache
 * - Usage: node scripts/auth-flow.mjs <base-url> <screenshot-prefix>; exit 1 on any FAIL
 *
 * Design constraints:
 * - Writes accounts into the local D1 only; never prints RUN_TOKEN; the 11th-registration cap is unit-tested, not driven here
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "../extension/node_modules/@playwright/test/index.mjs";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const prefix = process.argv[3] ?? "smoke";
const SHOTS = "/tmp/claude-1000/-home-asajj-code-oldboys/de97070c-7a94-4afb-9b0a-33d82421b9a5/scratchpad/shots";
mkdirSync(SHOTS, { recursive: true });
const PASSWORD = "correct-horse-9";
const stamp = Date.now();
const email1 = `smoke+${stamp}@example.com`;
const email2 = `smoke+${stamp}b@example.com`;
const host = new URL(base).host;
const SAME = { Origin: base, Host: host, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" };

let failed = false;
let aresUnreachable = false;
const log = (...p) => process.stdout.write(p.join(" ") + "\n");
const check = (n, ok, detail = "") => {
  if (!ok) failed = true;
  log(`${ok ? "PASS" : "FAIL"} ${n}${detail ? ": " + detail : ""}`);
};
const d1 = (sql) => {
  const out = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "oldboys", "--local", "--command", sql, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
};
const post = (path, body, headers = SAME) => fetch(base + path, { method: "POST", headers, body: JSON.stringify(body), redirect: "manual" });
const org = (name) => ({ name, ico: null, dic: null, legal_form: null, address: null, country: "CZ", source: "manual" });

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) log("console.error:", m.text()); });
const shot = (n, name) => page.screenshot({ path: `${SHOTS}/${prefix}-${n}-${name}.png`, fullPage: true });
let runId = "";
let aresBrowserStatus = 0;
page.on("response", (r) => { if (r.url().includes("/api/ares/")) aresBrowserStatus = r.status(); });

try {
  // 1
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const nav = page.locator('nav[aria-label="Main"]');
  check("1 logged-out / lands on /login", new URL(page.url()).pathname === "/login", page.url());
  check("1 nav shows Log in and Create account", (await nav.getByText("Log in").count()) > 0 && (await nav.getByText("Create account").count()) > 0);
  await shot(1, "logged-out");

  // 2
  await page.goto(base + "/register", { waitUntil: "networkidle" });
  await page.getByLabel("Your name").fill("Smoke Tester");
  await page.getByLabel("Work email").fill(email1);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await shot(2, "register-step1");
  await page.getByRole("button", { name: "Next" }).click();
  await page.locator("#ico").fill("27074358");
  await page.getByRole("button", { name: "Look up in ARES" }).click();
  const nameField = page.getByLabel("Company name");
  const found = await page.waitForFunction(
    () => {
      const v = [...document.querySelectorAll("input")].some((i) => i.value.includes("Asseco"));
      const m = [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent).join(" ");
      return v ? "found" : m || false;
    },
    null,
    { timeout: 30000 },
  ).then((h) => h.jsonValue()).catch(() => "timeout");
  if (found === "found") {
    check("2 ARES lookup fills company name with Asseco", true, await nameField.inputValue());
  } else {
    aresUnreachable = true;
    check("2 browser ARES lookup answers 200", false, `status ${aresBrowserStatus}, page message: ${String(found)}`);
    log("ARES_UNREACHABLE:", String(found));
    await nameField.fill("Smoke s.r.o.");
  }
  await shot(2, "register-step2");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 20000 }).catch(() => {});
  check("2 register routes to /onboarding", new URL(page.url()).pathname === "/onboarding", page.url());
  check("2 onboarding says 'Your company is'", (await page.locator("main").innerText()).includes("Your company is"));
  await shot(2, "onboarding");

  const reg2 = await post("/api/auth/register", { email: email2, password: PASSWORD, name: "Smoke Two", organization: org("Smoke Two s.r.o.") });
  const sc = reg2.headers.getSetCookie().join(" | ");
  check("2 direct register returns 201", reg2.status === 201, String(reg2.status));
  check("2 cookie has oldboys_session, HttpOnly, SameSite=Lax, no Secure", sc.includes("oldboys_session=") && /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && !/Secure/i.test(sc), sc.replace(/oldboys_session=[^;]+/, "oldboys_session=<redacted>"));

  // 3
  await page.getByLabel("Role you are hiring for").fill("Backend engineer");
  await page.locator('input[name="profileUrl"]').fill("https://www.linkedin.com/in/smoke-test-person");
  await shot(3, "start-filled");
  await page.getByRole("button", { name: "Create brief" }).click();
  await page.waitForURL(/\/runs\//, { timeout: 30000 }).catch(() => {});
  const m = /\/runs\/([^/?#]+)/.exec(page.url());
  runId = m?.[1] ?? "";
  check("3 start routes to /runs/<id>", runId !== "", page.url());
  await page.waitForTimeout(2000);
  await shot(3, "run");
  const row = d1("SELECT via, account_id IS NOT NULL AS has_account, organization_id IS NOT NULL AS has_org FROM investigations ORDER BY created_at DESC LIMIT 1")[0];
  check("3 investigation row via=start with account and org", row?.via === "start" && row.has_account === 1 && row.has_org === 1, JSON.stringify(row));

  // 4
  await page.goto(base + "/briefs", { waitUntil: "networkidle" });
  const briefsText = await page.locator("main").innerText();
  check("4 /briefs lists the run with 'Backend engineer'", briefsText.includes("Backend engineer"), briefsText.slice(0, 160).replace(/\n+/g, " | "));
  await shot(4, "briefs");
  await page.goto(base + "/roles", { waitUntil: "networkidle" });
  const rolesText = await page.locator("main").innerText();
  check("4 /roles loads without a token form", new URL(page.url()).pathname === "/roles" && (await page.locator('input[type="password"], input[name*="token" i], input[placeholder*="token" i]').count()) === 0 && !/token/i.test(rolesText), rolesText.slice(0, 120).replace(/\n+/g, " | "));
  await shot(4, "roles");

  // 5
  const audit = await page.request.get(`${base}/api/runs/${runId}/audit`);
  const auditBody = await audit.text();
  check("5 audit JSON contains 'Pre-employment screening by'", audit.status() === 200 && auditBody.includes("Pre-employment screening by"), `${audit.status()} ${auditBody.slice(0, 160)}`);

  // 6
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator('nav[aria-label="Main"]').getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  check("6 logout lands on /login", new URL(page.url()).pathname === "/login", page.url());
  await shot(6, "logged-out");
  await page.goto(base + "/briefs", { waitUntil: "networkidle" });
  check("6 /briefs redirects to /login after logout", new URL(page.url()).pathname === "/login", page.url());
  const noCookie = await post("/api/start", { goal: "hiring", role: "Backend engineer", profileUrl: "https://www.linkedin.com/in/smoke-test-person" });
  check("6 POST /api/start without cookie is 401", noCookie.status === 401, String(noCookie.status));

  // 7
  const wrong = [];
  for (let i = 0; i < 5; i++) wrong.push((await post("/api/auth/login", { email: email1, password: "wrong-password-1" })).status);
  check("7 five wrong logins are 401", wrong.every((s) => s === 401), wrong.join(","));
  const sixth = await post("/api/auth/login", { email: email1, password: "wrong-password-1" });
  check("7 sixth wrong login is 429", sixth.status === 429, String(sixth.status));
  const dup = await post("/api/auth/register", { email: email1, password: PASSWORD, name: "Smoke Tester", organization: org("Dup s.r.o.") });
  check("7 duplicate register is 409", dup.status === 409, String(dup.status));
  log("NOTE 7: the 11th registration per IP (429) is unit-tested, not driven here");

  // 8
  const envPath = new URL("../.dev.vars", import.meta.url).pathname;
  const token = existsSync(envPath) ? /^RUN_TOKEN=(.*)$/m.exec(readFileSync(envPath, "utf8"))?.[1]?.trim().replace(/^["']|["']$/g, "") : undefined;
  const roles401 = await fetch(`${base}/api/roles`);
  check("8 GET /api/roles with nothing is 401 (503 only when RUN_TOKEN is unset)", roles401.status === 401 || (!token && roles401.status === 503), String(roles401.status));
  if (token) {
    const bearer = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const created = await fetch(`${base}/api/runs`, { method: "POST", headers: bearer, body: JSON.stringify({ goal: "hiring", role: "Backend engineer", profileUrl: "https://www.linkedin.com/in/smoke-bearer-person" }) });
    const cj = await created.json().catch(() => ({}));
    check("8 POST /api/runs with bearer is 200/201", created.status === 200 || created.status === 201, `${created.status} ${JSON.stringify(cj).slice(0, 120)}`);
    const id = cj.id ?? cj.runId ?? runId;
    const get = await fetch(`${base}/api/runs/${id}`);
    check("8 GET /api/runs/<id> is 200", get.status === 200, String(get.status));
    const rb = await fetch(`${base}/api/roles`, { headers: { Authorization: `Bearer ${token}` } });
    check("8 GET /api/roles with bearer is 200", rb.status === 200, String(rb.status));
  } else {
    log("SKIP 8: no .dev.vars in this worktree, bearer cases (POST /api/runs, GET /api/roles with bearer) skipped");
    const get = await fetch(`${base}/api/runs/${runId}`);
    check("8 GET /api/runs/<id> is 200", get.status === 200, String(get.status));
  }

  // 9
  const bad = await fetch(`${base}/api/ares/12345678`, { headers: SAME });
  check("9 GET /api/ares/12345678 is 400", bad.status === 400, `${bad.status} ${(await bad.text()).slice(0, 100)}`);
  const a1 = await fetch(`${base}/api/ares/27074358`, { headers: SAME });
  const t1 = d1("SELECT fetched_at FROM ares_cache WHERE ico='27074358'")[0]?.fetched_at;
  const a2 = await fetch(`${base}/api/ares/27074358`, { headers: SAME });
  const t2 = d1("SELECT fetched_at FROM ares_cache WHERE ico='27074358'")[0]?.fetched_at;
  check("9 GET /api/ares/27074358 twice is 200 and 200", a1.status === 200 && a2.status === 200, `${a1.status},${a2.status}`);
  check("9 ares_cache fetched_at unchanged between calls", t1 !== undefined && t1 === t2, `${t1} / ${t2}`);
} catch (e) {
  failed = true;
  log("FAIL script error:", e instanceof Error ? e.stack : String(e));
  await shot(0, "error").catch(() => {});
} finally {
  await browser.close();
}
if (aresUnreachable) log("REPORT: ARES_UNREACHABLE");
log(failed ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(failed ? 1 : 0);
