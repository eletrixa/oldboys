/**
 * Tests for the GDPR Art. 15 data access export of a run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/access-export.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Only merged sources and merged candidates; never unverified sources, namesakes or brief.also_found
 * - Claims only when backed by confirmed sources; Art. 9 claims dropped without a trace
 * - Call transcripts keep no URL (no conversation id); brief text with question text; retention, legal basis
 * - No e-mail or phone number leaks from excluded places
 *
 * Design constraints:
 * - Fixtures stay inline and synthetic (no real people)
 */
import { describe, expect, it } from "vitest";
import { accessExport, CALL_TRANSCRIPT_KIND, NOT_INCLUDED, type AccessExportRows } from "@/domain/access-export";
import { LEGAL_BASIS, RETENTION_DAYS } from "@/domain/audit";
import { CALL_SOURCE_ACTOR } from "@/workflow/calls";

const START = "2026-10-08T20:00:00.000Z";
const NOW = "2026-10-09T01:00:00.000Z";
const CONVERSATION = "conv_7f3a9d2e41";

const OWN_SITE = "https://example.test/jana";
const OWN_GITHUB = "https://github.com/jana-test-dev";
const NAMESAKE_PAGE = "https://namesake.example/other-jana";
const NAMESAKE_SNIPPET = "Other Jana, florist in Ostrava, florist.jana@example.org, +420 777 123 456";
const ALSO_FOUND_URL = "https://also.example/jana-unconfirmed";
const ALSO_FOUND_EXCERPT = "Unconfirmed Jana, call +420 601 222 333";

function briefObject(): Record<string, unknown> {
  return {
    run_id: "run-1",
    per_question: [
      { question_id: "q_backend", coverage: "evidenced", claim_ids: ["c-own"], summary: "Maintains a Go service on GitHub." },
      { question_id: "q_extra", coverage: "partial", claim_ids: [], summary: "Mentions team lead work on the own site." },
    ],
    interview_questions: ["Which parts of the Go service did you build yourself?"],
    to_verify: ["Current employer"],
    not_searched: [],
    removed_protected: 1,
    evidence: [
      { step: "github_profile", url: OWN_GITHUB, excerpt: "Go service, 120 stars" },
      { step: "serp_person", url: NAMESAKE_PAGE, excerpt: NAMESAKE_SNIPPET },
    ],
    also_found: [{ step: "serp_person", url: ALSO_FOUND_URL, excerpt: ALSO_FOUND_EXCERPT }],
    headline: "Backend engineer at Example Labs",
    location_note: null,
    sections: [{ id: "s1", title: "Open source", confidence: 0.8, confidence_reason: "two sources", claim_ids: ["c-own"], source_ids: ["s-gh"], summary: "Active Go maintainer." }],
  };
}

function brief(): string {
  return JSON.stringify(briefObject());
}

function rows(over: Partial<AccessExportRows> = {}): AccessExportRows {
  return {
    run: {
      id: "run-1",
      subject: "Jana Testová",
      anchor: "Brno",
      goal: "hiring",
      role: "Senior backend engineer",
      created_at: START,
      organization_name: "Example Labs s.r.o.",
    },
    questions: [
      { id: "q_backend", text: "Has the candidate shipped backend services?" },
      { id: "q_extra", text: "Has the candidate led a team?" },
    ],
    sources: [
      { id: "s-site", url: OWN_SITE, actor: "apify/website-content-crawler", fetched_at: START, excerpt: "Jana Testová, backend engineer", identity: "merged" },
      { id: "s-gh", url: OWN_GITHUB, actor: "rest/github", fetched_at: START, excerpt: "Go service, 120 stars", identity: "merged" },
      { id: "s-other", url: NAMESAKE_PAGE, actor: "apify/google-search-scraper", fetched_at: START, excerpt: NAMESAKE_SNIPPET, identity: "unverified" },
      {
        id: "src-call-1",
        url: `https://elevenlabs.io/app/conversational-ai/history/${CONVERSATION}`,
        actor: CALL_SOURCE_ACTOR.elevenlabs,
        fetched_at: START,
        excerpt: "Yes, I worked at Example Labs since 2023.",
        identity: "merged",
      },
    ],
    candidates: [
      { id: "cand-me", platform: "github", profile_urls_json: JSON.stringify([OWN_GITHUB]), snippet: "Go, Brno", decision: "merge" },
      { id: "cand-no", platform: "linkedin", profile_urls_json: JSON.stringify(["https://linkedin.example/in/rejected-jana"]), snippet: "Rejected namesake snippet", decision: "rejected" },
      { id: "cand-maybe", platform: "x", profile_urls_json: JSON.stringify(["https://x.example/maybe_jana"]), snippet: "Maybe-same snippet", decision: "possibly-same-as" },
    ],
    claims: [
      { id: "c-own", candidate_id: null, kind: "FACT", text: "Maintains a Go service.", quote: "Go service", confidence: 0.9, supports_json: JSON.stringify(["s-gh", "s-site"]) },
      { id: "c-other", candidate_id: null, kind: "FACT", text: "Works as a florist.", quote: "florist", confidence: 0.6, supports_json: JSON.stringify(["s-gh", "s-other"]) },
      { id: "c-art9", candidate_id: null, kind: "INFERENCE", text: "Took a long health break in 2022.", quote: null, confidence: 0.4, supports_json: "[]" },
      { id: "c-infer", candidate_id: null, kind: "INFERENCE", text: "Likely prefers backend work.", quote: null, confidence: 0.5, supports_json: "[]" },
      { id: "c-call", candidate_id: null, kind: "STATEMENT", text: "Says they work at Example Labs.", quote: "Example Labs", confidence: 0.7, supports_json: JSON.stringify(["src-call-1"]) },
      { id: "c-namesake", candidate_id: "cand-no", kind: "INFERENCE", text: "Namesake inference.", quote: null, confidence: 0.3, supports_json: "[]" },
    ],
    brief_json: brief(),
    call_actors: Object.values(CALL_SOURCE_ACTOR),
    ...over,
  };
}

describe("accessExport", () => {
  it("keeps only merged sources and merged candidates; namesakes and also_found never appear", () => {
    const out = accessExport(rows(), NOW);
    const json = JSON.stringify(out);
    expect(out.sources_about_you.map((s) => s.id)).toEqual(["s-site", "s-gh", "src-call-1"]);
    expect(out.profiles_linked_to_you).toEqual([{ platform: "github", url: OWN_GITHUB, snippet: "Go, Brno" }]);
    for (const absent of [NAMESAKE_PAGE, NAMESAKE_SNIPPET, ALSO_FOUND_URL, ALSO_FOUND_EXCERPT, "rejected-jana", "Rejected namesake snippet", "maybe_jana", "Maybe-same snippet"]) {
      expect(json).not.toContain(absent);
    }
  });

  it("keeps claims backed only by confirmed sources and drops Art. 9 claims without a trace", () => {
    const out = accessExport(rows(), NOW);
    expect(out.claims.map((c) => c.id)).toEqual(["c-own", "c-infer", "c-call"]);
    expect(out.claims[0]).toMatchObject({ kind: "FACT", quote: "Go service", source_ids: ["s-gh", "s-site"], source_urls: [OWN_GITHUB, OWN_SITE] });
    const json = JSON.stringify(out);
    expect(json).not.toContain("florist");
    expect(json).not.toContain("health");
    expect(json).not.toContain("removed_protected");
    expect(json).not.toContain("Namesake inference");
  });

  it("shows a call transcript without its URL or conversation id", () => {
    const out = accessExport(rows(), NOW);
    const call = out.sources_about_you.find((s) => s.id === "src-call-1");
    expect(call).toMatchObject({ url: null, kind: CALL_TRANSCRIPT_KIND, excerpt: "Yes, I worked at Example Labs since 2023." });
    expect(out.claims.find((c) => c.id === "c-call")).toMatchObject({ source_ids: ["src-call-1"], source_urls: [] });
    const json = JSON.stringify(out);
    expect(json).not.toContain(CONVERSATION);
    expect(json).not.toContain("elevenlabs.io/app");
  });

  it("carries the brief text with question text, and no also_found or unverified evidence", () => {
    const b = accessExport(rows(), NOW).brief;
    expect(b).toEqual({
      headline: "Backend engineer at Example Labs",
      location_note: null,
      per_question: [
        { question: "Has the candidate shipped backend services?", summary: "Maintains a Go service on GitHub." },
        { question: "Has the candidate led a team?", summary: "Mentions team lead work on the own site." },
      ],
      sections: [{ title: "Open source", summary: "Active Go maintainer." }],
      interview_questions: ["Which parts of the Go service did you build yourself?"],
      to_verify: ["Current employer"],
      evidence: [{ url: OWN_GITHUB, excerpt: "Go service, 120 stars" }],
    });
  });

  it("drops brief lines on an Art. 9 topic and reads a missing or broken brief as null", () => {
    const withArt9 = JSON.stringify({ ...briefObject(), to_verify: ["Current employer", "Religious holidays"] });
    expect(accessExport(rows({ brief_json: withArt9 }), NOW).brief?.to_verify).toEqual(["Current employer"]);
    expect(accessExport(rows({ brief_json: null }), NOW).brief).toBeNull();
    expect(accessExport(rows({ brief_json: "{not json" }), NOW).brief).toBeNull();
  });

  it("sets the deletion date to created_at + 7 days and handles an unreadable created_at", () => {
    expect(accessExport(rows(), NOW).retention).toEqual({ days: RETENTION_DAYS, delete_after: "2026-10-15T20:00:00.000Z" });
    const broken = rows();
    expect(accessExport({ ...broken, run: { ...broken.run, created_at: "not a date" } }, NOW).retention.delete_after).toBe("");
  });

  it("states legal basis, purpose, controller and the not-included list", () => {
    const out = accessExport(rows(), NOW);
    expect(out.format).toBe("oldboys.access-export/1");
    expect(out.generated_at).toBe(NOW);
    expect(out.legal_basis).toBe(LEGAL_BASIS);
    expect(out.purpose).toBe("Pre-employment screening by Example Labs s.r.o. for the role: Senior backend engineer");
    expect(out.run.organization).toBe("Example Labs s.r.o.");
    expect(out.not_included).toEqual(NOT_INCLUDED);
    expect(out.not_included.some((l) => l.startsWith("Pages and profiles we could not confirm as yours"))).toBe(true);
    const base = rows();
    expect(accessExport({ ...base, run: { ...base.run, organization_name: null } }, NOW).run.organization).toBeNull();
  });

  it("leaks no e-mail address or phone number that sits only in excluded places", () => {
    const json = JSON.stringify(accessExport(rows(), NOW));
    expect(/[\w.+-]+@[\w-]+\.[\w.]+/.test(json)).toBe(false);
    expect(/\+?\d[\d ]{7,}\d/.test(json)).toBe(false);
  });
});
