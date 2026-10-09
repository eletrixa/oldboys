/**
 * Tests for the shared digest, error-text and application helper exports.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/digest.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - sha256Hex over string and buffer, toHex, errorText, joinNotes, toCvFile defaults, isPdf
 *
 * Design constraints:
 * - Known SHA-256 vector for "abc"
 */
import { describe, expect, it } from "vitest";
import { CV_MAX_BYTES, joinNotes, NOTE_MAX, toCvFile } from "../application";
import { isPdf } from "../cv-kind";
import { sha256Hex, toHex } from "../digest";
import { errorText } from "../error-text";

describe("digest", () => {
  it("sha256Hex matches the known vector for a string and for the same bytes", async () => {
    const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(await sha256Hex("abc")).toBe(expected);
    expect(await sha256Hex(new TextEncoder().encode("abc").buffer)).toBe(expected);
  });
  it("toHex pads single digits", () => {
    expect(toHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
});

describe("errorText", () => {
  it("uses the message of an Error, String() otherwise, and cuts to max", () => {
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText(42)).toBe("42");
    expect(errorText(new Error("x".repeat(400)), 10)).toBe("x".repeat(10));
  });
});

describe("application helpers", () => {
  it("joinNotes drops empties, joins with '; ' and cuts to NOTE_MAX", () => {
    expect(joinNotes(null, undefined, "", "a", "b")).toBe("a; b");
    expect(joinNotes(null, "")).toBeNull();
    expect(joinNotes("x".repeat(NOTE_MAX + 5))).toHaveLength(NOTE_MAX);
  });
  it("toCvFile applies the defaults and keeps given values", () => {
    const bytes = new ArrayBuffer(4);
    expect(toCvFile({ bytes })).toEqual({ bytes, filename: "cv.pdf", contentType: "application/pdf" });
    expect(toCvFile({ bytes, filename: " me.PDF ", contentType: "application/pdf; x" })).toMatchObject({ filename: "me.PDF", contentType: "application/pdf; x" });
    expect(CV_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
  it("isPdf accepts the media type or the extension", () => {
    expect(isPdf({ filename: "a.PDF", contentType: "application/octet-stream" })).toBe(true);
    expect(isPdf({ filename: "a.bin", contentType: "application/pdf" })).toBe(true);
    expect(isPdf({ filename: "a.docx", contentType: "application/msword" })).toBe(false);
  });
});
