/**
 * Eval set as a regression gate: the synthetic personas run through the real seams on every `pnpm check`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/__tests__/eval.test.ts
 * Deps:    vitest, eval/run, eval/results.json
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Every persona runs without a harness problem in both modes (each model call and cited source has a recorded answer)
 * - No regression, per mode (simulated recruiter answers the lineup / strict, nobody answers): the score never drops
 *   below the committed eval/results.json and no check that passed there misses now (a new miss names the persona
 *   and the check); the lineup never asks more questions than committed
 * - Hard rule: zero unsafe misses in both modes
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
import { type EvalReport, markdown, type ModeReport } from "../score";

const read = (name: string): string => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const committed = JSON.parse(read("results.json")) as EvalReport;
const key = (m: { persona: string; label: string }): string => `${m.persona}: ${m.label}`;
const fresh = (now: ModeReport, was: ModeReport): string[] => {
  const known = new Set(was.misses.map(key));
  return now.misses.filter((m) => !known.has(key(m))).map((m) => `${key(m)} -> ${m.detail}`);
};

describe("eval set", () => {
  it("runs every persona through the seams with recorded answers only, in both modes", async () => {
    for (const p of PERSONAS) {
      for (const mode of ["recruiter", "strict"] as const) {
        const r = await runPersona(p, mode);
        expect(r.problems, `${p.id} ${mode}`).toEqual([]);
        expect(r.brief, `${p.id} ${mode}`).not.toBeNull();
      }
    }
  });

  it("does not regress below the committed results in either mode; zero unsafe misses", async () => {
    const now = await runEval();
    expect(fresh(now, committed), "new misses with the simulated recruiter (fix the pipeline, never the truth)").toEqual([]);
    expect(fresh(now.strict, committed.strict), "new misses in strict mode (fix the pipeline, never the truth)").toEqual([]);
    expect(now.headline.passed).toBeGreaterThanOrEqual(committed.headline.passed);
    expect(now.strict.headline.passed).toBeGreaterThanOrEqual(committed.strict.headline.passed);
    expect(now.headline.unsafe_misses, "unsafe misses with the simulated recruiter").toBe(0);
    expect(now.strict.headline.unsafe_misses, "unsafe misses in strict mode").toBe(0);
    expect(now.lineup.asked, "more lineup questions than committed").toBeLessThanOrEqual(committed.lineup.asked);
  });

  it("the simulated recruiter answers only what the product asks, from the ground truth", async () => {
    const now = await runEval();
    for (const p of now.lineup.personas) {
      for (const q of p.questions) {
        expect(q.answer, `${p.id}: ${q.note}`).toBe(q.truth === "own" ? "merge" : q.truth === "namesake" ? "rejected" : "possibly-same-as");
      }
    }
    const asked = now.lineup.personas.flatMap((p) => p.questions);
    expect(now.lineup.asked).toBe(asked.length);
    expect(now.lineup.own + now.lineup.namesake + now.lineup.unknown).toBe(asked.length);
    // An auto merge or auto rejection is never overridden: the recruiter run keeps every decision the product made itself
    for (const p of PERSONAS) {
      const [r, s] = await Promise.all([runPersona(p, "recruiter"), runPersona(p, "strict")]);
      const byUrl = new Map(r.candidates.map((c) => [c.profile_urls[0], c.decision]));
      for (const c of s.candidates.filter((x) => x.decision !== "possibly-same-as")) expect(byUrl.get(c.profile_urls[0]), `${p.id}: ${c.profile_urls[0] ?? ""}`).toBe(c.decision);
    }
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
