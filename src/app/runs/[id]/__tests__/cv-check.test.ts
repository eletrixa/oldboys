/**
 * Tests for the CV consistency check in the report (idea #14): outcome labels, section rendering, summary line, kit, references.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/cv-check.test.ts
 * Deps:    vitest, react, react-dom/server (static markup, no DOM)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - CV_OUTCOME label and tone per outcome; cvRows order; cvSummaryLine counts; cvDifferenceTexts
 * - "CV vs public record" renders the explainer and one outcome pill per claim; other sections get no pill
 * - 30-second summary, interview kit and reference questions with and without a CV check
 *
 * Design constraints:
 * - Fixtures stay inline; no verdict words anywhere
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Brief, BriefSection, Claim } from "@/domain/claim";
import { CV_QUESTION_ID } from "@/domain/cv-check";
import { CV_EXPLAINER, CV_OUTCOME, cvCounts, cvDifferenceTexts, cvRows, cvSummaryLine } from "../cv-check";
import { evidenceOf } from "../evidence";
import { interviewKit } from "../interview-kit";
import { referenceQuestions } from "../reference-check";
import { SectionList } from "../sections";
import type { RunState } from "../state";
import { summary30s } from "../summary";

const claim = (id: string, kind: Claim["kind"], text: string, supports: string[], question_id = CV_QUESTION_ID): Claim => ({
  id, run_id: "r", question_id, candidate_id: null, text, kind, confidence: 0.8, quote: kind === "FACT" ? text : null, supports, contradicts: [], rank: 1,
});
const DIFF = "CV: Team Lead at Acme from 2020. Public LinkedIn: Team Lead at Acme since 2022.";
const match = claim("m1", "FACT", "Data Engineer at Kiwi.com 2018-2022", ["li", "cv"]);
const diff = claim("d1", "INFERENCE", DIFF, ["li", "cv"]);
const notFound = claim("n1", "INFERENCE", "CV mentions the Falcon ETL project; no public source we checked mentions it", ["cv"]);
const role = claim("r1", "FACT", "Team Lead at Acme", ["li"], "current-role");
const sources = [
  { id: "li", url: "https://www.linkedin.com/in/jana" },
  { id: "cv", url: "cv:r" },
];

const sec = (over: Partial<BriefSection>): BriefSection => ({
  id: "x", title: "X", confidence: 0.7, confidence_reason: "r", claim_ids: [], source_ids: [], summary: "", ...over,
});

const brief = (cv: boolean): Brief => ({
  run_id: "r",
  per_question: [
    { question_id: "current-role", coverage: "evidenced", claim_ids: ["r1"], summary: "Team Lead at Acme." },
    ...(cv ? [{ question_id: CV_QUESTION_ID, coverage: "evidenced" as const, claim_ids: ["n1", "d1", "m1"], summary: "One CV date differs." }] : []),
  ],
  interview_questions: cv ? ["Your CV lists: Team Lead at Acme from 2020. The public LinkedIn shows: Team Lead at Acme since 2022. Could you walk us through it?"] : [],
  to_verify: cv ? [DIFF, "Leads a small team"] : ["Leads a small team"],
  not_searched: [],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
  headline: null,
  location_note: null,
  sections: [
    sec({ id: "current-role", title: "Current role", claim_ids: ["r1"] }),
    ...(cv ? [sec({ id: CV_QUESTION_ID, title: "CV vs public record", claim_ids: ["n1", "d1", "m1"], confidence_reason: "2 of 3 CV statements checked against public sources" })] : []),
  ],
});

const run = (cv: boolean): RunState => ({
  id: "0123456789abcdef",
  subject: "Jana Dvorakova",
  headline: null,
  role: "Data Engineer",
  position: null,
  organization_name: null,
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 2,
  candidates: [],
  claims: cv ? [role, notFound, diff, match] : [role],
  sources: cv ? sources : sources.slice(0, 1),
  questions: [{ id: "current-role", text: "Current role?" }, ...(cv ? [{ id: CV_QUESTION_ID, text: "Do the CV's roles match?" }] : [])],
  brief: brief(cv),
  failure: null,
  intake: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
});

const VERDICT = /fake|lie|inflat|dishonest|suspicious|fraud|trust/i;

describe("CV outcome labels", () => {
  it("maps each outcome to its plain-English label and Radar tone", () => {
    expect(CV_OUTCOME).toEqual({
      matches: { tone: "ok", label: "Matches public record" },
      differs: { tone: "unsure", label: "Differs — ask, don't assume" },
      "not-found": { tone: "neutral", label: "Not found publicly" },
    });
    expect(`${CV_EXPLAINER} ${Object.values(CV_OUTCOME).map((o) => o.label).join(" ")}`).not.toMatch(VERDICT);
  });

  it("orders rows matches, differences, not found", () => {
    expect(cvRows([notFound, diff, match], sources).map((r) => [r.claim.id, r.outcome])).toEqual([
      ["m1", "matches"],
      ["d1", "differs"],
      ["n1", "not-found"],
    ]);
  });

  it("counts the CV check claims and writes the summary line; null without a CV check", () => {
    expect(cvCounts(run(true))).toEqual({ matches: 1, differs: 1, "not-found": 1 });
    expect(cvSummaryLine(run(true))).toBe("CV: 1 statement matches the public record, 1 to ask about, 1 not found publicly.");
    expect(cvSummaryLine(run(false))).toBeNull();
    expect(cvDifferenceTexts(run(true))).toEqual(new Set([DIFF]));
  });
});

describe("CV vs public record section", () => {
  const render = (state: RunState): string =>
    renderToStaticMarkup(createElement(SectionList, { sections: state.brief?.sections ?? [], claims: state.claims, evidence: evidenceOf(state) }));

  it("shows the explainer and one outcome pill per claim, in outcome order", () => {
    const html = render(run(true));
    expect(html).toContain("CV vs public record");
    expect(html).toContain(CV_EXPLAINER);
    const at = (s: string): number => html.indexOf(s);
    expect(at("Matches public record")).toBeGreaterThan(-1);
    expect(at("Matches public record")).toBeLessThan(at("Differs — ask, don&#x27;t assume"));
    expect(at("Differs — ask, don&#x27;t assume")).toBeLessThan(at("Not found publicly"));
    expect(html).toContain("bg-ok-bg text-ok");
    expect(html).toContain("bg-unsure-bg text-unsure");
    expect(html).not.toMatch(VERDICT);
  });

  it("renders a run without a CV with no outcome pills and no explainer", () => {
    const html = render(run(false));
    expect(html).not.toContain(CV_EXPLAINER);
    expect(html).not.toMatch(/Matches public record|Not found publicly|Differs/);
  });
});

describe("summary, kit and reference questions", () => {
  it("adds the CV line to the 30-second summary and never counts the CV check as a research question", () => {
    expect(summary30s(run(true))?.documented).toBe("No profile confirmed yet; 1 of 1 research questions have evidence. CV: 1 statement matches the public record, 1 to ask about, 1 not found publicly.");
    expect(summary30s(run(false))?.documented).toBe("No profile confirmed yet; 1 of 1 research questions have evidence.");
  });

  it("labels each CV claim in the interview kit and lists the difference as a question", () => {
    const kit = interviewKit(run(true), "2026-10-09T00:00:00Z") ?? "";
    expect(kit).toContain(CV_EXPLAINER);
    expect(kit).toContain("- Matches public record · FACT: Data Engineer at Kiwi.com 2018-2022");
    expect(kit).toContain(`- Differs — ask, don't assume · INFERENCE: ${DIFF}`);
    expect(kit).toContain("- [ ] Your CV lists: Team Lead at Acme from 2020.");
    expect(interviewKit(run(false), "2026-10-09T00:00:00Z")).not.toMatch(/Matches public record|Differs —/);
  });

  it("never puts a CV difference to a referee", () => {
    const refs = referenceQuestions(run(true)) ?? "";
    expect(refs).not.toContain("Team Lead at Acme from 2020");
    expect(refs).toContain("Can you confirm: Leads a small team?");
  });
});
