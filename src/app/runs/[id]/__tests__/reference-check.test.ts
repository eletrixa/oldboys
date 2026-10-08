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
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Brief, Claim } from "@/domain/claim";
import type { RunState } from "../state";
import { referenceQuestions } from "../reference-check";

const brief = (over: Partial<Brief> = {}): Brief => ({
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
});
