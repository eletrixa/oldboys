/**
 * Tests for the brief texts the Czech report translates (idea #24): what goes in, what never does, and stable ids.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/report-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Shown section texts, shown claims, challenge and confirmation reasons, interview questions, to-verify items,
 *   gap reasons (plain words) and the 30-second summary bodies are collected with stable ids
 * - Quotes, URLs, the headline, the person's name, the role, evidence and also_found excerpts never are
 * - The hash changes when a claim text changes; splitLead separates the lead word
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import type { Brief, Claim } from "@/domain/claim";
import { textsHash } from "@/domain/report-translation";
import { reportTexts, splitLead, tid } from "../report-text";
import type { RunState } from "../state";

const QUOTE = "I maintain acme-ui since 2021";

const claim = (id: string, text: string, over: Partial<Claim> = {}): Claim => ({
  id, run_id: "r", question_id: "mh-ui", candidate_id: null, text, kind: "FACT", confidence: 0.9, quote: QUOTE, supports: ["s1"], contradicts: [], rank: 0, ...over,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  profile: null,
  per_question: [{ question_id: "mh-ui", coverage: "evidenced", claim_ids: ["c1"], summary: "Builds UI libraries." }],
  interview_questions: ["How do you version acme-ui?"],
  to_verify: ["Start date at Acme"],
  not_searched: [{ source: "x_profile", reason: "request failed: https://api.x.com/2/users HTTP 403 {\"title\":\"Forbidden\"}" }],
  searched_empty: [{ source: "github_profile", reason: "no public repositories" }],
  removed_protected: 0,
  degraded: null,
  evidence: [{ step: "rest/github", url: "https://github.com/jnovak", excerpt: "jnovak: 12 repositories" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://example.com/other", excerpt: "Another Jan Novak" }],
  headline: "Senior Frontend Engineer at Acme",
  location_note: "Confirmed profile mentions Brno, you entered Praha",
  sections: [
    { id: "mh-ui", title: "UI libraries", confidence: 0.8, confidence_reason: "Two independent sources.", claim_ids: ["c1"], source_ids: ["s1"], summary: "Maintains a UI library." },
    { id: "contradictions", title: "Contradictions", confidence: 0.2, confidence_reason: "None found.", claim_ids: [], source_ids: [], summary: "" },
  ],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "r",
  subject: "Jan Novak",
  headline: null,
  role: "Frontend Engineer",
  position: null,
  organization_name: null,
  created_at: "2026-10-09T00:00:00.000Z",
  status: "done",
  step: null,
  mentions: 1,
  candidates: [],
  claims: [claim("c1", "Maintains the open-source library acme-ui."), claim("c-hidden", "Not in any shown section.")],
  sources: [{ id: "s1", url: "https://github.com/jnovak/acme-ui", identity_reason: "name and employer match (Acme)" }],
  challenges: [{ claim_id: "c1", ground: "fork-or-copy", why: "The repository is marked as a fork." }],
  questions: [{ id: "mh-ui", text: "Builds UI component libraries" }],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 1,
  step_count: 1,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
  intake: null,
  ...over,
});

const byId = (texts: { id: string; text: string }[]): Map<string, string> => new Map(texts.map((t) => [t.id, t.text]));

describe("reportTexts", () => {
  it("collects the brief's own texts with stable ids", () => {
    const texts = byId(reportTexts(run()));
    expect(texts.get(tid.sectionTitle("mh-ui"))).toBe("UI libraries");
    expect(texts.get(tid.sectionReason("mh-ui"))).toBe("Two independent sources.");
    expect(texts.get(tid.sectionSummary("mh-ui"))).toBe("Maintains a UI library.");
    expect(texts.get(tid.claim("c1"))).toBe("Maintains the open-source library acme-ui.");
    expect(texts.get(tid.challenge("c1"))).toBe("The repository is marked as a fork.");
    expect(texts.get(tid.sourceReason("s1"))).toBe("name and employer match (Acme)");
    expect(texts.get(tid.interviewQuestion(0))).toBe("How do you version acme-ui?");
    expect(texts.get(tid.toVerify(0))).toBe("Start date at Acme");
    expect(texts.get(tid.searchedEmpty(0))).toBe("no public repositories");
    expect(texts.get(tid.notSearched(0))).toBe("the service refused our request (HTTP 403)");
    expect(texts.get(tid.locationNote)).toBe("Confirmed profile mentions Brno, you entered Praha");
    expect(texts.get(tid.summary("ask"))).toBe("How do you version acme-ui?");
  });

  it("never includes quotes, URLs, the headline, names, the role or source excerpts", () => {
    const all = JSON.stringify(reportTexts(run()));
    for (const banned of [QUOTE, "https://", "Senior Frontend Engineer at Acme", "Jan Novak", "jnovak: 12 repositories", "Another Jan Novak"]) {
      expect(all).not.toContain(banned);
    }
    expect(all).not.toMatch(/"Frontend Engineer"/);
  });

  it("leaves out hidden sections, claims no shown section lists, and per-question rows when sections exist", () => {
    const texts = byId(reportTexts(run()));
    expect(texts.has(tid.sectionTitle("contradictions"))).toBe(false);
    expect(texts.has(tid.claim("c-hidden"))).toBe(false);
    expect(texts.has(tid.questionSummary("mh-ui"))).toBe(false);
  });

  it("uses per-question rows for a brief stored before sections", () => {
    const texts = byId(reportTexts(run({ brief: brief({ sections: [] }) })));
    expect(texts.get(tid.questionSummary("mh-ui"))).toBe("Builds UI libraries.");
    expect(texts.get(tid.question("mh-ui"))).toBe("Builds UI component libraries");
    expect(texts.get(tid.claim("c1"))).toBe("Maintains the open-source library acme-ui.");
  });

  it("is empty without a brief, and ids are unique", () => {
    expect(reportTexts(run({ brief: null }))).toEqual([]);
    const ids = reportTexts(run()).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("changes the hash when a claim text changes", async () => {
    const a = await textsHash(reportTexts(run()));
    const b = await textsHash(reportTexts(run({ claims: [claim("c1", "Maintains acme-ui and acme-icons.")] })));
    expect(a).not.toBe(b);
    expect(await textsHash(reportTexts(run()))).toBe(a);
  });
});

describe("splitLead", () => {
  it("separates a known lead word and keeps other sentences whole", () => {
    expect(splitLead("Ask: How did you test it?")).toEqual({ lead: "Ask", body: "How did you test it?" });
    expect(splitLead("Check: Dates at Acme.")).toEqual({ lead: "Check", body: "Dates at Acme." });
    expect(splitLead("No profile confirmed yet.")).toEqual({ lead: null, body: "No profile confirmed yet." });
  });
});
