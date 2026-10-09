/**
 * Body contract tests for POST and PATCH /api/positions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/position-body.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { CreatePositionBody, PatchPositionBody } from "@/app/api/_lib/position-body";

const mh = (id: string) => ({ id, text: "Has shipped X", accepted_evidence: ["repo"] });

describe("CreatePositionBody", () => {
  it("B1: accepts text only, URL only, both, and a title alone (manual); rejects empty, oversize and non-URL", () => {
    const ok = (v: unknown) => CreatePositionBody.safeParse(v).success;
    expect(ok({ postingText: "Senior dev wanted" })).toBe(true);
    expect(ok({ postingUrl: "https://www.jobs.cz/rpd/2000123456/" })).toBe(true);
    expect(ok({ postingText: "x", postingUrl: "https://example.com/job", title: "Dev" })).toBe(true);
    expect(ok({ title: "Dev" })).toBe(true);
    expect(ok({ title: "Dev", company: "Acme", location: "Brno" })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ company: "Acme" })).toBe(false);
    expect(ok({ title: "Dev", company: "x".repeat(201) })).toBe(false);
    expect(ok({ postingText: "x".repeat(20_001) })).toBe(false);
    expect(ok({ postingUrl: `https://example.com/${"a".repeat(500)}` })).toBe(false);
    expect(ok({ postingUrl: "not a url" })).toBe(false);
    expect(ok({ postingUrl: "javascript:alert(1)" })).toBe(false);
  });
});

describe("PatchPositionBody", () => {
  it("B2: accepts each single key; rejects empty, unknown keys, bad family, 6 or 0 must-haves, ids without mh-", () => {
    const ok = (v: unknown) => PatchPositionBody.safeParse(v).success;
    expect(ok({ title: "New title" })).toBe(true);
    expect(ok({ family: "data" })).toBe(true);
    expect(ok({ must_haves: [mh("mh-a")] })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ title: "T", extra: 1 })).toBe(false);
    expect(ok({ family: "legal" })).toBe(false);
    expect(ok({ must_haves: Array.from({ length: 6 }, (_, i) => mh(`mh-${String(i)}`)) })).toBe(false);
    expect(ok({ must_haves: [mh("python")] })).toBe(false);
    expect(ok({ must_haves: [] })).toBe(false);
  });
});
