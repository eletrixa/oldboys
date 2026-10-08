/**
 * Tests for the "Copy for ATS" note: line order, confirmed profiles only, role fallback, footer date, plain text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/ats-note.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - atsNote: null without a brief; summary lines equal summary30s; brief URL; deletion date in the footer
 * - Merged candidates only (never possibly-same-as, rejected or also_found), deduplicated, capped, http(s) only
 * - No Markdown and no verdict words; degraded wording passes through
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate } from "@/domain/claim";
import type { RunState } from "../state";
import { atsNote } from "../ats-note";
import { summary30s } from "../summary";

const BRIEF_URL = "https://oldboys.example/runs/0123456789abcdef";

const cand = (platform: string, decision: Candidate["decision"], url: string, id = `${platform}-${decision}`): Candidate => ({
  id, run_id: "r", name: "Jan Novak", profile_urls: [url], anchor_match: null, score: 0.8, decision, platform, handle: null, snippet: "", reasons: [],
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [
    { question_id: "mh-sql", coverage: "evidenced", claim_ids: ["c1"], summary: "SQL in two projects." },
    { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "" },
  ],
  interview_questions: ["Walk me through the pipeline you built at Acme?"],
  to_verify: ["Dates at Acme"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [],
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
    cand("github", "merge", "https://github.com/jnovak"),
    cand("linkedin", "merge", "https://www.linkedin.com/in/jnovak"),
    cand("tiktok", "possibly-same-as", "https://www.tiktok.com/@jn"),
    cand("youtube", "rejected", "https://www.youtube.com/@jn"),
  ],
  claims: [],
  sources: [],
  questions: [
    { id: "mh-sql", text: "Writes production SQL" },
    { id: "mh-lead", text: "Has led a team of at least three engineers" },
  ],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
  ...over,
});

const lines = (note: string | null): string[] => (note ?? "").split("\n");

describe("atsNote", () => {
  it("returns null while there is no brief", () => {
    expect(atsNote(run({ brief: null }), BRIEF_URL)).toBeNull();
  });

  it("full note: line order, summary lines from summary30s, brief URL, footer with the deletion date", () => {
    const state = run();
    const s = summary30s(state);
    expect(lines(atsNote(state, BRIEF_URL))).toEqual([
      "Research brief: Jan Novak for Senior Data Engineer",
      s?.documented,
      s?.missing,
      s?.ask,
      "Confirmed profiles: https://www.linkedin.com/in/jnovak, https://github.com/jnovak",
      `Full brief with sources: ${BRIEF_URL}`,
      "This note rates the research, not the candidate. Run data is deleted after 2026-10-15.",
    ]);
  });

  it("confirmed profiles: merged only, deduplicated, capped at 5, http(s) only", () => {
    const merged = [
      cand("linkedin", "merge", "https://www.linkedin.com/in/jnovak", "a"),
      cand("linkedin", "merge", "https://www.linkedin.com/in/jnovak", "b"),
      cand("web", "merge", "javascript:alert(1)", "c"),
      cand("web", "merge", "not a url", "d"),
      cand("web", "merge", "https://a.example/1", "e"),
      cand("web", "merge", "https://a.example/2", "f"),
      cand("web", "merge", "https://a.example/3", "g"),
      cand("web", "merge", "https://a.example/4", "h"),
      cand("web", "merge", "https://a.example/5", "i"),
      cand("tiktok", "possibly-same-as", "https://www.tiktok.com/@jn"),
      cand("youtube", "rejected", "https://www.youtube.com/@jn"),
    ];
    const note = atsNote(run({ candidates: merged }), BRIEF_URL) ?? "";
    const line = lines(note).find((l) => l.startsWith("Confirmed profiles: ")) ?? "";
    const urls = line.replace("Confirmed profiles: ", "").split(", ");
    expect(urls).toHaveLength(5);
    expect(urls[0]).toBe("https://www.linkedin.com/in/jnovak");
    expect(new Set(urls).size).toBe(5);
    for (const banned of ["tiktok.com", "youtube.com", "instagram.com/someone", "javascript:", "not a url"]) expect(note).not.toContain(banned);
  });

  it("no Confirmed profiles line when nothing is merged", () => {
    const note = atsNote(run({ candidates: [cand("tiktok", "possibly-same-as", "https://www.tiktok.com/@jn")] }), BRIEF_URL);
    expect(note).not.toContain("Confirmed profiles");
    expect(note).not.toContain("tiktok.com");
  });

  it("role null or blank: (no role entered)", () => {
    expect(lines(atsNote(run({ role: null }), BRIEF_URL))[0]).toBe("Research brief: Jan Novak (no role entered)");
    expect(lines(atsNote(run({ role: "   " }), BRIEF_URL))[0]).toBe("Research brief: Jan Novak (no role entered)");
  });

  it("unreadable created_at: footer without the date sentence", () => {
    const note = atsNote(run({ created_at: "garbage" }), BRIEF_URL) ?? "";
    expect(lines(note).at(-1)).toBe("This note rates the research, not the candidate.");
    expect(note).not.toContain("Invalid Date");
    expect(note).not.toContain("deleted after");
  });

  it("plain text: no Markdown line starts, no link syntax, no verdict words", () => {
    const note = atsNote(run(), BRIEF_URL) ?? "";
    for (const l of lines(note)) expect(/^\s*[#\-*>]/.test(l)).toBe(false);
    expect(note).not.toContain("](");
    expect(/good fit|strong|recommend|score|weak|personality/i.test(note)).toBe(false);
  });

  it("degraded brief: the AI-off wording from summary30s passes through", () => {
    const state = run({ brief: brief({ degraded: "AI unavailable" }) });
    const note = atsNote(state, BRIEF_URL) ?? "";
    expect(note).toContain("role criteria were not checked because AI was off");
    expect(lines(note)[1]).toBe(summary30s(state)?.documented);
  });
});
