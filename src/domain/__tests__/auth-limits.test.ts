/**
 * Tests for auth rate-limit helpers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/auth-limits.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Window arithmetic and client IP extraction
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { HOUR_MS, clientIp, since } from "@/domain/auth-limits";

describe("auth-limits", () => {
  it("subtracts the window", () => {
    expect(since(new Date("2026-01-01T12:00:00.000Z"), HOUR_MS)).toBe("2026-01-01T11:00:00.000Z");
  });
  it("reads CF-Connecting-IP trimmed, else unknown", () => {
    expect(clientIp(new Headers({ "CF-Connecting-IP": " 1.2.3.4 " }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
