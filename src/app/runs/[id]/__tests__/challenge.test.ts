/**
 * Devil's advocate in the report (idea #8): state mapping for old and new runs, labels, "To verify" reasons, the
 * summary line, the evidence lookup and the interview kit lines.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/challenge.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 */
import { describe, expect, it } from "vitest";
import type { Challenge } from "@/domain/challenge";
import type { Brief, Claim } from "@/domain/claim";
import { challengeLine, challengeReason, challengeState, challengeTag, toVerifyItems } from "../challenge";
import { evidenceOf } from "../evidence";
import { interviewKit } from "../interview-kit";
import { parseFilledKit } from "../kit-review";
import type { RunState } from "../state";

const claim = (id: string, text: string, kind: Claim["kind"] = "INFERENCE"): Claim => ({
  id, run_id: "r", question_id: "mh-code", candidate_id: null, text, kind, confidence: 0.5, quote: "react", supports: ["s1"], contradicts: [], rank: 0,
});
const fork: Challenge = { claim_id: "c1", ground: "fork-or-copy", why: "The cited repository is marked as a fork." };

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [{ question_id: "mh-code", coverage: "partial", claim_ids: ["c1", "c2"], summary: "" }],
  interview_questions: [],
  to_verify: ["Maintains a React library", "Dates at Acme"],
  not_searched: [],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
  headline: null,
  location_note: null,
  sections: [],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "0123456789abcdef",
  subject: "Jan Novak",
  headline: null,
  role: "Frontend Engineer",
  organization_name: null,
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [],
  claims: [claim("c1", "Maintains a React library"), claim("c2", "Dates at Acme")],
  sources: [{ id: "s1", url: "https://github.com/jnovak/react" }],
  questions: [{ id: "mh-code", text: "Public frontend code" }],
  brief: brief(),
  failure: null,
  intake: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0.2, source_calls: 3, llm_calls: 5, duration_ms: 100_000 },
  challenges: [fork],
  challenge_summary: { checked: 4, held: 3, moved: 1 },
  ...over,
});

describe("challengeState", () => {
  it("is empty for runs before the devil's advocate", () => {
    expect(challengeState(null, new Set(["c1"]))).toEqual({ challenges: [], challenge_summary: null });
  });
  it("keeps only challenges of claims the run still has; moved counts the record", () => {
    const record = { checked: 5, held: 3, challenges: [fork, { ...fork, claim_id: "gone" }] };
    expect(challengeState(record, new Set(["c1"]))).toEqual({ challenges: [fork], challenge_summary: { checked: 5, held: 3, moved: 2 } });
  });
});

describe("labels", () => {
  it("speaks plain HR words per ground", () => {
    expect(challengeTag("fork-or-copy")).toBe("Challenged: may be a fork, not own work — ask at the interview");
    expect(challengeTag("someone-else")).toBe("Challenged: may be about someone else — ask at the interview");
    expect(challengeTag("tutorial-or-course")).toBe("Challenged: may be a tutorial or course exercise — ask at the interview");
    expect(challengeTag("outdated")).toBe("Challenged: evidence may be outdated — ask at the interview");
    expect(challengeReason(fork)).toBe("Challenged: may be a fork, not own work (The cited repository is marked as a fork)");
    expect(challengeReason({ ground: "outdated", why: " " })).toBe("Challenged: evidence may be outdated");
  });
  it("summarises the check, or nothing when nothing was checked", () => {
    expect(challengeLine({ checked: 4, held: 3, moved: 1 })).toBe("Devil's advocate: checked 4 findings, 3 held, 1 moved to the interview");
    expect(challengeLine({ checked: 1, held: 1, moved: 0 })).toBe("Devil's advocate: checked 1 finding, 1 held, 0 moved to the interview");
    expect(challengeLine({ checked: 0, held: 0, moved: 0 })).toBeNull();
    expect(challengeLine(null)).toBeNull();
    expect(challengeLine(undefined)).toBeNull();
  });
});

describe("toVerifyItems", () => {
  const byId = new Map([["c1", fork]]);
  it("adds the reason to a challenged item and none to the rest", () => {
    expect(toVerifyItems(brief(), run().claims, byId)).toEqual([
      { text: "Maintains a React library", reason: challengeReason(fork) },
      { text: "Dates at Acme", reason: null },
    ]);
  });
  it("appends a challenged claim the brief's cap cut off, but never one the brief does not show", () => {
    const hidden = { ...fork, claim_id: "c3" };
    const claims = [...run().claims, claim("c3", "Removed by the protected-category filter")];
    const items = toVerifyItems(brief({ to_verify: ["Dates at Acme"] }), claims, new Map([["c1", fork], ["c3", hidden]]));
    expect(items).toEqual([
      { text: "Dates at Acme", reason: null },
      { text: "Maintains a React library", reason: challengeReason(fork) },
    ]);
  });
  it("leaves an old run's list as it was", () => {
    expect(toVerifyItems(brief(), run().claims, new Map())).toEqual([
      { text: "Maintains a React library", reason: null },
      { text: "Dates at Acme", reason: null },
    ]);
  });
});

describe("evidenceOf", () => {
  it("maps challenges by claim id; empty for old runs", () => {
    expect(evidenceOf(run()).challengeOf.get("c1")).toEqual(fork);
    expect(evidenceOf({ sources: [] }).challengeOf.size).toBe(0);
  });
});

describe("interview kit", () => {
  it("lists the reason under the challenged claim and to-verify item, then the devil's advocate line", () => {
    const md = interviewKit(run(), "2026-10-09T00:00:00.000Z") ?? "";
    expect(md).toContain("- INFERENCE: Maintains a React library (<https://github.com/jnovak/react>)\n  - Challenged: may be a fork, not own work (The cited repository is marked as a fork)");
    expect(md).toContain("- [ ] Maintains a React library\n  - Challenged: may be a fork, not own work (The cited repository is marked as a fork)\n- [ ] Dates at Acme");
    expect(md).toContain("_Devil's advocate: checked 4 findings, 3 held, 1 moved to the interview_");
  });
  it("still reads back as two checks after the interview", () => {
    const md = interviewKit(run(), "2026-10-09T00:00:00.000Z") ?? "";
    expect(parseFilledKit(md).checks.map((c) => c.text)).toEqual(["Maintains a React library", "Dates at Acme"]);
  });
  it("is unchanged for an old run without challenges", () => {
    const md = interviewKit(run({ challenges: undefined, challenge_summary: undefined }), "2026-10-09T00:00:00.000Z") ?? "";
    expect(md).not.toContain("Challenged");
    expect(md).not.toContain("Devil's advocate");
  });
});
