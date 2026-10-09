/**
 * Tests for the run issues lines.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/issues-text.test.ts
 * Deps:    vitest, src/app/runs/[id]/issues-text
 * Tested:  n/a
 */
import { describe, expect, it } from "vitest";
import type { RunIssue } from "@/domain/run-issues";
import { issueCounts, issueLine, issueSummary } from "../issues-text";

const issues: RunIssue[] = [
  { step: "serp_person", kind: "request_failed", reason: "request failed: HTTP 429 from api.apify.com" },
  { step: "serp_person", kind: "request_failed", reason: "request failed: fetch failed" },
  { step: "linkedin_posts", kind: "not_searched", reason: "request failed: HTTP 401" },
  { step: "youtube_channel", kind: "budget", reason: "run budget reached" },
  { step: "github_profile", kind: "gap", reason: "no confirmed handle or id to look up" },
  { step: "synthesize_report", kind: "degraded", reason: "model unavailable" },
];

describe("issueSummary", () => {
  it("counts failed requests, skipped sources, empty searches and AI off, worst first", () => {
    expect(issueCounts(issues)).toEqual({ failed: 2, skipped: 2, empty: 1, degraded: 1, unanswered: 0 });
    expect(issueSummary(issues)).toBe("2 requests failed · 2 sources skipped · 1 searched, nothing found · AI unavailable");
    expect(issueSummary(issues.slice(0, 1))).toBe("1 request failed");
  });
  it("is null for a clean run", () => {
    expect(issueSummary([])).toBeNull();
  });
});

describe("issueLine", () => {
  it("names the step and says what happened in plain words", () => {
    expect(issues.map(issueLine)).toEqual([
      "Web search: the service refused our request (HTTP 429)",
      "Web search: the service did not answer",
      "LinkedIn posts: not searched, the service refused our request (HTTP 401)",
      "YouTube: skipped, the run budget was reached",
      "GitHub: no confirmed profile to look up",
      "synthesize_report: AI unavailable (model unavailable)",
    ]);
  });
});
