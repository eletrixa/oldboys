/**
 * Round-trip and invariant tests for the domain schemas.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/claim.test.ts
 * Deps:    vitest, zod
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Every aggregate parses its own canonical example back to an equal value
 * - FACT or STATEMENT without a quote is rejected; INFERENCE without a quote is fine
 *
 * Design constraints:
 * - Fixtures stay inline; no shared fixture module until a second test needs one
 */
import { describe, expect, it } from "vitest";
import { Brief, Candidate, Claim, Gap, Investigation, LedgerEntry, Source } from "@/domain/claim";

const investigation: Investigation = {
  id: "run-1",
  subject: "Jane Doe",
  anchor: "Prague",
  goal: "hiring",
  status: "queued",
  budget_usd: 0.5,
  budget_calls: 12,
  budget_ms: 180000,
  created_at: "2026-10-08T00:00:00.000Z",
  role: "Senior Data Engineer, Prague, hybrid",
  questions: [{ id: "mh-1", text: "Has shipped a production data pipeline" }],
};

const candidate: Candidate = {
  id: "cand-1",
  run_id: "run-1",
  name: "Jane Doe",
  profile_urls: ["https://www.linkedin.com/in/janedoe"],
  anchor_match: "city",
  score: 0.91,
  decision: "merge",
  platform: "linkedin",
  handle: "janedoe",
  snippet: "Staff engineer at Acme, Prague",
  reasons: ["city matches anchor", "bio links to acme.com"],
};

const source: Source = {
  id: "src-1",
  run_id: "run-1",
  url: "https://www.linkedin.com/in/janedoe",
  actor: "apify/linkedin-profile-scraper",
  fetched_at: "2026-10-08T00:01:00.000Z",
  excerpt: "Jane Doe is a staff engineer at Acme in Prague.",
  r2_key: "run-1/src-1.json",
  expires_at: "2026-10-12T00:00:00.000Z",
  identity: "merged",
};

const fact: Claim = {
  id: "claim-1",
  run_id: "run-1",
  question_id: "current-role",
  candidate_id: null,
  text: "Jane Doe is a staff engineer at Acme.",
  kind: "FACT",
  confidence: 0.9,
  quote: "Jane Doe is a staff engineer at Acme",
  supports: ["src-1"],
  contradicts: [],
  rank: 1,
};

const gap: Gap = { run_id: "run-1", question_id: "public-talks", reason: "no source returned items" };

const entry: LedgerEntry = {
  run_id: "run-1",
  seq: 1,
  ts: "2026-10-08T00:00:01.000Z",
  step: "serp_person",
  kind: "call",
  cost_usd: 0.01,
  ms: 1200,
  ref: { actor: "apify/google-search-scraper", items: 10 },
};

describe("domain schemas round-trip", () => {
  it.each([
    ["Investigation", Investigation, investigation],
    ["Candidate", Candidate, candidate],
    ["Source", Source, source],
    ["Claim", Claim, fact],
    ["Gap", Gap, gap],
    ["LedgerEntry", LedgerEntry, entry],
  ] as const)("%s parses its canonical example unchanged", (_name, schema, value) => {
    expect(schema.parse(value)).toEqual(value);
  });
});

describe("Source identity", () => {
  it("is required and limited to merged | unverified", () => {
    const { identity: _omit, ...missing } = source;
    expect(Source.safeParse(missing).success).toBe(false);
    expect(Source.safeParse({ ...source, identity: "maybe" }).success).toBe(false);
    expect(Source.parse({ ...source, identity: "unverified" }).identity).toBe("unverified");
  });
});

describe("Claim invariants", () => {
  it("rejects a FACT without a quote", () => {
    const result = Claim.safeParse({ ...fact, quote: null });
    expect(result.success).toBe(false);
  });

  it("rejects a FACT with a whitespace-only quote", () => {
    expect(Claim.safeParse({ ...fact, quote: "   " }).success).toBe(false);
  });

  it("rejects a FACT with no supporting source", () => {
    expect(Claim.safeParse({ ...fact, supports: [] }).success).toBe(false);
  });

  it("accepts an INFERENCE without a quote", () => {
    const inference = { ...fact, id: "claim-2", kind: "INFERENCE", quote: null, supports: [] };
    expect(Claim.safeParse(inference).success).toBe(true);
  });

  it("holds STATEMENT to the same quote and support rule as FACT", () => {
    const statement = { ...fact, id: "claim-3", kind: "STATEMENT" };
    expect(Claim.safeParse(statement).success).toBe(true);
    expect(Claim.safeParse({ ...statement, quote: null }).success).toBe(false);
    expect(Claim.safeParse({ ...statement, supports: [] }).success).toBe(false);
  });

  it("rejects an unknown kind and an out-of-range confidence", () => {
    expect(Claim.safeParse({ ...fact, kind: "GUESS" }).success).toBe(false);
    expect(Claim.safeParse({ ...fact, confidence: 1.5 }).success).toBe(false);
  });
});

describe("Brief degraded + evidence", () => {
  const base = { run_id: "r", per_question: [], interview_questions: [], to_verify: [], not_searched: [], removed_protected: 0 };
  it("defaults degraded and evidence for briefs stored before the fields existed", () => {
    const b = Brief.parse(base);
    expect(b.degraded).toBeNull();
    expect(b.evidence).toEqual([]);
    expect(b.searched_empty).toEqual([]);
  });
  it("caps evidence excerpts at 300 chars", () => {
    expect(Brief.safeParse({ ...base, degraded: "x", evidence: [{ step: "s", url: "u", excerpt: "a".repeat(301) }] }).success).toBe(false);
  });
});
