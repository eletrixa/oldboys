/**
 * Tests for the Czech 30-second summary: built from counts and translated criteria, never a translated sentence.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/summary-cs.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - The production case (run d7274abf: 3 platforms + 4 other sources, 0 of 4 criteria) reads "0 ze 4" with no negation
 * - czPlural / zOrZe agreement; missing criteria by q:<id> with English fallback per criterion; one label per line
 * - AI-off and research-question variants in Czech; the ask line by iq: / tv:; English equals summary30s
 *
 * Design constraints:
 * - Pure: no React, no fetch; fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate } from "@/domain/claim";
import { ENGLISH_REPORT, makeReport } from "../i18n";
import { reportTexts, tid } from "../report-text";
import type { RunState } from "../state";
import { summary30s } from "../summary";
import { czPlural, summaryIn, summaryLines, zOrZe } from "../summary-cs";

const cand = (platform: string, url: string): Candidate => ({
  id: platform, run_id: "r", name: "Robert Vojacek", profile_urls: [url], anchor_match: null, score: 0.9, decision: "merge", platform, handle: null, snippet: "", reasons: [],
});

const EMPLOYMENT = "Does the candidate have documented prior employment or work history relevant to cleaning?";
const OFFICES = "Has the candidate cleaned offices or commercial spaces before?";

const brief = (over: Partial<Brief> = {}): Brief => ({
  profile: null,
  run_id: "r",
  per_question: [
    { question_id: "mh-employment", coverage: "none", claim_ids: [], summary: "" },
    { question_id: "mh-offices", coverage: "none", claim_ids: [], summary: "" },
    { question_id: "mh-shifts", coverage: "none", claim_ids: [], summary: "" },
    { question_id: "mh-czech", coverage: "none", claim_ids: [], summary: "" },
  ],
  interview_questions: ["", "Can you describe a cleaning job you did for an office?"],
  to_verify: ["Dates at Chustup"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [1, 2, 3, 4].map((n) => ({ step: "apify/google-search-scraper", url: `https://example${String(n)}.cz/page`, excerpt: "page" })),
  also_found: [{ step: "apify/google-search-scraper", url: "https://www.facebook.com/someone", excerpt: "Another Robert Vojacek" }],
  headline: "Cleaner",
  location_note: null,
  sections: [],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "d7274abf00000000",
  subject: "Robert Vojacek",
  headline: null,
  role: "Cleaner",
  position: null,
  organization_name: "Chustup spol. s r.o.",
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [
    cand("linkedin", "https://www.linkedin.com/in/rv"),
    cand("github", "https://github.com/rv"),
    cand("instagram", "https://www.instagram.com/rv"),
  ],
  claims: [],
  sources: [],
  questions: [
    { id: "mh-employment", text: EMPLOYMENT },
    { id: "mh-offices", text: OFFICES },
    { id: "mh-shifts", text: "Can work early morning shifts" },
    { id: "mh-czech", text: "Speaks Czech" },
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

const TEXTS = {
  [tid.question("mh-employment")]: "Má doloženou předchozí praxi v úklidu?",
  [tid.question("mh-offices")]: "Uklízel/a už kanceláře nebo komerční prostory?",
  [tid.interviewQuestion(1)]: "Můžete popsat úklid, který jste dělal/a pro kancelář?",
  [tid.toVerify(0)]: "Data působení ve firmě Chustup",
};
const CS = makeReport("cs", TEXTS);
const CS_NO_TEXTS = makeReport("cs", null);
const cs = (state: RunState, report = CS) => summaryIn(state, report);
const NEGATION = /\bne[a-zá-ž]*|není|žádn/i;

describe("czPlural and zOrZe", () => {
  it("1 zdroj, 2–4 zdroje, 0 and 5+ zdrojů", () => {
    const zdroj = (n: number): string => czPlural(n, "zdroj", "zdroje", "zdrojů");
    expect([0, 1, 2, 3, 4, 5, 11].map(zdroj)).toEqual(["zdrojů", "zdroj", "zdroje", "zdroje", "zdroje", "zdrojů", "zdrojů"]);
    const kriterium = (n: number): string => czPlural(n, "kritérium", "kritéria", "kritérií");
    expect([1, 2, 5].map(kriterium)).toEqual(["kritérium", "kritéria", "kritérií"]);
  });

  it("ze before 2, 3, 4, 7 (dvou, tří, čtyř, sedmi), z before 1, 5, 10", () => {
    expect([1, 2, 3, 4, 5, 7, 10].map(zOrZe)).toEqual(["z", "ze", "ze", "ze", "z", "ze", "z"]);
  });
});

describe("Czech 30-second summary", () => {
  it("production case: 3 platforms + 4 other sources, 0 of 4 criteria reads 0 ze 4 with no negation", () => {
    const s = cs(run());
    expect(s?.documented).toBe("Potvrzeno: profily LinkedIn, GitHub a Instagram a další 4 zdroje. Doložená kritéria pozice: 0 ze 4.");
    expect(s?.documented).not.toMatch(NEGATION);
    expect(s?.missing).toBe("Chybí doklad k: „Má doloženou předchozí praxi v úklidu“; „Uklízel/a už kanceláře nebo komerční prostory“.");
    expect(s?.ask).toBe("Zeptejte se: Můžete popsat úklid, který jste dělal/a pro kancelář?");
  });

  it("each label once: no Chybí: chybí, no English lead word", () => {
    const l = summaryLines(run(), CS);
    expect(l?.missing.lead).toBe("Chybí doklad k");
    expect(l?.missing.body).not.toMatch(/chybí|doklad k|no evidence/i);
    expect(l?.documented.body).not.toMatch(/^Potvrzeno|Confirmed/);
    expect(l?.ask.body).not.toMatch(/^Zeptejte|Ask/);
  });

  it("1, 2 and 5 other sources: plural agreement", () => {
    const withOther = (n: number): string | undefined =>
      cs(run({ brief: brief({ evidence: brief().evidence.concat([5, 6, 7].map((k) => ({ step: "x", url: `https://example${String(k)}.cz/`, excerpt: "" }))).slice(0, n) }) }))?.documented;
    expect(withOther(1)).toMatch(/^Potvrzeno: profily LinkedIn, GitHub a Instagram a další 1 zdroj\. /);
    expect(withOther(2)).toMatch(/ a další 2 zdroje\. /);
    expect(withOther(5)).toMatch(/ a další 5 zdrojů\. /);
    const webOnly = (n: number): string | undefined =>
      cs(run({ candidates: [], brief: brief({ evidence: brief().evidence.concat([{ step: "x", url: "https://example5.cz/", excerpt: "" }]).slice(0, n) }) }))?.documented;
    expect(webOnly(1)).toMatch(/^Potvrzeno: 1 webový zdroj\. /);
    expect(webOnly(2)).toMatch(/^Potvrzeno: 2 webové zdroje\. /);
    expect(webOnly(5)).toMatch(/^Potvrzeno: 5 webových zdrojů\. /);
  });

  it("one platform, evidenced and partial counts, z before 5", () => {
    const rows = (["evidenced", "partial", "partial", "none", "none"] as const).map((coverage, i) => ({ question_id: `mh-${String(i)}`, coverage, claim_ids: [], summary: "" }));
    const s = cs(run({ candidates: [cand("linkedin", "https://www.linkedin.com/in/rv")], brief: brief({ evidence: [], per_question: rows }) }));
    expect(s?.documented).toBe("Potvrzeno: profil LinkedIn. Doložená kritéria pozice: 1 z 5, částečně 2.");
  });

  it("missing criteria fall back to English per criterion, shortened to 60 characters", () => {
    const s = cs(run(), makeReport("cs", { [tid.question("mh-offices")]: "Uklízel/a už kanceláře?" }));
    expect(s?.missing).toBe("Chybí doklad k: „Does the candidate have documented prior employment or…“; „Uklízel/a už kanceláře“.");
  });

  it("source gaps after the criteria, and alone under Chybí", () => {
    const one = run({ brief: brief({ per_question: brief().per_question.slice(0, 1) }) });
    expect(cs(one)?.missing).toBe("Chybí doklad k: „Má doloženou předchozí praxi v úklidu“. Dále: X (neprohledáno).");
    const none = run({ brief: brief({ per_question: [], searched_empty: [{ source: "serp_person", reason: "no hits" }] }) });
    expect(cs(none)?.missing).toBe("Chybí: Vyhledávání na webu (prohledáno, nic nepotvrzeno); X (neprohledáno).");
    const clean = run({ brief: brief({ per_question: [], not_searched: [] }) });
    expect(cs(clean)?.missing).toBe("Chybí: žádné mezery nezaznamenány.");
  });

  it("AI off: criteria not checked, no criterion gaps", () => {
    const s = cs(run({ brief: brief({ degraded: "model unavailable" }) }));
    expect(s?.documented).toBe("Potvrzeno: profily LinkedIn, GitHub a Instagram a další 4 zdroje. Kritéria pozice jsme neověřovali, AI byla vypnutá.");
    expect(s?.missing).toBe("Chybí: X (neprohledáno).");
  });

  it("research questions without role criteria; the CV check row is not counted", () => {
    const rows: Brief["per_question"] = [
      { question_id: "base-1", coverage: "evidenced", claim_ids: [], summary: "Two talks." },
      { question_id: "base-2", coverage: "none", claim_ids: [], summary: "" },
      { question_id: "cv-consistency", coverage: "none", claim_ids: [], summary: "" },
    ];
    const s = cs(run({ candidates: [], questions: [{ id: "base-2", text: "Public talks" }], brief: brief({ evidence: [], per_question: rows }) }));
    expect(s?.documented).toBe("Zatím žádný potvrzený profil. Doložené výzkumné otázky: 1 ze 2.");
    expect(s?.missing).toBe("Chybí doklad k: „Public talks“. Dále: X (neprohledáno).");
  });

  it("ask: the first interview question by its iq: index, else the first to-verify item by tv:, English when not translated", () => {
    expect(cs(run(), CS_NO_TEXTS)?.ask).toBe("Zeptejte se: Can you describe a cleaning job you did for an office?");
    expect(cs(run({ brief: brief({ interview_questions: [] }) }))?.ask).toBe("Ověřte: Data působení ve firmě Chustup.");
    expect(cs(run({ brief: brief({ interview_questions: [], to_verify: [] }) }))?.ask).toBe("Zeptejte se: zatím žádná otázka k pohovoru.");
  });

  it("null without a brief", () => {
    expect(cs(run({ brief: null }))).toBeNull();
  });
});

describe("English and the translator", () => {
  it("English equals summary30s byte for byte, translations ignored", () => {
    for (const state of [run(), run({ brief: brief({ degraded: "x" }) }), run({ candidates: [], brief: brief({ evidence: [], interview_questions: [] }) })]) {
      expect(summaryIn(state, ENGLISH_REPORT)).toEqual(summary30s(state));
      expect(summaryIn(state, makeReport("en", TEXTS))).toEqual(summary30s(state));
    }
  });

  it("reportTexts sends no summary sentence, only the missing criteria by q:<id>", () => {
    const texts = reportTexts(run());
    const ids = texts.map((t) => t.id);
    expect(ids).not.toContain("sum:documented");
    expect(ids).not.toContain("sum:missing");
    expect(ids.filter((id) => id.startsWith("sum:"))).toEqual([]);
    expect(texts.find((t) => t.id === tid.question("mh-employment"))?.text).toBe(EMPLOYMENT);
    expect(texts.find((t) => t.id === tid.question("mh-offices"))?.text).toBe(OFFICES);
    expect(JSON.stringify(texts)).not.toMatch(/0 of 4|Confirmed:|Missing:/);
  });
});
