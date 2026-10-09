/**
 * Tests for "After the interview": parsing a filled interview kit, the summary and the open-points text (idea #23).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/kit-review.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Round trip with interviewKit: ticked boxes and notes count, the rest is open; untouched kit is all open
 * - Notes on the same line or the indented lines below count, an empty "Notes:" does not
 * - [X], "*" bullets, CRLF and escaped Markdown are accepted; non-kit text gives an empty review and the fallback text
 * - The notes' content never reaches the summary or the copied text
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Brief } from "@/domain/claim";
import { interviewKit } from "../interview-kit";
import { isKit, openPointsText, parseFilledKit, reviewSummary } from "../kit-review";
import type { RunState } from "../state";

const AT = "2026-10-08T21:30:00.000Z";

const QUESTIONS = [
  "Walk me through your last pipeline.",
  "How did you test the *billing* job?",
  "What did you own at Acme?",
  "Which on_call rotation did you run?",
  "Why the move from batch to streaming?",
  "What would you change in [the] schema | design?",
];

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [],
  interview_questions: QUESTIONS,
  to_verify: ["Dates at Acme", "Talk at DataConf 2024"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
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
  position: null,
  organization_name: null,
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [],
  claims: [],
  sources: [],
  questions: [{ id: "mh-exp", text: "Has five years of data engineering" }],
  brief: brief(),
  failure: null,
  intake: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0.234, source_calls: 7, llm_calls: 4, duration_ms: 192_000 },
  ...over,
});

const kit = (): string => interviewKit(run(), AT) ?? "";

const SECRET = "Zebra-quokka remark 7731";

/** The kit as a manager fills it: 2 ticked, 2 with notes only, 2 untouched; one check verified. */
function filled(): string {
  return kit()
    .replace("- [ ] Walk me through your last pipeline.", "- [x] Walk me through your last pipeline.")
    .replace("- [ ] What did you own at Acme?", "- [x] What did you own at Acme?")
    .replace("- [ ] Which on\\_call rotation did you run?\n  Notes:", `- [ ] Which on\\_call rotation did you run?\n  Notes: ${SECRET}`)
    .replace("- [ ] Why the move from batch to streaming?\n  Notes:", `- [ ] Why the move from batch to streaming?\n  Notes:\n  ${SECRET}`)
    .replace("- [ ] Dates at Acme", "- [x] Dates at Acme");
}

describe("parseFilledKit round trip", () => {
  it("counts ticked boxes and written notes as answered, lists the rest as open", () => {
    const review = parseFilledKit(filled());
    expect(reviewSummary(review)).toEqual({
      answered: 4,
      questions: 6,
      verified: 1,
      checks: 2,
      open: ["How did you test the *billing* job?", "What would you change in [the] schema | design?", "Talk at DataConf 2024"],
    });
    expect(openPointsText(review)).toBe(
      [
        "Still open after the interview:",
        "1. How did you test the *billing* job?",
        "2. What would you change in [the] schema | design?",
        "3. Talk at DataConf 2024",
      ].join("\n"),
    );
  });

  it("leaves every point open for an untouched kit", () => {
    const review = parseFilledKit(kit());
    expect(isKit(review)).toBe(true);
    expect(reviewSummary(review)).toEqual({
      answered: 0,
      questions: 6,
      verified: 0,
      checks: 2,
      open: [...QUESTIONS, "Dates at Acme", "Talk at DataConf 2024"],
    });
  });

  it("ignores other kit sections (gaps, not searched)", () => {
    const review = parseFilledKit(kit());
    expect(review.checks.map((c) => c.text)).toEqual(["Dates at Acme", "Talk at DataConf 2024"]);
  });
});

describe("parseFilledKit notes", () => {
  const md = (notes: string): string => `## Questions for the interview\n\n- [ ] Q one\n${notes}\n- [ ] Q two\n  Notes:\n`;

  it("counts notes on the same line", () => {
    expect(parseFilledKit(md("  Notes: led the rewrite")).questions[0]?.hasNotes).toBe(true);
  });

  it("counts notes on the following indented lines", () => {
    expect(parseFilledKit(md("  Notes:\n\n    led the rewrite\n    second line")).questions[0]?.hasNotes).toBe(true);
  });

  it("does not count an empty Notes line", () => {
    const review = parseFilledKit(md("  Notes:   \n\n"));
    expect(review.questions.map((q) => q.hasNotes)).toEqual([false, false]);
    expect(reviewSummary(review).answered).toBe(0);
  });

  it("stops the notes at the next heading", () => {
    const review = parseFilledKit("## Questions for the interview\n\n- [ ] Q one\n  Notes:\n\n## To verify\n\n- [ ] Check\n");
    expect(review.questions[0]?.hasNotes).toBe(false);
    expect(review.checks).toEqual([{ text: "Check", done: false }]);
  });
});

describe("parseFilledKit tolerance", () => {
  it("accepts [X], * bullets and CRLF line endings", () => {
    const md = ["## Questions for the interview", "", "* [X] Q one", "  Notes:", "- [ ] Q two", "  Notes:", "", "## To verify", "", "* [X] Check one", "- [ ] Check two", ""].join("\r\n");
    const review = parseFilledKit(md);
    expect(review.questions).toEqual([
      { text: "Q one", done: true, hasNotes: false },
      { text: "Q two", done: false, hasNotes: false },
    ]);
    expect(review.checks).toEqual([
      { text: "Check one", done: true },
      { text: "Check two", done: false },
    ]);
  });

  it("unescapes the Markdown escaping of the kit", () => {
    const review = parseFilledKit("## To verify\n\n- [ ] Uses \\*stars\\*, snake\\_case, a \\| pipe and \\[brackets\\]\n");
    expect(review.checks[0]?.text).toBe("Uses *stars*, snake_case, a | pipe and [brackets]");
  });

  it("returns an empty review for text without kit sections", () => {
    const review = parseFilledKit("Some notes from the call.\n- [x] not in a kit section\n");
    expect(review).toEqual({ questions: [], checks: [] });
    expect(isKit(review)).toBe(false);
    expect(openPointsText(review)).toBe("Every point from the kit was covered in the interview.");
  });

  it("says everything was covered when every point is closed", () => {
    expect(openPointsText(parseFilledKit("## To verify\n\n- [x] Dates\n"))).toBe("Every point from the kit was covered in the interview.");
  });
});

describe("privacy", () => {
  it("never puts the notes' content into the summary or the copied text", () => {
    const review = parseFilledKit(filled());
    expect(JSON.stringify(review)).not.toContain(SECRET);
    expect(JSON.stringify(reviewSummary(review))).not.toContain(SECRET);
    expect(openPointsText(review)).not.toContain(SECRET);
  });
});
