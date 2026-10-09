/**
 * Eval set as a regression gate: the synthetic personas run through the real seams on every `pnpm check`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/__tests__/eval.test.ts
 * Deps:    vitest, eval/run, eval/results.json
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Every persona runs without a harness problem (each model call and cited source has a recorded answer)
 * - No regression: the headline never drops below the committed eval/results.json and no check that passed there
 *   misses now (a new miss names the persona and the check)
 * - eval/RESULTS.md is the rendering of eval/results.json
 *
 * Design constraints:
 * - Fake ports only; no network. An improvement does not fail the test: re-run `pnpm eval` and commit the files
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runPersona } from "../harness";
import { PERSONAS } from "../personas";
import { runEval } from "../run";
import { type EvalReport, markdown } from "../score";

const read = (name: string): string => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const committed = JSON.parse(read("results.json")) as EvalReport;
const key = (m: { persona: string; label: string }): string => `${m.persona}: ${m.label}`;

describe("eval set", () => {
  it("runs every persona through the seams with recorded answers only", async () => {
    for (const p of PERSONAS) {
      const r = await runPersona(p);
      expect(r.problems, p.id).toEqual([]);
      expect(r.brief, p.id).not.toBeNull();
    }
  });

  it("does not regress below the committed results", async () => {
    const now = await runEval();
    const known = new Set(committed.misses.map(key));
    const fresh = now.misses.filter((m) => !known.has(key(m))).map((m) => `${key(m)} -> ${m.detail}`);
    expect(fresh, "new misses (fix the pipeline, never the truth)").toEqual([]);
    expect(now.headline.passed).toBeGreaterThanOrEqual(committed.headline.passed);
    expect(now.headline.unsafe_misses).toBeLessThanOrEqual(committed.headline.unsafe_misses);
  });

  it("keeps eval/RESULTS.md in step with eval/results.json", () => {
    expect(read("RESULTS.md")).toBe(markdown(committed));
  });

  it("uses fictional people only: evalp- handles and example.* web pages", () => {
    for (const p of PERSONAS) {
      const urls = [p.profileUrl ?? "", ...p.truth.profiles.map((x) => x.url), ...Object.values(p.recorded.serp).flat().map((h) => h.url)].filter((u) => u !== "");
      for (const u of urls) expect(/\/(?:in\/)?evalp-|\.example\.(?:com|org|net)\//.test(u), `${p.id}: ${u}`).toBe(true);
    }
  });
});
