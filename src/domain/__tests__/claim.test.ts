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
 * - FACT without a quote is rejected; INFERENCE without a quote is fine
 *
 * Design constraints:
 * - Fixtures stay inline; no shared fixture module until a second test needs one
 */
import { describe, expect, it } from "vitest";
import { Candidate, Claim, Gap, Investigation, LedgerEntry, Source } from "@/domain/claim";

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
};

const candidate: Candidate = {
  id: "cand-1",
  run_id: "run-1",
  name: "Jane Doe",
  profile_urls: ["https://www.linkedin.com/in/janedoe"],
  anchor_match: "city",
  score: 0.91,
  decision: "merge",
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

  it("rejects an unknown kind and an out-of-range confidence", () => {
    expect(Claim.safeParse({ ...fact, kind: "GUESS" }).success).toBe(false);
    expect(Claim.safeParse({ ...fact, confidence: 1.5 }).success).toBe(false);
  });
});
