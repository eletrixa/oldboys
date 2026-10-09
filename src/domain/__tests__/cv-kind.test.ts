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
 * - `sniffCvKind`: the bytes' magic wins over the declared kind; without a magic the declared kind stays
 *
 * Design constraints:
 * - Pure; no files, a few literal bytes
 */
import { describe, expect, it } from "vitest";
import { CV_MEDIA_TYPE, cvKind, isPdf, sniffCvKind } from "../cv-kind";

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

describe("sniffCvKind", () => {
  const bytes = (...b: number[]): ArrayBuffer => new Uint8Array(b).buffer;
  const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
  const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];
  const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

  it("lets the magic win over the declared kind", () => {
    expect(sniffCvKind(bytes(...ZIP), "pdf")).toBe("docx");
    expect(sniffCvKind(bytes(...PDF), "docx")).toBe("pdf");
    expect(sniffCvKind(bytes(...CFB), "docx")).toBe("doc");
  });

  it("keeps the declared kind when the bytes carry no magic", () => {
    expect(sniffCvKind(new TextEncoder().encode("PK Novak, ten years of Go").buffer, "txt")).toBe("txt");
    expect(sniffCvKind(bytes(0x68, 0x69), "pdf")).toBe("pdf");
    expect(sniffCvKind(bytes(), "docx")).toBe("docx");
  });
});
