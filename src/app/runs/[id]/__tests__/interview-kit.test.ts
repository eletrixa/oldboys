/**
 * Tests for the interview kit Markdown: sections, empty lists, degraded brief, escaping and the file name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/interview-kit.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - interviewKit: null without a brief; header, coverage, checklist, gaps, footer in order
 * - Empty lists leave no heading; degraded brief shows the note, role criteria and evidence links
 * - also_found never reaches the kit; model text is escaped and non-http links are dropped
 * - Sections replace coverage, by confidence with the reason; facts before inferences; source-only links
 * - Phone verification: latest call with answers, one line per question, escaped, MOCK noted; none without calls
 * - kitFileName: run id prefix only
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { Brief, Claim } from "@/domain/claim";
import type { CallView } from "../call-panel";
import { interviewKit, kitFileName } from "../interview-kit";
import type { RunState } from "../state";

const AT = "2026-10-08T21:30:00.000Z";

const claim = (id: string, text: string, supports: string[], kind: Claim["kind"] = "FACT"): Claim => ({
  id, run_id: "r", question_id: "mh-exp", candidate_id: null, text, kind, confidence: 0.9, quote: "q", supports, contradicts: [], rank: 0,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [{ question_id: "mh-exp", coverage: "evidenced", claim_ids: ["c1"], summary: "Five years of data work." }],
  interview_questions: ["Walk me through your last pipeline."],
  to_verify: ["Dates at Acme"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [{ source: "github_profile", reason: "no public repositories" }],
  removed_protected: 0,
  degraded: null,
  evidence: [{ step: "rest/github", url: "https://github.com/jnovak", excerpt: "jnovak: 12 repositories" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://namesake.example/jan", excerpt: "Another Jan Novak, dentist" }],
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
  candidates: [],
  claims: [claim("c1", "Works at Acme since 2021", ["s1"])],
  sources: [{ id: "s1", url: "https://www.linkedin.com/in/jnovak" }],
  questions: [{ id: "mh-exp", text: "Has five years of data engineering" }],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0.234, source_calls: 7, llm_calls: 4, duration_ms: 192_000 },
  ...over,
});

const kit = (over: Partial<RunState> = {}): string => interviewKit(run(over), AT) ?? "";

describe("interviewKit", () => {
  it("returns null while there is no brief", () => {
    expect(interviewKit(run({ brief: null }), AT)).toBeNull();
  });

  it("has header, coverage, checklist, gaps and footer in order", () => {
    const md = kit();
    expect(md).toContain("Hiring for: Senior Data Engineer");
    expect(md).toContain("Confirmed profile: Senior Data Engineer at Acme");
    expect(md).toContain("Generated: 2026-10-08");
    expect(md).toContain("Research: $0.23 · 7 source calls · 4 AI calls · 3 min 12 s");
    expect(md).toContain("### Has five years of data engineering");
    expect(md).toContain("Coverage: evidenced");
    expect(md).toContain("- FACT: Works at Acme since 2021 (<https://www.linkedin.com/in/jnovak>)");
    expect(md).toContain("- [ ] Walk me through your last pipeline.\n  Notes:");
    expect(md).toContain("- [ ] Dates at Acme");
    expect(md).toContain("- GitHub: no public repositories");
    expect(md).toContain("- X: no confirmed handle");
    const order = [
      "# Interview kit",
      "## What the research covered",
      "## Questions for the interview",
      "## To verify",
      "## Searched, nothing found",
      "## Not searched, and why",
      "_This kit rates the research, never the candidate.",
    ].map((h) => md.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(md).not.toContain("protected categories");
  });

  it("leaves out headings whose list is empty", () => {
    const md = kit({
      role: null,
      brief: brief({ per_question: [], interview_questions: [], to_verify: [], not_searched: [], searched_empty: [], headline: null }),
    });
    for (const h of ["Hiring for", "Confirmed profile", "## What the research covered", "## Questions", "## To verify", "## Searched", "## Not searched"]) {
      expect(md).not.toContain(h);
    }
    expect(md).toContain("# Interview kit");
  });

  it("degraded brief: the note, role criteria and evidence links instead of coverage", () => {
    const md = kit({ brief: brief({ degraded: "model timeout", removed_protected: 2 }) });
    expect(md).toContain("AI summary unavailable: model timeout");
    expect(md).toContain("- Has five years of data engineering");
    expect(md).toContain("- jnovak: 12 repositories (<https://github.com/jnovak>)");
    expect(md).not.toContain("Coverage: evidenced");
    expect(md).toContain("2 items removed (protected categories)");
  });

  it("lists sections by confidence instead of coverage, facts before inferences", () => {
    const section = (id: string, title: string, confidence: number, claim_ids: string[], source_ids: string[]): Brief["sections"][number] => ({
      id, title, confidence, confidence_reason: `reason ${id}`, claim_ids, source_ids, summary: `summary ${id}`,
    });
    const md = kit({
      claims: [claim("c2", "Probably leads a team", [], "INFERENCE"), claim("c1", "Works at Acme since 2021", ["s1"])],
      sources: [{ id: "s1", url: "https://www.linkedin.com/in/jnovak" }, { id: "s2", url: "https://www.instagram.com/jnovak" }],
      brief: brief({
        sections: [section("social-presence", "Social presence", 0.4, [], ["s2"]), section("mh-exp", "Data engineering", 0.82, ["c2", "c1"], ["s1"])],
      }),
    });
    expect(md).toContain("## What the research found");
    expect(md).not.toContain("Coverage: evidenced");
    expect(md.indexOf("### Data engineering")).toBeLessThan(md.indexOf("### Social presence"));
    expect(md).toContain("Research confidence: 82% (strong), reason mh-exp");
    expect(md).toContain("Research confidence: 40% (weak), reason social-presence");
    expect(md.indexOf("- FACT: Works at Acme")).toBeLessThan(md.indexOf("- INFERENCE: Probably leads a team"));
    expect(md).toContain("- <https://www.instagram.com/jnovak>");
  });

  it("never includes unconfirmed namesake hits", () => {
    for (const degraded of [null, "no key"]) {
      const md = kit({ brief: brief({ degraded }) });
      expect(md).not.toContain("namesake.example");
      expect(md).not.toContain("dentist");
    }
  });

  it("escapes model text and drops non-http links", () => {
    const md = kit({
      claims: [claim("c1", "**bold** # head [x](javascript:alert(1))\nnext line", ["s1"])],
      sources: [{ id: "s1", url: "javascript:alert(1)" }],
      brief: brief({ interview_questions: ["# Not a heading"] }),
    });
    expect(md).toContain("- FACT: \\*\\*bold\\*\\* \\# head \\[x\\](javascript:alert(1)) next line\n");
    expect(md).not.toContain("<javascript:");
    expect(md).toContain("- [ ] \\# Not a heading");
    expect(md).not.toMatch(/[^\\]\]\(javascript:/);
  });
});

const call = (over: Partial<CallView> = {}): CallView => ({
  id: "call-1",
  run_id: "r",
  status: "done",
  provider: "elevenlabs",
  provider_conversation_id: "conv",
  to_number_masked: "+420*****456",
  brief: { language: "en", identity_question: "Am I speaking with Jan Novak?", questions: [], script: "x" },
  call_successful: true,
  identity_confirmed: true,
  duration_secs: 120,
  cost_usd: 0.1,
  failure_reason: null,
  last_error: null,
  created_at: "2026-10-09T08:00:00.000Z",
  approved_at: "2026-10-09T08:01:00.000Z",
  finished_at: "2026-10-09T08:03:00.000Z",
  answers: [
    { question_id: "mh-1", question: "Tell me about Go?", status: "answered", summary: "Uses *Go* daily.", quote: "I used it every day", at_secs: 83 },
    { question_id: "tv-1", question: "Led a team at Acme?", status: "unclear", summary: "Led some people.", quote: null, at_secs: null },
    { question_id: "hr-1", question: "Why did you leave?", status: "declined", summary: null, quote: null, at_secs: null },
  ],
  ...over,
});

const PHONE = "## Phone verification (said by the candidate, not public evidence)";

describe("interviewKit phone verification", () => {
  it("is left out without calls", () => {
    expect(kit()).not.toContain("Phone verification");
    expect(interviewKit(run(), AT, [call({ answers: null }), call({ status: "skipped" })])).not.toContain("Phone verification");
  });

  it("lists every question of the latest call with answers before the footer", () => {
    const md = interviewKit(run(), AT, [call({ id: "newer", answers: null }), call()]) ?? "";
    expect(md).toContain(`${PHONE}\n\n- Answered: Uses \\*Go\\* daily. — "I used it every day" (at 1:23)\n- Unclear: Led some people.\n- Declined: Why did you leave?\n`);
    expect(md.indexOf(PHONE)).toBeGreaterThan(md.indexOf("## Not searched, and why"));
    expect(md.indexOf(PHONE)).toBeLessThan(md.indexOf("---"));
    expect(md).not.toContain("MOCK");
  });

  it("notes a MOCK call", () => {
    expect(interviewKit(run(), AT, [call({ provider: "mock" })])).toContain("_MOCK call: the answers are simulated._");
  });
});

describe("kitFileName", () => {
  it("uses the run id prefix, never the subject's name", () => {
    const name = kitFileName(run());
    expect(name).toBe("interview-kit-01234567.md");
    expect(name.toLowerCase()).not.toContain("novak");
  });
});
