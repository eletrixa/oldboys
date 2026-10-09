/**
 * Tests for "Copy reference questions": header, criteria wordings, degraded brief, to-verify, cap, Art. 9, plain text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/reference-check.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - referenceQuestions: null without a brief; header with and without role; gaps to questions in order
 * - Never also_found, interview questions or claims; Art. 9 topics dropped; fallback line when nothing is open
 * - Czech Report (idea #24): Czech fixed strings, translated criteria and to-verify items (English fallback), role
 *   untranslated, exclusions and Art. 9 filter intact; the default and the English Report give the same English list
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Brief, Claim } from "@/domain/claim";
import type { RunState } from "../state";
import { ENGLISH_REPORT, makeReport } from "../i18n";
import { referenceQuestions } from "../reference-check";
import { tid } from "../report-text";

const brief = (over: Partial<Brief> = {}): Brief => ({
  profile: null,
  run_id: "r",
  per_question: [
    { question_id: "mh-sql", coverage: "evidenced", claim_ids: ["c1"], summary: "SQL in two projects." },
    { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "No evidence." },
    { question_id: "mh-cloud", coverage: "partial", claim_ids: ["c2"], summary: "One talk." },
    { question_id: "q-extra", coverage: "none", claim_ids: [], summary: "No evidence." },
  ],
  interview_questions: ["Walk me through the pipeline you built at Acme?"],
  to_verify: ["Dates at Acme"],
  not_searched: [],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [{ step: "rest/github", url: "https://github.com/jnovak", excerpt: "jnovak: 12 repositories" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://www.instagram.com/someone", excerpt: "Another Jan Novak namesake" }],
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
  intake: null,
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [],
  claims: [],
  sources: [],
  questions: [
    { id: "mh-sql", text: "Writes production SQL" },
    { id: "mh-lead", text: "Has led a team of at least three engineers for a year or more", title: "Team leadership" },
    { id: "mh-cloud", text: "Runs workloads on a public cloud" },
    { id: "q-extra", text: "Speaks at meetups" },
  ],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
  ...over,
});

const lines = (text: string | null): string[] => (text ?? "").split("\n");
const numbered = (text: string | null): string[] => lines(text).filter((l) => /^\d+\. /.test(l));

describe("referenceQuestions", () => {
  it("is null without a brief", () => {
    expect(referenceQuestions(run({ brief: null }))).toBeNull();
  });

  it("starts with subject and role, falls back without role or subject, and ends with the consent reminder", () => {
    const out = lines(referenceQuestions(run()));
    expect(out[0]).toBe("Reference check: Jan Novak for Senior Data Engineer");
    expect(out[1]).toBe("Questions for a former manager or colleague. Ask only about work they saw first-hand.");
    expect(out[2]).toBe("");
    expect(out[out.length - 1]).toMatch(/^Contact references only with the candidate's consent\./);
    expect(lines(referenceQuestions(run({ role: null })))[0]).toBe("Reference check: Jan Novak");
    expect(lines(referenceQuestions(run({ role: "  " })))[0]).toBe("Reference check: Jan Novak");
    expect(lines(referenceQuestions(run({ subject: " ", role: null })))[0]).toBe("Reference check: unnamed person");
  });

  it("turns none and partial criteria into questions in criteria order, title first, mh- only", () => {
    expect(numbered(referenceQuestions(run()))).toEqual([
      '1. We found no public evidence for "Team leadership". Did you see Jan do this at work? Can you give an example?',
      '2. We found only partial public evidence for "Runs workloads on a public cloud". Did you see Jan do this at work? Can you give an example?',
      "3. Can you confirm: Dates at Acme?",
    ]);
    const text = referenceQuestions(run()) ?? "";
    expect(text).not.toContain("Writes production SQL");
    expect(text).not.toContain("meetups");
  });

  it("asks about every criterion when AI was off", () => {
    const expected = [
      '1. Did you see Jan work on "Writes production SQL"? Can you give an example?',
      '2. Did you see Jan work on "Team leadership"? Can you give an example?',
      '3. Did you see Jan work on "Runs workloads on a public cloud"? Can you give an example?',
      "4. Can you confirm: Dates at Acme?",
    ];
    expect(numbered(referenceQuestions(run({ brief: brief({ degraded: "no AI key" }) })))).toEqual(expected);
    const placeholders = brief().per_question.map((q) => ({ ...q, coverage: "evidenced" as const, summary: "AI summary unavailable." }));
    expect(numbered(referenceQuestions(run({ brief: brief({ per_question: placeholders }) })))).toEqual(expected);
  });

  it("turns to-verify items into confirm questions without a double question mark", () => {
    const out = numbered(referenceQuestions(run({ questions: [], brief: brief({ to_verify: ["Was the Acme role full-time?", "  ", "Title at Beta s.r.o."] }) })));
    expect(out).toEqual(["1. Can you confirm: Was the Acme role full-time?", "2. Can you confirm: Title at Beta s.r.o?"]);
    expect(out.join("\n")).not.toContain("??");
  });

  it("caps at 8, deduplicates and numbers 1..n", () => {
    const items = ["Dates at Acme", "Dates at Acme", ...Array.from({ length: 12 }, (_, i) => `Item ${String(i)}`)];
    const out = numbered(referenceQuestions(run({ brief: brief({ to_verify: items }) })));
    expect(out).toHaveLength(8);
    expect(out.map((l) => l.split(".")[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(out.filter((l) => l.endsWith("Dates at Acme?"))).toHaveLength(1);
  });

  it("drops criteria and to-verify items about Art. 9 topics", () => {
    const text = referenceQuestions(
      run({
        questions: [
          { id: "mh-health", text: "Health of the candidate" },
          { id: "mh-lead", text: "Leads a team" },
        ],
        brief: brief({
          per_question: [
            { question_id: "mh-health", coverage: "none", claim_ids: [], summary: "No evidence." },
            { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "No evidence." },
          ],
          to_verify: ["Religious affiliation", "Political party membership", "Dates at Acme"],
        }),
      }),
    );
    expect(numbered(text)).toEqual([
      '1. We found no public evidence for "Leads a team". Did you see Jan do this at work? Can you give an example?',
      "2. Can you confirm: Dates at Acme?",
    ]);
  });

  it("prints one fallback line when nothing is open", () => {
    const out = lines(referenceQuestions(run({ subject: "", brief: brief({ per_question: [], to_verify: [] }) })));
    expect(out[3]).toBe("The research left no open points. Ask the referee to describe one project the candidate owned and their part in it.");
    expect(out).toHaveLength(5);
  });

  it("never uses also_found, interview questions or claims, and stays plain text", () => {
    const claim: Claim = {
      id: "c1", run_id: "r", question_id: "mh-lead", candidate_id: null, text: "Maintains a widely used SQL linter",
      kind: "FACT", confidence: 0.9, quote: "SQL linter", supports: ["https://github.com/jnovak"], contradicts: [], rank: 0,
    };
    const text = referenceQuestions(run({ claims: [claim] })) ?? "";
    expect(text).not.toContain("namesake");
    expect(text).not.toContain("instagram");
    expect(text).not.toContain("Walk me through");
    expect(text).not.toContain("SQL linter");
    for (const l of lines(text)) expect(/^[#\-*>]/.test(l)).toBe(false);
  });

  it("English unchanged: the default and the English Report give the same list", () => {
    for (const state of [run(), run({ role: null }), run({ brief: brief({ degraded: "no AI key" }) }), run({ subject: "", brief: brief({ per_question: [], to_verify: [] }) })]) {
      expect(referenceQuestions(state, ENGLISH_REPORT)).toBe(referenceQuestions(state));
      expect(referenceQuestions(state, makeReport("en", { [tid.toVerify(0)]: "Ignored" }))).toBe(referenceQuestions(state));
    }
  });
});

describe("referenceQuestions in Czech", () => {
  const cs = makeReport("cs", {
    [tid.question("mh-lead")]: "Vedení týmu aspoň tří inženýrů po dobu alespoň jednoho roku",
    [tid.question("mh-cloud")]: "Provozuje aplikace ve veřejném cloudu",
    [tid.toVerify(0)]: "Data působení v Acme",
  });

  it("full list: Czech header with the role as typed, intro, translated criteria and to-verify items, Czech footer", () => {
    expect(lines(referenceQuestions(run(), cs))).toEqual([
      "Reference: Jan Novak, pozice Senior Data Engineer",
      "Otázky pro bývalé vedení nebo kolegy a kolegyně z předchozí práce. Ptejte se jen na práci, kterou znají z první ruky.",
      "",
      "1. Pro „Vedení týmu aspoň tří inženýrů po dobu alespoň jednoho roku“ jsme ve veřejných zdrojích nenašli žádný doklad. " +
        "Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "2. Pro „Provozuje aplikace ve veřejném cloudu“ jsme ve veřejných zdrojích našli jen částečné doklady. " +
        "Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "3. Můžete potvrdit: Data působení v Acme?",
      "Reference kontaktujte jen se souhlasem kandidující osoby. Nikdy se neptejte na zdraví, rodinu, přesvědčení, " +
        "politické názory, členství v odborech ani jiná soukromá témata. Zapište si, co reference zná z první ruky, ne co si " +
        "o daném člověku myslí.",
    ]);
  });

  it("no role: header without the position; no subject: a Czech placeholder", () => {
    expect(lines(referenceQuestions(run({ role: null }), cs))[0]).toBe("Reference: Jan Novak");
    expect(lines(referenceQuestions(run({ role: " " }), cs))[0]).toBe("Reference: Jan Novak");
    expect(lines(referenceQuestions(run({ subject: "", role: null }), cs))[0]).toBe("Reference: jméno neuvedeno");
  });

  it("missing translations: the English title or text stays inside the Czech wording", () => {
    expect(numbered(referenceQuestions(run(), makeReport("cs", {})))).toEqual([
      "1. Pro „Team leadership“ jsme ve veřejných zdrojích nenašli žádný doklad. Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "2. Pro „Runs workloads on a public cloud“ jsme ve veřejných zdrojích našli jen částečné doklady. Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "3. Můžete potvrdit: Dates at Acme?",
    ]);
  });

  it("AI off: every criterion as not checked, in Czech", () => {
    expect(numbered(referenceQuestions(run({ brief: brief({ degraded: "no AI key" }) }), cs))).toEqual([
      "1. Kritérium „Writes production SQL“ průzkum neověřoval. Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "2. Kritérium „Vedení týmu aspoň tří inženýrů po dobu alespoň jednoho roku“ průzkum neověřoval. Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "3. Kritérium „Provozuje aplikace ve veřejném cloudu“ průzkum neověřoval. Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "4. Můžete potvrdit: Data působení v Acme?",
    ]);
  });

  it("to-verify translations follow the original index, blanks skipped", () => {
    const report = makeReport("cs", { [tid.toVerify(2)]: "Pracovní pozice v Beta s.r.o." });
    const out = numbered(referenceQuestions(run({ questions: [], brief: brief({ to_verify: ["Was the Acme role full-time?", "  ", "Title at Beta s.r.o."] }) }), report));
    expect(out).toEqual(["1. Můžete potvrdit: Was the Acme role full-time?", "2. Můžete potvrdit: Pracovní pozice v Beta s.r.o?"]);
  });

  it("drops Art. 9 topics, whether the English or the Czech text names them", () => {
    const report = makeReport("cs", {
      [tid.question("mh-health")]: "Pracovní nasazení",
      [tid.question("mh-lead")]: "Vede tým",
      [tid.toVerify(0)]: "Náboženské vyznání",
      [tid.toVerify(1)]: "Členství v odborové organizaci",
      [tid.toVerify(2)]: "Data působení v Acme",
    });
    const text = referenceQuestions(
      run({
        questions: [
          { id: "mh-health", text: "Health of the candidate" },
          { id: "mh-lead", text: "Leads a team" },
        ],
        brief: brief({
          per_question: [
            { question_id: "mh-health", coverage: "none", claim_ids: [], summary: "No evidence." },
            { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "No evidence." },
          ],
          to_verify: ["Faith", "Union", "Dates at Acme"],
        }),
      }),
      report,
    );
    expect(numbered(text)).toEqual([
      "1. Pro „Vede tým“ jsme ve veřejných zdrojích nenašli žádný doklad. Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?",
      "2. Můžete potvrdit: Data působení v Acme?",
    ]);
  });

  it("fallback line in Czech when nothing is open", () => {
    const out = lines(referenceQuestions(run({ subject: "", brief: brief({ per_question: [], to_verify: [] }) }), cs));
    expect(out[3]).toBe(
      "Průzkum nenechal žádné otevřené body. Zeptejte se: Můžete popsat jeden projekt, za který tato osoba odpovídala, a jaká v něm byla Vaše role?",
    );
    expect(out).toHaveLength(5);
  });

  it("no English fixed string; never also_found, interview questions or claims; plain text", () => {
    const claim: Claim = {
      id: "c1", run_id: "r", question_id: "mh-lead", candidate_id: null, text: "Maintains a widely used SQL linter",
      kind: "FACT", confidence: 0.9, quote: "SQL linter", supports: ["https://github.com/jnovak"], contradicts: [], rank: 0,
    };
    const report = makeReport("cs", { [tid.claim("c1")]: "Udržuje SQL linter", [tid.interviewQuestion(0)]: "Provedete mě pipeline?" });
    const text = referenceQuestions(run({ claims: [claim] }), report) ?? "";
    for (const en of ["Reference check", "Questions for", "We found", "Did you see", "Can you", "Contact references", "the candidate", " for Senior"]) {
      expect(text).not.toContain(en);
    }
    for (const banned of ["namesake", "instagram", "Walk me through", "Provedete", "SQL linter"]) expect(text).not.toContain(banned);
    for (const l of lines(text)) expect(/^[#\-*>]/.test(l)).toBe(false);
  });
});
