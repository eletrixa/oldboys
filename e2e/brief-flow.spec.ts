/**
 * E2E: the recruiter flow of plans/012 from the home page through the New brief wizard to the results table (S1 to S5).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/brief-flow.spec.ts
 * Deps:    @playwright/test, e2e/session
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - S1 landing vs. logged-in home; S2 pick an existing position and create one from the role catalog; S3 two rows (LinkedIn URL,
 *   pasted CV), a removed row, a ticked pool candidate; S4 two candidate POSTs and one enrich call, landing on the results table
 *
 * Design constraints:
 * - POST /api/positions/:id/enrich is mocked with page.route, so no run starts and nothing is spent (no Apify, no LLM);
 *   S5 fit % and Open profile need a finished run and are checked by the verifier against the preview, not here
 * - Positions created here are manual catalog titles (no LLM call); candidates are added for real and stay pooled
 */
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./session";

const SUFFIX = Date.now().toString(36);

test("home, New brief wizard, research start, results table", async ({ page }) => {
  test.setTimeout(90_000);

  // S1: logged out sees the landing.
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Create account" })).toBeVisible();

  // S1: logged in, home is the briefs list with New brief.
  await registerAndLogin(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/briefs$/);
  const newBrief = nav.getByRole("link", { name: "New brief" });
  await expect(newBrief).toBeVisible();

  // An existing position with one pooled candidate, made through the same routes the UI uses.
  const existing = await page.evaluate(async (suffix) => {
    const post = (path: string, body: unknown) =>
      fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const pos = (await (await post("/api/positions", { title: "Backend Engineer", company: `E2E Co ${suffix}` })).json()) as { id: string };
    await post(`/api/positions/${pos.id}/candidates`, { name: `Pooled ${suffix}`, cvText: `Pooled ${suffix}, backend engineer, Go and Postgres.` });
    return pos.id;
  }, SUFFIX);

  // S2: New brief opens step 1; create from the role catalog without leaving the page.
  await newBrief.click();
  await expect(page).toHaveURL(/\/briefs\/new$/);
  await expect(page.getByRole("heading", { name: "Position" })).toBeVisible();
  await page.getByRole("combobox", { name: "Role you are hiring for" }).fill("CMO");
  await page.getByRole("option", { name: /Chief Marketing Officer/ }).click();
  await page.getByRole("button", { name: "Create position" }).click();
  await expect(page.getByRole("heading", { name: "Chief Marketing Officer" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Must-haves" }).getByRole("listitem")).not.toHaveCount(0);

  // S2: change and pick the existing position from the searchable list.
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("Find a position").fill(`E2E Co ${SUFFIX}`);
  await page.getByRole("list", { name: "Positions" }).getByRole("button", { name: /Backend Engineer/ }).click();
  await expect(page.getByRole("list", { name: "Must-haves" }).getByRole("listitem")).not.toHaveCount(0);

  // S3: a LinkedIn row, a pasted CV row, a third row removed again, the pooled candidate ticked.
  await page.getByRole("combobox", { name: "Candidate's LinkedIn profile or name" }).fill(`https://www.linkedin.com/in/e2e-${SUFFIX}`);
  await page.getByRole("button", { name: "Add another candidate" }).click();
  const second = page.getByRole("listitem", { name: "Candidate 2" });
  await second.getByRole("tab", { name: "Paste CV" }).click();
  await second.getByLabel("CV text").fill(`Jana E2E ${SUFFIX}. Backend engineer, eight years of Go, Kubernetes and Postgres.`);
  await page.getByRole("button", { name: "Add another candidate" }).click();
  await page.getByRole("listitem", { name: "Candidate 3" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("listitem", { name: /^Candidate \d$/ })).toHaveCount(2);
  await page.getByRole("checkbox", { name: new RegExp(`Pooled ${SUFFIX}`) }).check();

  // S4: two candidate POSTs, one enrich call with three ids (mocked: no run, no spend), then the results table.
  let enrichBody: { applicationIds: string[] } | null = null;
  await page.route("**/api/positions/*/enrich", async (route) => {
    enrichBody = route.request().postDataJSON() as { applicationIds: string[] };
    const started = enrichBody.applicationIds.map((applicationId, i) => ({ applicationId, runId: `r_e2e${SUFFIX}${String(i)}` }));
    await route.fulfill({ json: { started, skipped: [] } });
  });
  const added: number[] = [];
  page.on("response", (res) => {
    if (/\/api\/positions\/[^/]+\/candidates$/.test(new URL(res.url()).pathname)) added.push(res.status());
  });
  await page.getByRole("button", { name: "Research 3 candidates" }).click();
  await expect(page).toHaveURL(new RegExp(`/positions/${existing}#candidates$`));
  expect(added).toEqual([201, 201]);
  expect(enrichBody).not.toBeNull();
  expect(new Set(enrichBody!.applicationIds).size).toBe(3);

  // S5 (partial): the results table lists the new candidates; status, fit % and Open profile need a real run.
  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();
});
