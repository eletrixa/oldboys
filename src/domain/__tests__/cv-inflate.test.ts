/**
 * Tests for the decompression-bomb guard: ZIP (.docx) entries and PDF streams measured by what they really inflate to.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/cv-inflate.test.ts
 * Deps:    vitest, fixtures/tiny-docx, fixtures/tiny-pdf
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Ordinary stored and deflated files pass; a small file that inflates past CV_INFLATE_MAX is refused with a reason,
 *   also when its header lies about the size; PDF images are not counted; encryption and unmeasurable filters refuse
 *
 * Design constraints:
 * - Bombs are built at test time from zeros (a 48 MB entry deflates to about 50 KB)
 */
import { describe, expect, it } from "vitest";
import { CV_INFLATE_MAX, pdfInflateProblem, zipInflateProblem } from "../cv-inflate";
import { tinyDocx } from "./fixtures/tiny-docx";
import { tinyPdf } from "./fixtures/tiny-pdf";

const BOMB = CV_INFLATE_MAX + 8 * 1024 * 1024;

describe("zipInflateProblem", () => {
  it("passes a stored and a deflated .docx", async () => {
    expect(await zipInflateProblem(tinyDocx(["Jana Novak"]))).toBeNull();
    expect(await zipInflateProblem(tinyDocx(["Jana Novak"], { deflate: true, pad: 1024 * 1024 }))).toBeNull();
  });

  it("refuses an entry that inflates past the cap, though the file is small", async () => {
    const bomb = tinyDocx(["Jana"], { pad: BOMB });
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    expect(await zipInflateProblem(bomb)).toBe("Word file would inflate past 40 MB, not read");
  });

  it("counts the real output when the header lies about the uncompressed size", async () => {
    const bomb = new Uint8Array(tinyDocx(["Jana"], { pad: BOMB }));
    const view = new DataView(bomb.buffer);
    // Rewrite every declared uncompressed size (local and central) to 1 byte.
    for (let i = 0; i + 4 <= bomb.length; i++) {
      const sig = view.getUint32(i, true);
      if (sig === 0x04034b50) view.setUint32(i + 22, 1, true);
      if (sig === 0x02014b50) view.setUint32(i + 24, 1, true);
    }
    expect(await zipInflateProblem(bomb.buffer)).toMatch(/inflate past/);
  });

  it("leaves bytes without a ZIP directory to the parser", async () => {
    expect(await zipInflateProblem(new TextEncoder().encode("not a zip").buffer)).toBeNull();
  });
});

describe("pdfInflateProblem", () => {
  it("passes a plain and a Flate-compressed PDF", async () => {
    expect(await pdfInflateProblem(tinyPdf("Josef"))).toBeNull();
    expect(await pdfInflateProblem(tinyPdf("Josef", { deflate: true, pad: 1024 * 1024 }))).toBeNull();
  });

  it("refuses a Flate stream that inflates past the cap", async () => {
    const bomb = tinyPdf("Josef", { deflate: true, pad: BOMB });
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    expect(await pdfInflateProblem(bomb)).toBe("PDF would inflate past 40 MB, not read");
  });

  it("does not count image streams, which pdf.js never inflates to read text", async () => {
    expect(await pdfInflateProblem(tinyPdf("Josef", { pad: BOMB, padImage: true }))).toBeNull();
  });

  it("refuses what it cannot measure: an encrypted PDF, an LZW or chained filter", async () => {
    expect(await pdfInflateProblem(tinyPdf("Josef", { encrypt: true }))).toBe("PDF is encrypted, not read");
    expect(await pdfInflateProblem(tinyPdf("Josef", { pad: 10, padFilter: "/LZWDecode" }))).toBe("PDF uses the LZWDecode filter, not read");
    expect(await pdfInflateProblem(tinyPdf("Josef", { pad: 10, padFilter: "[/ASCII85Decode /FlateDecode]" }))).toBe(
      "PDF uses the ASCII85Decode + FlateDecode filter, not read",
    );
  });
});
