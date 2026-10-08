/**
 * Tests for the POST /api/runs body contract (plans/006 profile-first start).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/run-body.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - profileUrl / cvText / subject + anchor alternatives; URL normalisation; CV length cap
 * - Extension compatibility: the old {subject, anchor, goal, sourceUrl} body still validates
 *
 * Design constraints:
 * - Pure schema tests; the route handler needs Workers bindings
 */
import { describe, expect, it } from "vitest";
import { CV_MAX, StartRunBody } from "@/app/api/_lib/run-body";

const ok = (body: unknown) => StartRunBody.safeParse(body);

describe("StartRunBody", () => {
  it("accepts a profile URL plus role and normalises it", () => {
    const r = ok({ goal: "hiring", role: "CMO", profileUrl: "https://cz.linkedin.com/in/josef-buryan?trk=x" });
    expect(r.success && r.data.profileUrl).toBe("https://www.linkedin.com/in/josef-buryan");
  });

  it("accepts a CV alone, capped at 20000 chars", () => {
    expect(ok({ goal: "hiring", role: "CMO", cvText: "Josef Buryan, CMO" }).success).toBe(true);
    expect(ok({ goal: "hiring", role: "CMO", cvText: "x".repeat(CV_MAX + 1) }).success).toBe(false);
  });

  it("rejects a body with neither profile, CV nor subject + anchor", () => {
    expect(ok({ goal: "hiring", role: "CMO" }).success).toBe(false);
    expect(ok({ goal: "hiring", role: "CMO", subject: "Josef Buryan" }).success).toBe(false);
  });

  it("rejects a non-profile LinkedIn URL", () => {
    expect(ok({ goal: "hiring", role: "CMO", profileUrl: "https://www.linkedin.com/company/groupon" }).success).toBe(false);
  });

  it("keeps the extension body working and uses a LinkedIn page as the profile for hiring", () => {
    const r = ok({ goal: "hiring", subject: "Josef Buryan", anchor: "Prague", sourceUrl: "https://cz.linkedin.com/in/josef-buryan/" });
    expect(r.success && r.data.profileUrl).toBe("https://www.linkedin.com/in/josef-buryan");
    const other = ok({ goal: "hiring", subject: "Josef Buryan", anchor: "Prague", sourceUrl: "https://example.com/team" });
    expect(other.success && other.data.profileUrl).toBeUndefined();
  });

  it("due-diligence still needs subject + anchor", () => {
    expect(ok({ goal: "due-diligence", subject: "Acme s.r.o.", anchor: "12345678" }).success).toBe(true);
    expect(ok({ goal: "due-diligence", profileUrl: "https://www.linkedin.com/in/josef-buryan" }).success).toBe(false);
  });
});

describe("StartRunBody positionId (specs/positions-start)", () => {
  const hiring = { goal: "hiring", profileUrl: "https://www.linkedin.com/in/josef-buryan" };

  it("S1: accepts positionId with a hiring goal and a profileUrl", () => {
    const r = ok({ ...hiring, positionId: "pos_abc-123" });
    expect(r.success && r.data.positionId).toBe("pos_abc-123");
  });

  it("S2: rejects empty, 65-char and unsafe-character ids", () => {
    for (const positionId of ["", "   ", "a".repeat(65), "a;b", "a b", "a'--"]) {
      expect(ok({ ...hiring, positionId }).success).toBe(false);
    }
    const trimmed = ok({ ...hiring, positionId: " abc " });
    expect(trimmed.success && trimmed.data.positionId).toBe("abc");
    expect(ok({ ...hiring, positionId: "a".repeat(64) }).success).toBe(true);
  });

  it("S3: rejects positionId with due-diligence", () => {
    expect(ok({ goal: "due-diligence", subject: "Acme s.r.o.", anchor: "12345678", positionId: "abc" }).success).toBe(false);
  });

  it("S4: positionId alone does not identify a candidate", () => {
    expect(ok({ goal: "hiring", positionId: "abc" }).success).toBe(false);
  });
});
