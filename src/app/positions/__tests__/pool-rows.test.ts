/**
 * Tests for the pool row shaping and intake channel helpers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/__tests__/pool-rows.test.ts
 * Deps:    vitest, ../pool-rows
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Selectable only for pooled rows with a profile or CV; labels; channels; tag suggestion; summary line
 *
 * Design constraints:
 * - No score or rank field exists on a shaped row
 */
import { describe, expect, it } from "vitest";
import type { PoolRow } from "@/app/api/positions/handler";
import { channelsFor, defaultTag, enrichSummary, shapePool } from "../pool-rows";

const base: PoolRow = {
  id: "a1", source: "manual", name: "Ada", email: null, status: "pooled", run_id: null, note: null,
  received_at: "2026-10-09T14:05:00.000Z", has_profile: 1, has_cv: 0,
};

describe("shapePool", () => {
  it("labels a pooled row with a profile as selectable", () => {
    const [v] = shapePool([base]);
    expect(v).toMatchObject({ name: "Ada", source: "Added by hand", status: "In pool", presence: "LinkedIn", selectable: true, runHref: null });
  });

  it("shows both artefacts and an Unnamed fallback", () => {
    const [v] = shapePool([{ ...base, name: null, has_cv: 1 }]);
    expect(v?.name).toBe("Unnamed");
    expect(v?.presence).toBe("LinkedIn · CV");
  });

  it("is not selectable without a profile or CV, or once started", () => {
    const rows = shapePool([
      { ...base, id: "b", has_profile: 0 },
      { ...base, id: "c", status: "run-started", run_id: "r1" },
      { ...base, id: "d", has_cv: 1 },
    ]);
    expect(rows.map((r) => r.selectable)).toEqual([false, false, true]);
    expect(rows[1]?.runHref).toBe("/runs/r1");
    expect(rows[0]?.presence).toBe("—");
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
});
