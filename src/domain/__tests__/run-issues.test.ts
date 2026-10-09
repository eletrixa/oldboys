/**
 * Tests for the run issues reader.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/run-issues.test.ts
 * Deps:    vitest, src/domain/run-issues
 * Tested:  n/a
 */
import { describe, expect, it } from "vitest";
import { readRunIssues } from "@/domain/run-issues";

const row = (step: string, ref: unknown): { step: string; ref_json: string } => ({ step, ref_json: JSON.stringify(ref) });

describe("readRunIssues", () => {
  it("reads failed requests, budget notes and skips, gaps, degraded and unanswered rows in ledger order", () => {
    const rows = [
      row("serp_person", { notes: ["request failed: HTTP 429 from https://api.apify.com/x?token=1", "3 hits already in the run"] }),
      row("x_profile", { notes: ["run budget reached"] }),
      row("youtube_channel", { skipped: "run budget reached", spent: { calls: 18, usd: 0.4 } }),
      row("github_profile", { gap: true, reason: "no public GitHub profile found" }),
      row("synthesize_report", { degraded: "model unavailable" }),
      row("resolve_identity", { unanswered: true, note: "no lineup answer within 1 hour" }),
    ];
    expect(readRunIssues(rows)).toEqual([
      { step: "serp_person", kind: "request_failed", reason: "request failed: HTTP 429 from https://api.apify.com/x?token=1" },
      { step: "x_profile", kind: "budget", reason: "run budget reached" },
      { step: "youtube_channel", kind: "budget", reason: "run budget reached" },
      { step: "github_profile", kind: "gap", reason: "no public GitHub profile found" },
      { step: "synthesize_report", kind: "degraded", reason: "model unavailable" },
      { step: "resolve_identity", kind: "unanswered", reason: "no lineup answer within 1 hour" },
    ]);
  });

  it("keeps only the 'not searched' gap of a step whose requests all failed", () => {
    const rows = [
      row("linkedin_posts", { notes: ["request failed: HTTP 401"] }),
      row("linkedin_posts", { gap: true, reason: "not searched: request failed: HTTP 401" }),
    ];
    expect(readRunIssues(rows)).toEqual([{ step: "linkedin_posts", kind: "not_searched", reason: "request failed: HTTP 401" }]);
  });

  it("ignores the failure row, clean steps, malformed JSON and null columns", () => {
    const rows = [
      row("run", { failed: true, reason: "boom" }),
      row("serp_person", { notes: ["already fetched at seed"], sources: 3 }),
      { step: "x", ref_json: "{" },
      { step: null, ref_json: '{"gap":true,"reason":"r"}' },
      { step: "y", ref_json: null },
    ];
    expect(readRunIssues(rows)).toEqual([]);
  });
});
