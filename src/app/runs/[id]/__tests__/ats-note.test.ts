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
 * - Czech Report (idea #24): Czech fixed strings and date, translated summary bodies (English fallback), role untranslated;
 *   the default and the English Report give the same English note
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate } from "@/domain/claim";
import type { RunState } from "../state";
import { atsNote } from "../ats-note";
import { ENGLISH_REPORT, makeReport } from "../i18n";
import { tid } from "../report-text";
import { summary30s } from "../summary";

const BRIEF_URL = "https://oldboys.example/runs/0123456789abcdef";

const cand = (platform: string, decision: Candidate["decision"], url: string, id = `${platform}-${decision}`): Candidate => ({
  id, run_id: "r", name: "Jan Novak", profile_urls: [url], anchor_match: null, score: 0.8, decision, platform, handle: null, snippet: "", reasons: [],
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  profile: null,
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
  organization_name: null,
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
  intake: null,
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

  it("English unchanged: the default and the English Report give the same note", () => {
    for (const state of [run(), run({ role: null }), run({ brief: brief({ degraded: "AI unavailable" }) })]) {
      expect(atsNote(state, BRIEF_URL, ENGLISH_REPORT)).toBe(atsNote(state, BRIEF_URL));
      expect(atsNote(state, BRIEF_URL, makeReport("en", { [tid.summary("ask")]: "Ignored" }))).toBe(atsNote(state, BRIEF_URL));
    }
  });
});

describe("atsNote in Czech", () => {
  const texts = {
    [tid.summary("documented")]: "LinkedIn a GitHub profily; doklady má 1 ze 2 kritérií pozice.",
    [tid.summary("missing")]: "žádný doklad pro „Vedl tým aspoň tří inženýrů“; X nebylo prohledáno.",
    [tid.summary("ask")]: "Můžete popsat pipeline, kterou jste v Acme postavili?",
  };
  const cs = makeReport("cs", texts);

  it("full note: Czech header with the role as typed, translated summary bodies with Czech leads, Czech footer and date", () => {
    expect(lines(atsNote(run(), BRIEF_URL, cs))).toEqual([
      "Podklady z průzkumu: Jan Novak, pozice Senior Data Engineer",
      "Potvrzeno: LinkedIn a GitHub profily; doklady má 1 ze 2 kritérií pozice.",
      "Chybí: žádný doklad pro „Vedl tým aspoň tří inženýrů“; X nebylo prohledáno.",
      "Zeptejte se: Můžete popsat pipeline, kterou jste v Acme postavili?",
      "Potvrzené profily: https://www.linkedin.com/in/jnovak, https://github.com/jnovak",
      `Celý brief se zdroji: ${BRIEF_URL}`,
      "Tato poznámka hodnotí průzkum, ne kandidáta. Data z průzkumu smažeme po 15. 10. 2026.",
    ]);
  });

  it("no role: header without the position; no subject: a Czech placeholder", () => {
    expect(lines(atsNote(run({ role: null }), BRIEF_URL, cs))[0]).toBe("Podklady z průzkumu: Jan Novak");
    expect(lines(atsNote(run({ role: "  " }), BRIEF_URL, cs))[0]).toBe("Podklady z průzkumu: Jan Novak");
    expect(lines(atsNote(run({ subject: " ", role: null }), BRIEF_URL, cs))[0]).toBe("Podklady z průzkumu: jméno neuvedeno");
  });

  it("missing translations: the English body stays after the Czech lead word", () => {
    const state = run();
    const s = summary30s(state);
    const out = lines(atsNote(state, BRIEF_URL, makeReport("cs", {})));
    expect(out[1]).toBe(`Potvrzeno: ${s?.documented.replace(/^Confirmed: /, "") ?? ""}`);
    expect(out[2]).toBe(`Chybí: ${s?.missing.replace(/^Missing: /, "") ?? ""}`);
    expect(out[3]).toBe(`Zeptejte se: ${s?.ask.replace(/^Ask: /, "") ?? ""}`);
    expect(lines(atsNote(state, BRIEF_URL, makeReport("cs", null)))).toEqual(out);
  });

  it("a sentence without a lead word is translated whole", () => {
    const state = run({ candidates: [], brief: brief({ evidence: [] }) });
    expect(summary30s(state)?.documented.startsWith("No profile confirmed yet")).toBe(true);
    const out = lines(atsNote(state, BRIEF_URL, makeReport("cs", { [tid.summary("documented")]: "Zatím žádný potvrzený profil." })));
    expect(out[1]).toBe("Zatím žádný potvrzený profil.");
  });

  it("no English fixed string, plain text, unreadable date dropped, namesakes never in", () => {
    const note = atsNote(run(), BRIEF_URL, cs) ?? "";
    for (const en of ["Research brief", "Confirmed profiles", "Full brief with sources", "rates the research", "deleted after", "no role entered"]) {
      expect(note).not.toContain(en);
    }
    for (const l of lines(note)) expect(/^\s*[#\-*>]/.test(l)).toBe(false);
    expect(note).not.toContain("](");
    expect(note).not.toContain("instagram.com/someone");
    expect(note).not.toContain("tiktok.com");
    const undated = atsNote(run({ created_at: "garbage" }), BRIEF_URL, cs) ?? "";
    expect(lines(undated).at(-1)).toBe("Tato poznámka hodnotí průzkum, ne kandidáta.");
    expect(undated).not.toContain("NaN");
  });
});
