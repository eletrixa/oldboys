/**
 * Tests for cvKind: which CV formats the intake accepts, by media type or file name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/cv-kind.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - PDF, DOCX and TXT recognised by media type (parameters ignored) or by extension (any case); everything else null
 * - PDF keeps priority over a conflicting media type, as isPdf always did (the bytes are checked for %PDF later)
 *
 * Design constraints:
 * - Pure; no files, no bytes
 */
import { describe, expect, it } from "vitest";
import { CV_MEDIA_TYPE, cvKind, isPdf } from "../cv-kind";

const kind = (filename: string, contentType = ""): ReturnType<typeof cvKind> => cvKind({ filename, contentType });

describe("cvKind", () => {
  it("recognises the three formats by media type", () => {
    expect(kind("cv", "application/pdf")).toBe("pdf");
    expect(kind("cv", CV_MEDIA_TYPE.docx)).toBe("docx");
    expect(kind("cv", "text/plain; charset=utf-8")).toBe("txt");
    expect(kind("cv", "Application/PDF")).toBe("pdf");
  });

  it("recognises the three formats by extension when the media type is missing or generic", () => {
    expect(kind("My CV.PDF")).toBe("pdf");
    expect(kind("jana.docx", "application/octet-stream")).toBe("docx");
    expect(kind("notes.TXT")).toBe("txt");
  });

  it("knows old Word (.doc) by media type or name, without mistaking a .docx for it", () => {
    expect(kind("cv.doc", "application/msword")).toBe("doc");
    expect(kind("CV.DOC")).toBe("doc");
    expect(kind("cv.docx")).toBe("docx");
  });

  it("rejects images and unknown files", () => {
    expect(kind("cv.png", "image/png")).toBeNull();
    expect(kind("scan.jpg")).toBeNull();
    expect(kind("cv.docx.exe", "application/x-msdownload")).toBeNull();
    expect(kind("", "")).toBeNull();
    expect(kind("docx", "")).toBeNull();
  });

  it("gives PDF priority, like isPdf", () => {
    expect(kind("cv.pdf", "text/plain")).toBe("pdf");
    expect(isPdf({ filename: "cv.bin", contentType: "application/pdf" })).toBe(true);
    expect(isPdf({ filename: "cv.docx", contentType: CV_MEDIA_TYPE.docx })).toBe(false);
  });
});
