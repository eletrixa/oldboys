/**
 * Tests for IČO normalisation and checksum.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/ico.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Valid, padded, spaced and invalid inputs
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { isValidIco, normalizeIco } from "@/domain/ico";

describe("normalizeIco", () => {
  it("accepts valid 8-digit ids", () => {
    expect(normalizeIco("27074358")).toBe("27074358");
    expect(normalizeIco("00006947")).toBe("00006947");
    expect(normalizeIco("25596641")).toBe("25596641");
  });
  it("left-pads short ids", () => {
    expect(normalizeIco("6947")).toBe("00006947");
  });
  it("ignores spaces", () => {
    expect(normalizeIco("270 743 58")).toBe("27074358");
  });
  it("rejects a bad checksum, non-digits, too long and empty input", () => {
    expect(normalizeIco("12345678")).toBeNull();
    expect(normalizeIco("abc")).toBeNull();
    expect(normalizeIco("270743581")).toBeNull();
    expect(normalizeIco("")).toBeNull();
  });
});

describe("isValidIco", () => {
  it("needs exactly 8 digits", () => {
    expect(isValidIco("27074358")).toBe(true);
    expect(isValidIco("2707435")).toBe(false);
    expect(isValidIco("12345678")).toBe(false);
  });
});
