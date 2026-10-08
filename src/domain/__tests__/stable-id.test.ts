/**
 * Tests for stableId: deterministic, part-sensitive, fixed width.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/stable-id.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { stableId } from "@/domain/stable-id";

describe("stableId", () => {
  it("gives the same 16-hex id for the same parts", () => {
    expect(stableId("run-1", "seed", "cv:run-1")).toBe(stableId("run-1", "seed", "cv:run-1"));
    expect(stableId("run-1", "seed", "cv:run-1")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes with any part and with how the parts are split", () => {
    const a = stableId("run-1", "seed", "x");
    expect(stableId("run-2", "seed", "x")).not.toBe(a);
    expect(stableId("run-1", "seed", "y")).not.toBe(a);
    expect(stableId("run-1", "seedx", "")).not.toBe(stableId("run-1", "seed", "x"));
  });

  it("matches the FNV-1a 64 reference value for the empty string", () => {
    expect(stableId("")).toBe("cbf29ce484222325");
  });
});
