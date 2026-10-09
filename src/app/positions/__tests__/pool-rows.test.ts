/**
 * Tests for the pool row shaping and intake channel helpers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/__tests__/pool-rows.test.ts
 * Deps:    vitest, ../pool-rows
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Selectable only for pooled rows with a profile or CV; added order; name/source/status labels; fit and independent count
 *   only when done; channels; tag suggestion; summary line
 *
 * Design constraints:
 * - No score or rank field exists on a shaped row
 */
import { describe, expect, it } from "vitest";
import type { PoolRow } from "@/app/api/positions/handler";
import { candidateName, candidateSource, candidateStatus, channelsFor, defaultTag, enrichSummary, existingRuns, shapePool } from "../pool-rows";

const base: PoolRow = {
  id: "a1", source: "manual", name: "Ada", email: null, status: "pooled", run_id: null, note: null,
  received_at: "2026-10-09T14:05:00.000Z", has_profile: 1, has_cv: 0, handle: null, run: null,
};
const run = (over: Partial<NonNullable<PoolRow["run"]>> = {}): NonNullable<PoolRow["run"]> => ({
  status: "running", subject: "", step: "LinkedIn", pct: 25, fit_pct: null, independent: 0, stalled: false, ...over,
});

describe("shapePool", () => {
  it("labels a pooled LinkedIn row as selectable with no fit yet", () => {
    const [v] = shapePool([base]);
    expect(v).toMatchObject({ name: "Ada", source: "LinkedIn", status: "Pooled", fit: "—", independent: "—", selectable: true, researching: false, runHref: null });
  });

  it("keeps added order (the API sends newest first)", () => {
    expect(shapePool([{ ...base, id: "new" }, { ...base, id: "old" }]).map((v) => v.id)).toEqual(["old", "new"]);
  });

  it("is not selectable without a profile or CV, or once started", () => {
    const rows = shapePool([
      { ...base, id: "d", has_cv: 1 },
      { ...base, id: "c", status: "run-started", run_id: "r1" },
      { ...base, id: "b", has_profile: 0 },
    ]);
    expect(rows.map((r) => r.selectable)).toEqual([false, false, true]);
    expect(rows[1]?.runHref).toBe("/runs/r1");
  });

  it("shows fit and the independent count only for a done run", () => {
    const [running, done] = shapePool([
      { ...base, id: "b", status: "run-started", run_id: "r2", run: run({ status: "done", pct: 100, fit_pct: 67, independent: 4 }) },
      { ...base, id: "a", status: "run-started", run_id: "r1", run: run({ fit_pct: 50, independent: 3 }) },
    ]);
    expect(running).toMatchObject({ fit: "—", independent: "—", researching: true });
    expect(done).toMatchObject({ fit: "67%", independent: "4", status: "Done", tone: "ok", researching: false });
  });
});

describe("candidateName", () => {
  it("falls back from the application name to the run subject, the LinkedIn handle, then CV candidate", () => {
    expect(candidateName(base)).toBe("Ada");
    expect(candidateName({ ...base, name: null, handle: "Ada Lovelace", run: run({ subject: "Ada King" }) })).toBe("Ada King");
    expect(candidateName({ ...base, name: null, handle: "Ada Lovelace", run: run() })).toBe("Ada Lovelace");
    expect(candidateName({ ...base, name: null })).toBe("CV candidate");
  });
});

describe("candidateSource", () => {
  it("says Intake for channel rows, else LinkedIn, CV or Pool", () => {
    expect(candidateSource({ ...base, source: "email" })).toBe("Intake");
    expect(candidateSource(base)).toBe("LinkedIn");
    expect(candidateSource({ ...base, has_profile: 0, has_cv: 1 })).toBe("CV");
    expect(candidateSource({ ...base, has_profile: 0 })).toBe("Pool");
  });
});

describe("candidateStatus", () => {
  it("shows step and progress while researching, and the end states", () => {
    expect(candidateStatus({ ...base, run: run() })).toEqual({ label: "Researching · LinkedIn · 25%", tone: "unsure", researching: true });
    expect(candidateStatus({ ...base, run: run({ status: "queued", step: null, pct: 0 }) }).label).toBe("Researching · 0%");
    expect(candidateStatus({ ...base, run: run({ status: "failed" }) })).toEqual({ label: "Failed", tone: "conflict", researching: false });
    expect(candidateStatus({ ...base, run: run({ status: "paused" }) }).researching).toBe(true);
    expect(candidateStatus({ ...base, run: run({ stalled: true }) })).toEqual({ label: "Stalled, start again", tone: "unsure", researching: false });
    expect(candidateStatus({ ...base, status: "incomplete" }).label).toBe("Incomplete");
  });
});

describe("channelsFor", () => {
  const tag = { tag: "cmo", role: "CMO", goal: "hiring" as const, company: null, startupjobs_offer_id: null, created_at: "x", position_id: "p1" };
  it("lists the four channels", () => {
    expect(channelsFor(tag, "https://oldboys.asajj.cz")).toEqual([
      { label: "Email", value: "jobs+cmo@asajj.cz" },
      { label: "Apply page", value: "https://oldboys.asajj.cz/apply/cmo" },
      { label: "Google Form hidden field tag", value: "cmo" },
      { label: "StartupJobs offer", value: "not mapped" },
    ]);
  });
  it("shows a mapped offer id", () => {
    expect(channelsFor({ ...tag, startupjobs_offer_id: "77" }, "").at(-1)?.value).toBe("77");
  });
});

describe("defaultTag and enrichSummary", () => {
  it("kebabs and caps the title", () => {
    expect(defaultTag("Senior Data Engineer 1a2b")).toBe("senior-data-engineer-1a2b");
    expect(defaultTag("x".repeat(60)).length).toBe(40);
  });
  it("summarises started and skipped", () => {
    expect(enrichSummary({ started: [{ applicationId: "a", runId: "r" }], skipped: [] })).toBe("Started 1 run");
    expect(enrichSummary({ started: [], skipped: [{ applicationId: "a", reason: "already started" }, { applicationId: "b", reason: "already started" }] }))
      .toBe("Started 0 runs. Skipped 2: already started");
  });
  it("lists the runs already-started rows have, once each", () => {
    const skipped = [{ applicationId: "a", reason: "already started", runId: "r1" }, { applicationId: "b", reason: "already started", runId: "r1" }, { applicationId: "c", reason: "not ready" }];
    expect(existingRuns({ started: [], skipped })).toEqual(["r1"]);
    expect(existingRuns({ started: [], skipped: [] })).toEqual([]);
  });
});
