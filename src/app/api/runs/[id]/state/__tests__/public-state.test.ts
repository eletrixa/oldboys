/**
 * Tests for publicState: what the open run state may expose of claims, quote contexts, brief reasons and failure.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/state/__tests__/public-state.test.ts
 * Deps:    vitest, src/app/api/runs/[id]/state/public-state, src/app/runs/[id]/state (gapText)
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - An Art. 9 claim never reaches claims or quote_contexts, even when the brief lists it
 * - A claim the brief does not show (e.g. one citing only a namesake's page) is not returned; no brief = no claims
 * - Contexts only for kept claims and confirmed (merged) sources
 * - Gap reasons and the failure are scrubbed; gapText still turns them into plain words
 *
 * Design constraints:
 * - Pure function under test, no fakes
 */
import { describe, expect, it } from "vitest";
import type { Brief, Claim } from "@/domain/claim";
import { gapText } from "@/app/runs/[id]/state";
import { publicBrief, publicState } from "../public-state";

const OPENALEX = "request failed: https://api.openalex.org/authors?search=Jan%20Novak&per-page=5&mailto=robert@soulfire.cz: HTTP 429";
const HEALTH = "Jan took a long medical leave after a health condition";
const NAMESAKE_PAGE = "Jan Novak, the pastry chef from Brno, wins the regional cake award.";

const claim = (over: Partial<Claim> & { id: string }): Claim => ({
  run_id: "r1", question_id: "mh-1", candidate_id: null, text: "Data engineer at Acme", kind: "FACT", confidence: 0.9,
  quote: "data engineer", supports: ["s-merged"], contradicts: [], rank: 0, ...over,
});

const claims: Claim[] = [
  claim({ id: "c-shown" }),
  claim({ id: "c-art9", text: HEALTH, quote: "health condition", supports: ["s-health"] }),
  claim({ id: "c-namesake", text: "Won a regional cake award", quote: "wins the regional cake award", supports: ["s-namesake"] }),
  claim({ id: "c-mixed", text: "Works on data pipelines", quote: "data engineer", supports: ["s-merged", "s-namesake2"] }),
];

const sources = [
  { id: "s-merged", identity: "merged", excerpt: "Works at Acme as a data engineer since 2019." },
  { id: "s-health", identity: "merged", excerpt: `${HEALTH} in 2024.` },
  { id: "s-namesake", identity: "unverified", excerpt: NAMESAKE_PAGE },
  { id: "s-namesake2", identity: "unverified", excerpt: "Another Jan Novak, data engineer at a bakery chain." },
];

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r1",
  per_question: [{ question_id: "mh-1", coverage: "evidenced", claim_ids: ["c-shown", "c-art9"], summary: "Data engineer." }],
  interview_questions: [],
  to_verify: [],
  not_searched: [{ source: "openalex_works", reason: OPENALEX }],
  searched_empty: [{ source: "github_profile", reason: "no public GitHub profile found" }],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
  headline: null,
  location_note: null,
  sections: [{ id: "experience", title: "Experience", confidence: 0.8, confidence_reason: "", claim_ids: ["c-mixed"], source_ids: [], summary: "" }],
  ...over,
});

describe("publicState", () => {
  const out = publicState({ claims, sources, brief: brief(), failure: OPENALEX });
  const json = JSON.stringify(out);

  it("never returns an Art. 9 claim or its context, even when the brief lists it", () => {
    expect(out.claims.map((c) => c.id)).not.toContain("c-art9");
    expect(json).not.toContain("health condition");
    expect(json).not.toContain("medical leave");
  });

  it("drops a claim the brief does not show, so a namesake's page never leaves", () => {
    expect(out.claims.map((c) => c.id)).toEqual(["c-shown", "c-mixed"]);
    expect(json).not.toContain("cake");
    expect(json).not.toContain("pastry chef");
  });

  it("keeps a brief-referenced claim with its context, from confirmed sources only", () => {
    expect(out.quote_contexts).toEqual([
      { claim_id: "c-shown", source_id: "s-merged", before: "Works at Acme as a ", match: "data engineer", after: " since 2019." },
      { claim_id: "c-mixed", source_id: "s-merged", before: "Works at Acme as a ", match: "data engineer", after: " since 2019." },
    ]);
    expect(json).not.toContain("bakery");
  });

  it("scrubs gap reasons and the failure, and gapText still reads them in plain words", () => {
    const reason = out.brief?.not_searched[0]?.reason;
    expect(reason).toBe("request failed: api.openalex.org: HTTP 429");
    expect(out.failure).toBe("request failed: api.openalex.org: HTTP 429");
    for (const leak of ["mailto", "@", "search=", "Novak"]) expect(json).not.toContain(leak);
    expect(gapText(reason ?? "")).toBe("the service refused our request (HTTP 429)");
    expect(out.brief?.searched_empty).toEqual([{ source: "github_profile", reason: "no public GitHub profile found" }]);
  });

  it("leaves the rest of the brief as stored", () => {
    const { not_searched: _a, searched_empty: _b, ...rest } = brief();
    const { not_searched: _c, searched_empty: _d, ...kept } = out.brief ?? brief({ run_id: "missing" });
    expect(kept).toEqual(rest);
  });

  it("returns no claims and no contexts before the brief exists", () => {
    const early = publicState({ claims, sources, brief: null, failure: null });
    expect(early).toEqual({ claims: [], quote_contexts: [], brief: null, failure: null });
  });

  it("uses per-question claim ids for an older brief without sections", () => {
    const { sections: _s, ...old } = brief();
    const early = publicState({ claims, sources, brief: { ...old, sections: [] }, failure: null });
    expect(early.claims.map((c) => c.id)).toEqual(["c-shown"]);
  });
});

describe("publicBrief", () => {
  it("keeps searched_empty absent on an older brief that never had it", () => {
    const stored = brief();
    Reflect.deleteProperty(stored, "searched_empty");
    expect(publicBrief(stored)).not.toHaveProperty("searched_empty");
  });
});
