/**
 * Tests for the pure apply-form validation helpers shared by the client form and the /api/apply handler.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/__tests__/apply-fields.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover required fields, LinkedIn URL shape, CV type (media type or .pdf name) and the 10 MiB size, the "LinkedIn or CV" rule and length caps
 *
 * Design constraints:
 * - Pure Node tests: File objects only, no DOM
 */
import { describe, expect, it } from "vitest";
import { CV_MAX_BYTES } from "@/domain/application";
import { checkApply, MESSAGES, type ApplyDraft } from "../apply-fields";

const pdf = (size = 1000, name = "cv.pdf", type = "application/pdf"): File => new File([new Uint8Array(size)], name, { type });
const ok: ApplyDraft = { name: "Josef Buryan", email: "josef@mail.test", linkedinUrl: "linkedin.com/in/josef-buryan", cv: null, message: "" };

describe("checkApply", () => {
  it("passes with LinkedIn only, with a CV only, and with both", () => {
    expect(checkApply(ok)).toBeNull();
    expect(checkApply({ ...ok, linkedinUrl: "", cv: pdf() })).toBeNull();
    expect(checkApply({ ...ok, cv: pdf() })).toBeNull();
  });

  it("requires a name and a plausible email", () => {
    expect(checkApply({ ...ok, name: "   " })).toBe(MESSAGES.name);
    expect(checkApply({ ...ok, email: "" })).toBe(MESSAGES.email);
    expect(checkApply({ ...ok, email: "not an email" })).toBe(MESSAGES.email);
    expect(checkApply({ ...ok, name: "x".repeat(201) })).toBe(MESSAGES.name);
    expect(checkApply({ ...ok, email: `${"x".repeat(200)}@mail.test` })).toBe(MESSAGES.email);
  });

  it("requires LinkedIn or a CV", () => {
    expect(checkApply({ ...ok, linkedinUrl: "  " })).toBe(MESSAGES.linkedinOrCv);
  });

  it("rejects a link that is not a LinkedIn profile, even when a CV is attached", () => {
    expect(checkApply({ ...ok, linkedinUrl: "https://example.com/in/josef" })).toBe(MESSAGES.linkedin);
    expect(checkApply({ ...ok, linkedinUrl: "linkedin.com/company/acme", cv: pdf() })).toBe(MESSAGES.linkedin);
    expect(checkApply({ ...ok, linkedinUrl: `https://www.linkedin.com/in/${"a".repeat(500)}` })).toBe(MESSAGES.linkedin);
  });

  it("rejects a non-PDF CV and a CV over 10 MiB, accepts exactly 10 MiB", () => {
    expect(checkApply({ ...ok, cv: pdf(10, "cv.docx", "application/msword") })).toBe(MESSAGES.cvType);
    expect(checkApply({ ...ok, cv: pdf(10, "My CV.PDF", "") })).toBeNull();
    expect(checkApply({ ...ok, cv: pdf(10, "cv.bin", "application/pdf") })).toBeNull();
    expect(checkApply({ ...ok, cv: pdf(CV_MAX_BYTES + 1) })).toBe(MESSAGES.cvSize);
    expect(checkApply({ ...ok, cv: pdf(CV_MAX_BYTES) })).toBeNull();
  });

  it("caps the message at 10000 characters", () => {
    expect(checkApply({ ...ok, message: "x".repeat(10_000) })).toBeNull();
    expect(checkApply({ ...ok, message: "x".repeat(10_001) })).toBe(MESSAGES.message);
  });
});
