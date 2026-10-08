/**
 * Tests for the shared intake body contract (form connector, apply page): defaults, base64 variants, size cap.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/intake-body.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/form.md body rules: one candidate field required, cvBase64 decoding, defaults, caps
 *
 * Design constraints:
 * - Pure schema tests; no bindings
 */
import { describe, expect, it } from "vitest";
import { CV_MAX } from "@/domain/application";
import { IntakeFormBody } from "../intake-body";

const base = { tag: "senior-be", externalId: "resp-1" };
const parse = (body: unknown) => IntakeFormBody.safeParse(body);
const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
const messages = (r: ReturnType<typeof parse>) => (r.success ? [] : r.error.issues.map((i) => i.message));

describe("IntakeFormBody", () => {
  it("accepts a LinkedIn URL alone and keeps the optional fields", () => {
    const r = parse({ ...base, linkedinUrl: "linkedin.com/in/josef", name: " Josef ", email: "j@mail.test", phone: "+420 777 000 111", coverLetter: " hi " });
    expect(r.success && r.data).toMatchObject({
      tag: "senior-be",
      externalId: "resp-1",
      linkedinUrl: "linkedin.com/in/josef",
      name: "Josef",
      email: "j@mail.test",
      phone: "+420 777 000 111",
      coverLetter: "hi",
    });
  });

  it("requires one of linkedinUrl, cvText or cvBase64", () => {
    const r = parse({ ...base, name: "Josef", email: "j@mail.test" });
    expect(r.success).toBe(false);
    expect(messages(r)).toContain("send linkedinUrl, cvText or cvBase64");
  });

  it("accepts cvText alone and caps it at CV_MAX", () => {
    expect(parse({ ...base, cvText: "Josef Buryan, CMO" }).success).toBe(true);
    expect(parse({ ...base, cvText: "x".repeat(CV_MAX + 1) }).success).toBe(false);
  });

  it("decodes cvBase64 to cv.bytes with the default filename and content type", () => {
    const r = parse({ ...base, cvBase64: b64([1, 2, 3, 250, 251]) });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.cv).toMatchObject({ filename: "cv.pdf", contentType: "application/pdf" });
    expect([...new Uint8Array(r.data.cv?.bytes ?? new ArrayBuffer(0))]).toEqual([1, 2, 3, 250, 251]);
    expect("cvBase64" in r.data).toBe(false);
  });

  it("a blank cvFilename or cvContentType falls back to the defaults instead of a 400", () => {
    const r = parse({ ...base, cvBase64: b64([1]), cvFilename: "", cvContentType: "" });
    expect(r.success && r.data.cv).toMatchObject({ filename: "cv.pdf", contentType: "application/pdf" });
  });

  it("keeps a given filename and content type", () => {
    const r = parse({ ...base, cvBase64: b64([1]), cvFilename: "Josef CV.docx", cvContentType: "application/msword" });
    expect(r.success && r.data.cv).toMatchObject({ filename: "Josef CV.docx", contentType: "application/msword" });
  });

  it("decodes url-safe base64, missing padding and line breaks", () => {
    const bytes = [251, 255, 190, 250, 1];
    const urlSafe = b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(urlSafe).toMatch(/[-_]/);
    for (const encoded of [b64(bytes), urlSafe, b64(bytes).replace(/(.{4})/g, "$1\r\n")]) {
      const r = parse({ ...base, cvBase64: encoded });
      expect(r.success && [...new Uint8Array(r.data.cv?.bytes ?? new ArrayBuffer(0))]).toEqual(bytes);
    }
  });

  it("rejects base64 that does not decode", () => {
    for (const cvBase64 of ["not base64!", "abcde", "====", "ab=cd"]) {
      const r = parse({ ...base, cvBase64 });
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("cvBase64 is not valid base64");
    }
  });

  it("caps cvBase64 at 8,000,000 characters", () => {
    expect(parse({ ...base, cvBase64: "A".repeat(8_000_000) }).success).toBe(true);
    expect(parse({ ...base, cvBase64: "A".repeat(8_000_001) }).success).toBe(false);
  });

  it("lowercases the tag and rejects a malformed one", () => {
    const r = parse({ ...base, tag: " Senior-BE ", linkedinUrl: "linkedin.com/in/josef" });
    expect(r.success && r.data.tag).toBe("senior-be");
    expect(parse({ ...base, tag: "senior be", linkedinUrl: "linkedin.com/in/josef" }).success).toBe(false);
    expect(parse({ externalId: "resp-1", linkedinUrl: "linkedin.com/in/josef" }).success).toBe(false);
  });

  it("requires a non-empty externalId and a valid email", () => {
    expect(parse({ ...base, externalId: "", linkedinUrl: "linkedin.com/in/josef" }).success).toBe(false);
    expect(parse({ ...base, email: "nope", linkedinUrl: "linkedin.com/in/josef" }).success).toBe(false);
  });
});
