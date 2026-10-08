/**
 * Tests for the candidate notice Markdown: content, degraded brief, no brief, escaping, exclusions and file name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/candidate-copy.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - candidateCopy: null without a brief; role, sources searched / not searched, confirmed links, deletion date, rights
 * - Never claims, summaries, interview questions, to-verify items, cost, excerpts or also_found hits
 * - Model text is escaped and non-http links are dropped
 * - noticeFileName: run id prefix only
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate, Claim } from "@/domain/claim";
import { candidateCopy, noticeFileName } from "../candidate-copy";
import type { RunState } from "../state";

const claim: Claim = {
  id: "c1", run_id: "r", question_id: "mh-exp", candidate_id: null, text: "Works at Acme since 2021", kind: "FACT",
  confidence: 0.9, quote: "q", supports: ["s1"], contradicts: [], rank: 0,
};

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: "k1", run_id: "r", name: "Jan Novak", profile_urls: ["https://www.linkedin.com/in/jnovak"], anchor_match: "Prague",
  score: 0.9, decision: "merge", platform: "linkedin", handle: "jnovak", snippet: "Data Engineer, Prague", reasons: ["city match"],
  ...over,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [{ question_id: "mh-exp", coverage: "evidenced", claim_ids: ["c1"], summary: "Five years of data work." }],
  interview_questions: ["Walk me through your last pipeline."],
  to_verify: ["Dates at Acme"],
  not_searched: [{ source: "facebook_profile", reason: "profile not opened (login needed); only search snippets were read" }],
  searched_empty: [{ source: "github_profile", reason: "no public repositories" }],
  removed_protected: 1,
  degraded: null,
  evidence: [{ step: "rest/x", url: "https://x.com/jnovak", excerpt: "jnovak posts about Spark" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://namesake.example/jan", excerpt: "Another Jan Novak, dentist" }],
  headline: "Senior Data Engineer at Acme",
  location_note: "Confirmed profile mentions Brno, you entered Prague",
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
  candidates: [candidate(), candidate({ id: "k2", decision: "possibly-same-as", platform: "instagram", profile_urls: ["https://instagram.com/other"] })],
  claims: [claim],
  sources: [{ id: "s1", url: "https://www.linkedin.com/in/jnovak" }],
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

const notice = (over: Partial<RunState> = {}): string => candidateCopy(run(over)) ?? "";

/** Text that must never reach the candidate, whatever the brief looks like. */
const FORBIDDEN = [
  "Works at Acme", "Five years of data work", "Walk me through", "Dates at Acme", "Senior Data Engineer at Acme",
  "Brno", "posts about Spark", "namesake.example", "dentist", "instagram.com/other", "$0.23", "0.234", "protected categories",
];

describe("candidateCopy", () => {
  it("returns null while there is no brief", () => {
    expect(candidateCopy(run({ brief: null }))).toBeNull();
  });

  it("says who, why, which sources, which links, the deletion date and how to object", () => {
    const md = notice();
    expect(md).toContain("Hello Jan Novak,");
    expect(md).toContain("the Senior Data Engineer role");
    expect(md).toContain("never rates you");
    expect(md).toContain("- LinkedIn\n");
    expect(md).toContain("- X\n");
    expect(md).toContain("- GitHub (nothing found that we could confirm as yours)");
    expect(md).toContain("- Facebook: profile not opened (login needed); only search snippets were read");
    expect(md).toContain("- <https://www.linkedin.com/in/jnovak>");
    expect(md).toContain("- <https://x.com/jnovak>");
    expect(md).toContain("deleted on 2026-10-15");
    expect(md).not.toContain("if we do not continue with your application");
    expect(md).toContain("Reply to this email");
    const order = [
      "## Why",
      "## Public sources we searched",
      "## Sources we did not search, and why",
      "## Public profiles and pages we confirmed as yours",
      "## How long we keep it",
      "## Your rights",
    ].map((h) => md.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("never includes claims, summaries, questions, cost, excerpts or unconfirmed namesake hits", () => {
    for (const degraded of [null, "model timeout"]) {
      const md = notice({ brief: brief({ degraded }) });
      for (const text of FORBIDDEN) expect(md).not.toContain(text);
    }
  });

  it("degraded brief: same notice, links from confirmed evidence, no model note", () => {
    const md = notice({ candidates: [], brief: brief({ degraded: "model timeout" }) });
    expect(md).not.toContain("model timeout");
    expect(md).toContain("- <https://x.com/jnovak>");
    expect(md).not.toContain("linkedin.com");
    expect(md).toContain("## Your rights");
  });

  it("nothing confirmed and no role: plain fallbacks, empty lists leave no heading", () => {
    const md = notice({
      role: null,
      candidates: [],
      brief: brief({ evidence: [], not_searched: [], searched_empty: [] }),
    });
    expect(md).toContain("the role you applied for");
    expect(md).toContain("We did not confirm any public profile as yours.");
    expect(md).not.toContain("## Public sources we searched");
    expect(md).not.toContain("## Sources we did not search");
  });

  it("escapes subject, role and gap text and drops non-http links", () => {
    const md = notice({
      subject: "**Jan** [x](javascript:alert(1))",
      role: "# Lead\nEngineer",
      candidates: [candidate({ profile_urls: ["https://www.linkedin.com/in/jnovak"] })],
      brief: brief({
        evidence: [{ step: "s", url: "javascript:alert(1)", excerpt: "e" }],
        not_searched: [{ source: "x_profile", reason: "<b>no</b> handle" }],
      }),
    });
    expect(md).toContain("Hello \\*\\*Jan\\*\\* \\[x\\](javascript:alert(1)),");
    expect(md).toContain("the \\# Lead Engineer role");
    expect(md).toContain("- X: \\<b\\>no\\</b\\> handle");
    expect(md).not.toContain("<javascript:");
    expect(md).not.toMatch(/[^\\]\]\(javascript:/);
  });

  it("scrubs URLs and e-mails out of not-searched reasons", () => {
    const md = notice({
      brief: brief({
        not_searched: [
          {
            source: "openalex_author",
            reason: "lookup at https://api.openalex.org/authors?search=Jan%20Novak&mailto=ops@example.org timed out, ask hr@example.com",
          },
        ],
      }),
    });
    expect(md).toContain("- OpenAlex: lookup at api.openalex.org timed out, ask (email)");
    for (const leak of ["search=", "Jan%20Novak", "mailto", "ops@example.org", "hr@example.com"]) expect(md).not.toContain(leak);
  });

  it("falls back to the plain 7-day wording when created_at does not parse", () => {
    expect(notice({ created_at: "yesterday" })).toContain("deleted 7 days after the research");
  });
});

describe("noticeFileName", () => {
  it("uses the run id prefix, never the subject's name", () => {
    const name = noticeFileName(run());
    expect(name).toBe("candidate-notice-01234567.md");
    expect(name.toLowerCase()).not.toContain("novak");
  });
});
