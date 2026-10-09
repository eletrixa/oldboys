/**
 * Tests for the "Issues so far" card: nothing for a clean run, counts and one line per issue otherwise.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/issues-card.test.ts
 * Deps:    vitest, react, react-dom/server, src/app/runs/[id]/issues-card
 * Tested:  n/a (test file)
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RunIssue } from "@/domain/run-issues";
import { IssuesCard } from "../issues-card";

const html = (issues: RunIssue[]): string => renderToStaticMarkup(createElement(IssuesCard, { issues }));

describe("IssuesCard", () => {
  it("renders nothing for a clean run", () => {
    expect(html([])).toBe("");
  });

  it("shows the counts, one line per issue with the raw reason on hover, and the gap note", () => {
    const out = html([
      { step: "serp_person", kind: "request_failed", reason: "request failed: HTTP 429 from api.apify.com" },
      { step: "linkedin_posts", kind: "not_searched", reason: "request failed: HTTP 401" },
      { step: "github_profile", kind: "gap", reason: "no confirmed handle or id to look up" },
    ]);
    expect(out).toContain('role="status"');
    expect(out).toContain("Issues so far: 1 request failed · 1 source skipped · 1 searched, nothing found");
    expect(out).toContain("Web search: the service refused our request (HTTP 429)");
    expect(out).toContain("LinkedIn posts: not searched, the service refused our request (HTTP 401)");
    expect(out).toContain("GitHub: no confirmed profile to look up");
    expect(out).toContain('title="request failed: HTTP 401"');
    expect(out).toContain("never a mark against the person");
  });
});
