/**
 * Tests for PBKDF2 password hashing.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/password.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Roundtrip, wrong password, salt randomness, stored format, malformed input
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/domain/password";

describe("password", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const h = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong horse", h)).toBe(false);
  });
  it("uses a random salt", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
  it("stores pbkdf2$iterations$salt$hash", async () => {
    expect(await hashPassword("x")).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });
  it("returns false on malformed input without throwing", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$1$a")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$100000$!!!$!!!")).toBe(false);
  });
});
