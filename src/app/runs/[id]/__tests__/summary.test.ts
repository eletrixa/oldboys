/**
 * Tests for the 30-second summary: full brief, degraded brief, no brief, empty gaps, shortening and guardrails.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/summary.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - summary30s: null without a brief; confirmed platforms and criteria counts; at most two gaps; first question
 * - Degraded brief: confirmed sources only, criteria "not checked because AI was off"
 * - also_found and unconfirmed candidates never reach the summary; no verdict words
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate } from "@/domain/claim";
import type { RunState } from "../state";
import { shorten, summary30s, summaryText } from "../summary";

const cand = (platform: string, decision: Candidate["decision"], url: string): Candidate => ({
  id: `${platform}-${decision}`, run_id: "r", name: "Jan Novak", profile_urls: [url], anchor_match: null, score: 0.8, decision, platform, handle: null, snippet: "", reasons: [],
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [
    { question_id: "mh-sql", coverage: "evidenced", claim_ids: ["c1"], summary: "SQL in two projects." },
    { question_id: "mh-py", coverage: "evidenced", claim_ids: ["c2"], summary: "Python repos." },
    { question_id: "mh-cloud", coverage: "partial", claim_ids: [], summary: "One mention." },
    { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "" },
    { question_id: "base-1", coverage: "none", claim_ids: [], summary: "" },
  ],
  interview_questions: ["Walk me through the pipeline you built at Acme and how you tested it?"],
  to_verify: ["Dates at Acme"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [{ source: "github_profile", reason: "no public repositories" }],
  removed_protected: 0,
  degraded: null,
  evidence: [{ step: "rest/github", url: "https://github.com/jnovak", excerpt: "jnovak: 12 repositories" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://www.instagram.com/someone", excerpt: "Another Jan Novak" }],
  headline: "Senior Data Engineer at Acme",
  location_note: null,
  sections: [],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "0123456789abcdef",
  subject: "Jan Novak",
  headline: null,
  role: "Senior Data Engineer",
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [
    cand("linkedin", "merge", "https://www.linkedin.com/in/jnovak"),
    cand("tiktok", "possibly-same-as", "https://www.tiktok.com/@jn"),
    cand("youtube", "rejected", "https://www.youtube.com/@jn"),
  ],
  claims: [],
  sources: [],
  questions: [
    { id: "mh-sql", text: "Writes production SQL" },
    { id: "mh-py", text: "Python" },
    { id: "mh-cloud", text: "Cloud data platforms" },
    { id: "mh-lead", text: "Has led a team of at least three engineers" },
    { id: "base-1", text: "Public talks" },
  ],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
  ...over,
});

const VERDICT = /good fit|strong|recommend|score|weak|personality/i;

describe("summary30s", () => {
  it("returns null while there is no brief", () => {
    expect(summary30s(run({ brief: null }))).toBeNull();
  });

  it("full brief: confirmed platforms, role criteria counts, two gaps, first question", () => {
    const s = summary30s(run());
    expect(s?.documented).toBe("Confirmed: LinkedIn and GitHub profiles; 2 of 4 role criteria have evidence, 1 partly.");
    expect(s?.missing).toBe('Missing: no evidence for "Has led a team of at least three engineers"; nothing confirmed on GitHub.');
    expect(s?.ask).toBe("Ask: Walk me through the pipeline you built at Acme and how you tested it?");
  });

  it("never uses unconfirmed candidates or also_found hits", () => {
    const s = summary30s(run());
    const text = s === null ? "" : summaryText(s);
    expect(text).not.toMatch(/TikTok|YouTube|Instagram/);
    expect(text).not.toMatch(VERDICT);
  });

  it("degraded brief: counts confirmed sources only and says criteria were not checked", () => {
    const s = summary30s(
      run({
        candidates: [cand("linkedin", "merge", "https://www.linkedin.com/in/jnovak"), cand("web", "merge", "https://jnovak.cz")],
        brief: brief({
          degraded: "no API key",
          per_question: [{ question_id: "mh-sql", coverage: "none", claim_ids: [], summary: "AI summary unavailable" }],
          evidence: [{ step: "rest/github", url: "https://github.com/jnovak", excerpt: "repos" }],
          interview_questions: ["Is the LinkedIn profile 'Data Engineer at Acme' yours?"],
        }),
      }),
    );
    expect(s?.documented).toBe("Confirmed: LinkedIn and GitHub profiles and 1 other source; role criteria were not checked because AI was off.");
    expect(s?.missing).toBe("Missing: nothing confirmed on GitHub; X not searched.");
    expect(s?.ask).toBe("Ask: Is the LinkedIn profile 'Data Engineer at Acme' yours?");
  });

  it("treats all-unavailable summaries as AI off", () => {
    const s = summary30s(run({ brief: brief({ per_question: [{ question_id: "mh-sql", coverage: "none", claim_ids: [], summary: "AI summary unavailable: x" }] }) }));
    expect(s?.documented).toContain("not checked because AI was off");
    expect(s?.missing).not.toContain("no evidence for");
  });

  it("empty gaps and nothing confirmed", () => {
    const s = summary30s(
      run({
        candidates: [],
        brief: brief({ per_question: [], not_searched: [], searched_empty: [], evidence: [], interview_questions: [], to_verify: [] }),
      }),
    );
    expect(s).toEqual({ documented: "No profile confirmed yet.", missing: "Missing: no gaps recorded.", ask: "Ask: no interview question yet." });
  });

  it("falls back to the first to-verify item and to research questions without role criteria", () => {
    const s = summary30s(
      run({
        brief: brief({
          per_question: [{ question_id: "base-1", coverage: "evidenced", claim_ids: [], summary: "Two talks." }],
          interview_questions: [],
          searched_empty: [],
          not_searched: [],
        }),
      }),
    );
    expect(s?.documented).toBe("Confirmed: LinkedIn and GitHub profiles; 1 of 1 research questions have evidence.");
    expect(s?.ask).toBe("Check: Dates at Acme.");
  });
});

describe("shorten", () => {
  it("keeps short text and cuts long text at a word with an ellipsis", () => {
    expect(shorten("Short one.")).toBe("Short one");
    const long = shorten("word ".repeat(40), 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("word…")).toBe(true);
  });
});
