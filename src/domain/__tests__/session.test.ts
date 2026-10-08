/**
 * Tests for session tokens, hashes and cookies.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/session.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Token shape, hash determinism, cookie attributes, cookie parsing, expiry arithmetic
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  hashSessionToken,
  newSessionToken,
  readSessionCookie,
  sessionCookie,
  sessionExpiresAt,
} from "@/domain/session";

describe("session", () => {
  it("mints distinct 43-char base64url tokens", () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(a);
  });
  it("hashes to deterministic 64 hex chars", async () => {
    const h = await hashSessionToken("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashSessionToken("abc")).toBe(h);
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("builds the cookie, Secure only when asked", () => {
    const plain = sessionCookie("tok", { secure: false });
    for (const part of ["oldboys_session=tok", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=2592000"]) {
      expect(plain).toContain(part);
    }
    expect(plain).not.toContain("Secure");
    expect(sessionCookie("tok", { secure: true })).toContain("; Secure");
  });
  it("clears the cookie", () => {
    const c = clearSessionCookie({ secure: false });
    expect(c).toContain("oldboys_session=;");
    expect(c).toContain("Max-Age=0");
  });
  it("reads the cookie among others", () => {
    expect(readSessionCookie("a=b; oldboys_session=x; c=d")).toBe("x");
    expect(readSessionCookie("a=b")).toBeNull();
    expect(readSessionCookie(null)).toBeNull();
  });
  it("expires 30 days out", () => {
    expect(sessionExpiresAt(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-31T00:00:00.000Z");
  });
});
