/**
 * Tests for the pure apply-form helpers shared by the client form and the /api/apply handler.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/__tests__/apply-fields.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - checkApply: required fields, LinkedIn URL shape, CV formats (PDF / DOCX / TXT by media type or name, .doc only beside
 *   LinkedIn) and the 10 MiB size, pasted CV length, the "LinkedIn or CV" rule (pasted text counts), length caps, and
 *   which field each problem belongs to; checkApplyAll: every problem in one pass, in form order; Czech sentences
 * - cvFileProblem / cvRefusal (a refused pick worded around the file that stays), isCvFile, formatSize, attachedLine
 *   (the done card) and replyOutcome (status code to what the candidate sees, never a rate-limit sentence)
 * - apply-copy: both languages carry the same keys, toLang
 *
 * Design constraints:
 * - Pure Node tests: File objects only, no DOM
 */
import { describe, expect, it } from "vitest";
import { CV_MAX, CV_MAX_BYTES } from "@/domain/application";
import { CV_MEDIA_TYPE } from "@/domain/cv-kind";
import { COPY, toLang } from "../apply-copy";
import { attachedLine, checkApply, checkApplyAll, cvFileProblem, cvRefusal, formatSize, isCvFile, MESSAGES, replyOutcome, type ApplyDraft } from "../apply-fields";

const file = (size = 1000, name = "cv.pdf", type = "application/pdf"): File => new File([new Uint8Array(size)], name, { type });
const ok: ApplyDraft = { name: "Josef Buryan", email: "josef@mail.test", linkedinUrl: "linkedin.com/in/josef-buryan", cv: null, cvText: "", message: "" };
const msg = (draft: ApplyDraft): string | null => checkApply(draft)?.message ?? null;

describe("checkApply", () => {
  it("passes with LinkedIn only, with a CV file only, with pasted CV text only, and with both", () => {
    expect(checkApply(ok)).toBeNull();
    expect(checkApply({ ...ok, linkedinUrl: "", cv: file() })).toBeNull();
    expect(checkApply({ ...ok, linkedinUrl: "", cvText: "Ten years of Go." })).toBeNull();
    expect(checkApply({ ...ok, cv: file() })).toBeNull();
  });

  it("requires a name and a plausible email", () => {
    expect(checkApply({ ...ok, name: "   " })).toEqual({ field: "name", message: MESSAGES.name });
    expect(checkApply({ ...ok, email: "" })).toEqual({ field: "email", message: MESSAGES.email });
    expect(msg({ ...ok, email: "not an email" })).toBe(MESSAGES.email);
    expect(msg({ ...ok, name: "x".repeat(201) })).toBe(MESSAGES.name);
    expect(msg({ ...ok, email: `${"x".repeat(200)}@mail.test` })).toBe(MESSAGES.email);
  });

  it("requires LinkedIn or a CV; blank pasted text does not count", () => {
    expect(checkApply({ ...ok, linkedinUrl: "  " })).toEqual({ field: "linkedinUrl", message: MESSAGES.linkedinOrCv });
    expect(msg({ ...ok, linkedinUrl: "", cvText: " \n " })).toBe(MESSAGES.linkedinOrCv);
  });

  it("rejects a link that is not a LinkedIn profile, even when a CV is attached", () => {
    expect(checkApply({ ...ok, linkedinUrl: "https://example.com/in/josef" })).toEqual({ field: "linkedinUrl", message: MESSAGES.linkedin });
    expect(msg({ ...ok, linkedinUrl: "linkedin.com/company/acme", cv: file() })).toBe(MESSAGES.linkedin);
    expect(msg({ ...ok, linkedinUrl: `https://www.linkedin.com/in/${"a".repeat(500)}` })).toBe(MESSAGES.linkedin);
  });

  it("accepts PDF, Word (.docx) and text CVs by media type or name", () => {
    expect(checkApply({ ...ok, cv: file(10, "My CV.PDF", "") })).toBeNull();
    expect(checkApply({ ...ok, cv: file(10, "cv.bin", "application/pdf") })).toBeNull();
    expect(checkApply({ ...ok, cv: file(10, "jana.docx", CV_MEDIA_TYPE.docx) })).toBeNull();
    expect(checkApply({ ...ok, cv: file(10, "jana.docx", "") })).toBeNull();
    expect(checkApply({ ...ok, cv: file(10, "cv.txt", "text/plain") })).toBeNull();
  });

  it("rejects images and other formats with the formats sentence", () => {
    expect(checkApply({ ...ok, cv: file(10, "photo.png", "image/png") })).toEqual({ field: "cv", message: MESSAGES.cvType });
    expect(msg({ ...ok, cv: file(10, "cv.odt", "application/vnd.oasis.opendocument.text") })).toBe(MESSAGES.cvType);
    expect(MESSAGES.cvType).toBe("Please attach your CV as a PDF, Word or text file.");
  });

  it("takes an older Word (.doc) file only beside a LinkedIn profile, because it cannot be read", () => {
    const doc = file(10, "cv.doc", "application/msword");
    expect(checkApply({ ...ok, cv: doc })).toBeNull();
    expect(checkApply({ ...ok, linkedinUrl: "", cv: doc })).toEqual({ field: "cv", message: MESSAGES.cvDoc });
  });

  it("rejects a CV over 10 MiB and accepts exactly 10 MiB", () => {
    expect(checkApply({ ...ok, cv: file(CV_MAX_BYTES + 1) })).toEqual({ field: "cv", message: MESSAGES.cvSize });
    expect(checkApply({ ...ok, cv: file(CV_MAX_BYTES) })).toBeNull();
  });

  it("caps pasted CV text at 20000 characters, but ignores it when a file is attached (the file wins)", () => {
    expect(checkApply({ ...ok, cvText: "x".repeat(CV_MAX) })).toBeNull();
    expect(checkApply({ ...ok, cvText: "x".repeat(CV_MAX + 1) })).toEqual({ field: "cvText", message: MESSAGES.cvText });
    expect(checkApply({ ...ok, cv: file(), cvText: "x".repeat(CV_MAX + 1) })).toBeNull();
  });

  it("caps the message at 10000 characters", () => {
    expect(checkApply({ ...ok, message: "x".repeat(10_000) })).toBeNull();
    expect(checkApply({ ...ok, message: "x".repeat(10_001) })).toEqual({ field: "coverLetter", message: MESSAGES.message });
  });
});

describe("checkApplyAll", () => {
  it("reports every invalid field in one pass, in form order, one sentence each", () => {
    const empty: ApplyDraft = { name: "", email: "", linkedinUrl: "", cv: null, cvText: "", message: "x".repeat(10_001) };
    expect(checkApplyAll(empty).map((p) => p.field)).toEqual(["name", "email", "linkedinUrl", "coverLetter"]);
    expect(checkApply(empty)).toEqual(checkApplyAll(empty)[0]);
    expect(checkApplyAll(ok)).toEqual([]);
  });

  it("speaks Czech when asked", () => {
    expect(checkApply({ ...ok, name: "" }, "cs")).toEqual({ field: "name", message: COPY.cs.messages.name });
    expect(COPY.cs.messages.name).not.toBe(MESSAGES.name);
  });
});

describe("cvFileProblem and cvRefusal", () => {
  it("says what is wrong with a picked file", () => {
    expect(cvFileProblem(file(10, "photo.png", "image/png"))).toBe("type");
    expect(cvFileProblem(file(CV_MAX_BYTES + 1))).toBe("size");
    expect(cvFileProblem(file(10, "cv.doc", "application/msword"))).toBeNull();
  });

  it("words a refusal plainly when nothing is attached and names both files when a good one stays", () => {
    expect(cvRefusal("type", "photo.png", null)).toBe(MESSAGES.cvType);
    expect(cvRefusal("size", "big.pdf", null)).toBe(MESSAGES.cvSize);
    expect(cvRefusal("type", "photo.png", "scan.PDF")).toBe("photo.png was not added: please use a PDF, Word or text file. scan.PDF is still attached.");
    expect(cvRefusal("size", "big.pdf", "scan.PDF")).toBe("big.pdf was not added: it is larger than 10 MB. scan.PDF is still attached.");
    expect(cvRefusal("type", "photo.png", "cv.pdf", "cs")).toContain("cv.pdf zůstává přiložený");
  });
});

describe("apply-copy", () => {
  it("has the same keys in English and Czech", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v !== null ? keys(v as object).map((s) => `${k}.${s}`) : [k])).sort();
    expect(keys(COPY.cs)).toEqual(keys(COPY.en));
  });

  it("toLang takes cs and falls back to English for anything else", () => {
    expect(toLang("cs")).toBe("cs");
    for (const raw of ["en", "de", undefined, ["cs"], ""]) expect(toLang(raw)).toBe("en");
  });
});

describe("isCvFile", () => {
  it("accepts pdf, docx, txt and the older doc by type or name, rejects the rest", () => {
    expect(isCvFile(file(1, "a.pdf", ""))).toBe(true);
    expect(isCvFile(file(1, "a", "application/pdf"))).toBe(true);
    expect(isCvFile(file(1, "a.docx", ""))).toBe(true);
    expect(isCvFile(file(1, "a", CV_MEDIA_TYPE.docx))).toBe(true);
    expect(isCvFile(file(1, "a.txt", ""))).toBe(true);
    expect(isCvFile(file(1, "a", "text/plain"))).toBe(true);
    expect(isCvFile(file(1, "a.doc", "application/msword"))).toBe(true);
    expect(isCvFile(file(1, "a.jpg", "image/jpeg"))).toBe(false);
    expect(isCvFile(file(1, "a.odt", "application/vnd.oasis.opendocument.text"))).toBe(false);
  });
});

describe("formatSize", () => {
  it("reads like a person would say it", () => {
    expect(formatSize(0)).toBe("0 bytes");
    expect(formatSize(1)).toBe("1 byte");
    expect(formatSize(900)).toBe("900 bytes");
    expect(formatSize(1024)).toBe("1 KB");
    expect(formatSize(350 * 1024 + 300)).toBe("350 KB");
    expect(formatSize(1.2 * 1024 * 1024)).toBe("1.2 MB");
    expect(formatSize(CV_MAX_BYTES)).toBe("10 MB");
    expect(formatSize(CV_MAX_BYTES + 1)).toBe("10 MB");
    expect(formatSize(11 * 1024 * 1024)).toBe("11 MB");
  });
});

describe("attachedLine", () => {
  it("names what was sent", () => {
    expect(attachedLine({ cvName: "jana-cv.pdf", pastedCv: false, linkedin: false })).toBe("Your CV: jana-cv.pdf");
    expect(attachedLine({ cvName: null, pastedCv: false, linkedin: true })).toBe("Your LinkedIn profile");
    expect(attachedLine({ cvName: null, pastedCv: true, linkedin: false })).toBe("Your CV, pasted as text");
    expect(attachedLine({ cvName: "jana-cv.docx", pastedCv: false, linkedin: true })).toBe("Your CV: jana-cv.docx, and your LinkedIn profile");
    expect(attachedLine({ cvName: null, pastedCv: true, linkedin: true })).toBe("Your CV, pasted as text, and your LinkedIn profile");
    expect(attachedLine({ cvName: "cv.pdf", pastedCv: false, linkedin: true }, "cs")).toBe("Váš životopis: cv.pdf a váš profil na LinkedInu");
  });
});

describe("replyOutcome", () => {
  it("treats 200 and 201 as received", () => {
    expect(replyOutcome(201, { received: true })).toEqual({ kind: "done" });
    expect(replyOutcome(200, { received: true })).toEqual({ kind: "done" });
  });

  it("shows the handler's own sentence on 400, a generic one when there is none, and no retry button", () => {
    expect(replyOutcome(400, { error: MESSAGES.cvType })).toEqual({ kind: "error", message: MESSAGES.cvType, retry: false });
    expect(replyOutcome(400, null)).toEqual({ kind: "error", message: "Please check your details and try again.", retry: false });
    expect(replyOutcome(400, { error: 42 })).toEqual({ kind: "error", message: "Please check your details and try again.", retry: false });
  });

  it("offers Try again on a server error and on any other status (a 429 too), never leaking the body or a limit", () => {
    for (const status of [500, 502, 503, 429, 403, 0]) {
      const out = replyOutcome(status, { error: "internal detail" });
      expect(out).toEqual({ kind: "error", message: MESSAGES.server, retry: true });
    }
    expect(replyOutcome(503, null, "cs")).toEqual({ kind: "error", message: COPY.cs.messages.server, retry: true });
  });
});
