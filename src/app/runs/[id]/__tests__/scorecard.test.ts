/**
 * Tests for the role-fit scorecard composer: fit from the profile or from coverage, signed must-have points, plus and
 * minus lines from every input, notes, and the wording guard.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/scorecard.test.ts
 * Deps:    vitest, src/domain/challenge (JUDGEMENT)
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - null without a brief; null fit and no must-have lines when there are none
 * - Profile run: fit equals fitPct of the hiring role; has / partial / none become +pts / +half / −pts; achievements with an
 *   independent line, risks with their closing question, CV lines, challenged claims, registry hits and signals with asks
 * - Coverage fallback (no profile): mh-* rows, weight 1, CHECK kind
 * - Every text and ask passes the JUDGEMENT guard; also_found never appears
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import { JUDGEMENT } from "@/domain/challenge";
import type { Brief, Claim, Profile, ProfileEvidence } from "@/domain/claim";
import type { RunState } from "../state";
import { fitPct, scorecard } from "../scorecard";

const line = (source_id: string, over: Partial<ProfileEvidence> = {}): ProfileEvidence => ({ quote: "led the data platform team", source_id, kind: "FACT", supports: true, direction: "supports", note: "", strength: "weak", ...over });

const profile = (over: Partial<Profile> = {}): Profile => ({
  achievements: [
    { text: "Cut pipeline cost by 40%", detail: "", evidence: [line("s-press", { strength: "strong" })] },
    { text: "Spoke at PyData", detail: "", evidence: [line("s-li")] },
  ],
  risks: [{ text: "Three employers in four years", detail: "", evidence: [line("s-li", { kind: "INFERENCE" })] }],
  history: [],
  personality: { disc: null, mbti: null, big5: null, read: "", traits: [], evidence: [], evidence_dropped: 0 },
  position_fit: [
    {
      role: "Senior Data Engineer",
      fit_pct: 0,
      rationale: "",
      traits: [
        { trait: "Production SQL", status: "has", weight: 3, evidence: [line("s-gh")] },
        { trait: "Python", status: "has", weight: 2, evidence: [line("s-gh", { kind: "INFERENCE" })] },
        { trait: "Cloud data platforms", status: "partial", weight: 2, evidence: [line("s-li")] },
        { trait: "Led a team of three", status: "none", weight: 1, evidence: [] },
      ],
    },
    { role: "Analytics Engineer", fit_pct: 50, rationale: "", traits: [] },
  ],
  questions: [{ text: "What made you move on each time?", closes: "Three employers in four years" }],
  degraded: null,
  achievements_dropped: 0,
  risks_dropped: 0,
  history_dropped: 0,
  fit_dropped: 0,
  ...over,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [
    { question_id: "mh-sql", coverage: "evidenced", claim_ids: [], summary: "" },
    { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "" },
    { question_id: "mh-cloud", coverage: "partial", claim_ids: [], summary: "" },
    { question_id: "cv-consistency", coverage: "evidenced", claim_ids: ["cv1", "cv2"], summary: "" },
  ],
  interview_questions: [],
  to_verify: [],
  not_searched: [{ source: "x_profile", reason: "no handle" }],
  searched_empty: [{ source: "github_profile", reason: "none" }, { source: "cv-consistency", reason: "n/a" }],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [{ step: "serp", url: "https://www.instagram.com/someone", excerpt: "Another Jan Novak, fake account" }],
  headline: null,
  location_note: null,
  sections: [],
  profile: profile(),
  ...over,
});

const claim = (id: string, text: string, over: Partial<Claim> = {}): Claim => ({ id, run_id: "r", question_id: "cv-consistency", candidate_id: null, text, kind: "FACT", confidence: 0.9, quote: "q", supports: ["s-li"], contradicts: [], rank: 0, ...over });

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "run1",
  subject: "Jan Novak",
  headline: null,
  role: "Senior Data Engineer",
  position: null,
  organization_name: null,
  created_at: "2026-10-09T10:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [],
  claims: [
    claim("cv1", "CV: Acme 2019-2022; LinkedIn: Acme 2020-2022", { kind: "INFERENCE", quote: null, supports: ["cv:run1", "s-li"] }),
    claim("cv2", "CV and LinkedIn both list Beta as employer", { supports: ["cv:run1", "s-li"] }),
    claim("c3", "Maintains the acme-etl repository", { question_id: "mh-sql", kind: "INFERENCE", quote: null, supports: ["s-gh"] }),
  ],
  sources: [
    { id: "s-li", url: "https://www.linkedin.com/in/jnovak" },
    { id: "s-gh", url: "https://github.com/jnovak" },
    { id: "s-press", url: "https://press.example.com/acme" },
    { id: "cv:run1", url: "cv:run1" },
  ],
  challenges: [{ claim_id: "c3", ground: "fork-or-copy", why: "" }],
  registry_checks: {
    subject: "Jan Novak",
    role: null,
    checks: [
      { registry: "ares", status: "hits", searched: "Jan Novak", source_url: "https://ares.gov.cz/x", hits: [{ label: "Jan Novák, Brno, živnost aktivní", url: "https://ares.gov.cz/r/1", status: "aktivní", born: null, match: "city: Brno" }], namesakes: 0, total: null, note: null },
      { registry: "isir", status: "clear", searched: "Jan Novak", source_url: "https://isir.justice.cz/x", hits: [], namesakes: 0, total: null, note: null },
    ],
  },
  profile_signals: {
    signals: [
      { id: "young-account", platform: "github", profile_url: "https://github.com/jnovak", text: "The GitHub account was created on 2 Mar 2026.", source_url: "https://api.github.com/users/jnovak", ask: "Did you have an earlier GitHub account?" },
      { id: "linkedin-verified", platform: "linkedin", profile_url: "https://www.linkedin.com/in/jnovak", text: "The LinkedIn profile shows a verified badge.", source_url: "https://www.linkedin.com/in/jnovak", ask: null },
    ],
    not_checked: [],
    checked: ["github"],
  },
  questions: [
    { id: "mh-sql", text: "Writes production SQL" },
    { id: "mh-lead", text: "Has led a team of at least three engineers" },
    { id: "mh-cloud", text: "Cloud data platforms" },
  ],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
  intake: null,
  ...over,
});

describe("fitPct", () => {
  it("weights statuses and falls back to the stored figure without weights", () => {
    const [main, other] = profile().position_fit;
    // (3 + 2 + 1) / 8 = 75%
    expect(main === undefined ? -1 : fitPct(main)).toBe(75);
    expect(other === undefined ? -1 : fitPct(other)).toBe(50);
  });
});

describe("scorecard", () => {
  it("is null without a brief", () => {
    expect(scorecard(run({ brief: null }))).toBeNull();
  });

  it("scores the hiring role from the profile and signs the must-have points", () => {
    const card = scorecard(run());
    expect(card?.fit).toBe(75);
    expect(card?.role).toBe("Senior Data Engineer");
    expect(card?.checked).toEqual({ evidenced: 2, partial: 1, none: 1, total: 4 });
    const must = [...(card?.pluses ?? []), ...(card?.minuses ?? [])].filter((i) => i.area === "must-have");
    expect(must.map((i) => [i.text, i.points, i.kind, i.side])).toEqual([
      ["Production SQL", 38, "FACT", "plus"],
      ["Python", 25, "INFERENCE", "plus"],
      ["Cloud data platforms, partly evidenced", 13, "FACT", "plus"],
      ["Led a team of three: no public evidence", -13, "CHECK", "minus"],
    ]);
    expect(must[0]?.source_ids).toEqual(["s-gh"]);
  });

  it("lists pluses outside the must-haves at 0 points: independent achievements and CV matches", () => {
    const pluses = scorecard(run())?.pluses ?? [];
    const texts = pluses.map((i) => i.text);
    expect(texts).toContain("Cut pipeline cost by 40%");
    expect(texts).not.toContain("Spoke at PyData");
    expect(texts).toContain("1 CV statement matches the public record");
    expect(pluses.filter((i) => i.area !== "must-have").every((i) => i.points === 0)).toBe(true);
  });

  it("lists minuses at 0 points with an ask or a check: risk, CV difference, challenge, registry hit, signal", () => {
    const minuses = scorecard(run())?.minuses ?? [];
    const byArea = Object.fromEntries(minuses.map((i) => [i.area, i]));
    expect(byArea.risk).toMatchObject({ text: "Three employers in four years", kind: "INFERENCE", ask: "What made you move on each time?" });
    expect(byArea.cv).toMatchObject({ text: "CV: Acme 2019-2022; LinkedIn: Acme 2020-2022", kind: "CHECK", source_ids: ["cv:run1", "s-li"] });
    expect(byArea.challenge).toMatchObject({ text: "Maintains the acme-etl repository", source_ids: ["s-gh"] });
    expect(byArea.challenge?.ask).toMatch(/fork|copy/i);
    expect(byArea.registry).toMatchObject({ text: "ARES business records: Jan Novák, Brno, živnost aktivní", urls: ["https://ares.gov.cz/r/1"], ask: "Check: matched by city: Brno." });
    expect(byArea.signal).toMatchObject({ text: "The GitHub account was created on 2 Mar 2026.", urls: ["https://api.github.com/users/jnovak"], ask: "Did you have an earlier GitHub account?" });
    expect(minuses.map((i) => i.text)).not.toContain("The LinkedIn profile shows a verified badge.");
    expect(minuses.filter((i) => i.area !== "must-have").every((i) => i.points === 0)).toBe(true);
  });

  it("notes empty and unsearched sources, never counting the CV section", () => {
    expect(scorecard(run())?.notes).toEqual(["1 source was searched and came back empty.", "1 source was not searched."]);
  });

  it("falls back to mh-* coverage when the brief has no profile", () => {
    const card = scorecard(run({ brief: brief({ profile: null, degraded: "AI off" }) }));
    expect(card?.fit).toBe(50);
    expect(card?.checked).toEqual({ evidenced: 1, partial: 1, none: 1, total: 3 });
    const must = [...(card?.pluses ?? []), ...(card?.minuses ?? [])].filter((i) => i.area === "must-have");
    expect(must.map((i) => [i.text, i.points, i.kind])).toEqual([
      ["Writes production SQL", 33, "CHECK"],
      ["Cloud data platforms, partly evidenced", 17, "CHECK"],
      ["Has led a team of at least three engineers: no public evidence", -33, "CHECK"],
    ]);
    expect(card?.notes[0]).toMatch(/AI was off/);
  });

  it("has a null fit and no must-have lines when there are none", () => {
    const card = scorecard(run({ brief: brief({ profile: null, per_question: [] }), questions: [] }));
    expect(card?.fit).toBeNull();
    expect(card?.checked.total).toBe(0);
    expect(card?.pluses.some((i) => i.area === "must-have")).toBe(false);
  });

  it("never judges the person and never uses also_found", () => {
    const card = scorecard(run());
    const texts = [...(card?.pluses ?? []), ...(card?.minuses ?? [])].flatMap((i) => [i.text, i.ask ?? ""]);
    for (const t of texts) expect(t).not.toMatch(JUDGEMENT);
    expect(texts.join(" ")).not.toMatch(/instagram|Another Jan/);
  });
});
