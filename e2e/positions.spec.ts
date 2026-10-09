/**
 * E2E: the recruiter path from a pasted posting to a position that research can start from.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/positions.spec.ts
 * Deps:    @playwright/test, e2e/session
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Add a position, see its must-haves, open the research start form with it, add a candidate to its pool, find it in the list
 *
 * Design constraints:
 * - Logs in through a throwaway account (session cookie), no team token; no research run is started (no spend)
 * - Assertions hold on the deterministic fallback extraction (no LLM needed)
 */
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./session";

const SUFFIX = Date.now().toString(36);
const TITLE = `Senior Data Engineer ${SUFFIX}`;
const POSTING = [
  "Senior Data Engineer, Prague (hybrid).",
  "You will design and run batch and streaming data pipelines on a cloud warehouse, own data quality,",
  "and work with analysts and product managers on reliable metrics. We expect several years of Python and SQL,",
  "experience with orchestration tools such as Airflow, and the habit of writing down what you build.",
  "Nice to have: dbt, Kafka, and a record of mentoring colleagues.",
].join(" ");

test("paste a posting, research from it, find it in the list", async ({ page }) => {
  test.setTimeout(90_000);
  await registerAndLogin(page);
  await page.goto("/positions/new");
  await page.getByRole("tab", { name: "By hand" }).click();
  await page.getByLabel("Title", { exact: true }).fill(TITLE);
  await page.getByLabel("Posting text (optional)").fill(POSTING);
  await page.getByRole("button", { name: "Add position" }).click();

  await expect(page).toHaveURL(/\/positions\/(?!new$)[A-Za-z0-9_-]+$/, { timeout: 60_000 }); // ingest may call the LLM
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  await expect(page.getByRole("heading", { level: 1 })).toContainText(TITLE);
  await expect(page.getByRole("list", { name: "Must-haves" }).getByRole("listitem")).not.toHaveCount(0);

  await page.getByRole("link", { name: "Research a candidate" }).click();
  await expect(page).toHaveURL(`/?positionId=${id}`);
  await expect(page.getByText(TITLE)).toBeVisible();
  await expect(page.locator("input[name=role]")).toHaveCount(0);

  await page.goto(`/positions/${id}`);
  await page.getByLabel("LinkedIn URL").fill(`https://www.linkedin.com/in/e2e-${SUFFIX}`);
  await page.getByRole("button", { name: "Add to pool" }).click();
  const row = page.getByRole("row", { name: /Added by hand/ });
  await expect(row).toContainText("In pool");
  await expect(page.getByRole("button", { name: "Start enrichment (0)" })).toBeDisabled(); // never started here: it spends budget

  await page.goto("/positions");
  const section = page.locator("section", { has: page.getByRole("heading", { name: "data", exact: true }) });
  await expect(section.getByRole("link", { name: TITLE })).toBeVisible();
});
