/**
 * Tests for the intake tag create body and the duplicate-key classifier.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/tags/__tests__/tag-body.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - TagBody: tag normalised then checked against IntakeTag, role 1..300, goal default hiring, offer id optional and capped
 * - duplicateField: names the colliding column from a D1 UNIQUE error, null for any other error
 *
 * Design constraints:
 * - Pure: no D1, no Next.js
 */
import { describe, expect, it } from "vitest";
import { duplicateField, TagBody } from "../tag-body";

describe("TagBody", () => {
  it("defaults the goal to hiring and trims the role", () => {
    expect(TagBody.parse({ tag: "senior-be", role: "  Senior Backend Engineer " })).toEqual({
      tag: "senior-be",
      role: "Senior Backend Engineer",
      goal: "hiring",
    });
  });
  it("lowercases and trims the tag before the IntakeTag check", () => {
    expect(TagBody.parse({ tag: " Senior-BE ", role: "x" }).tag).toBe("senior-be");
  });
  it("rejects a malformed tag, an empty or over-long role, an unknown goal and a long offer id", () => {
    expect(TagBody.safeParse({ tag: "-x", role: "x" }).success).toBe(false);
    expect(TagBody.safeParse({ tag: "a", role: "x" }).success).toBe(false);
    expect(TagBody.safeParse({ tag: "ok-tag", role: "  " }).success).toBe(false);
    expect(TagBody.safeParse({ tag: "ok-tag", role: "x".repeat(301) }).success).toBe(false);
    expect(TagBody.safeParse({ tag: "ok-tag", role: "x", goal: "dating" }).success).toBe(false);
    expect(TagBody.safeParse({ tag: "ok-tag", role: "x", startupjobsOfferId: "9".repeat(41) }).success).toBe(false);
  });
  it("accepts due-diligence and an offer id", () => {
    expect(TagBody.parse({ tag: "ok-tag", role: "x".repeat(300), goal: "due-diligence", startupjobsOfferId: "8123" })).toMatchObject({
      goal: "due-diligence",
      startupjobsOfferId: "8123",
    });
  });
});

describe("duplicateField", () => {
  it("names the colliding column", () => {
    expect(duplicateField(new Error("D1_ERROR: UNIQUE constraint failed: intake_tags.tag: SQLITE_CONSTRAINT"))).toBe("tag");
    expect(duplicateField(new Error("D1_ERROR: UNIQUE constraint failed: intake_tags.startupjobs_offer_id"))).toBe("startupjobs_offer_id");
  });
  it("is null for other errors", () => {
    expect(duplicateField(new Error("D1_ERROR: no such table: intake_tags"))).toBeNull();
    expect(duplicateField("UNIQUE constraint failed: intake_tags.tag")).toBeNull();
  });
});
