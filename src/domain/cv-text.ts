/**
 * CV file to plain text: PDF via unpdf, text files decoded, anything else stored and noted (specs/intake/funnel.md).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cv-text.ts
 * Deps:    unpdf, src/domain/application (CV_MAX)
 * Tested:  src/domain/__tests__/cv-text.test.ts
 *
 * Key responsibilities:
 * - `extractCvText`: text (whitespace-collapsed for PDF, trimmed, at most CV_MAX chars) or a note saying why not
 *
 * Design constraints:
 * - Never throws: a library error becomes a note, the caller still stores the file
 * - Never mutates or detaches the input bytes (they are written to R2 afterwards); unpdf gets a copy
 * - PDF only when the bytes start with %PDF, whatever the content type or filename claims
 */
import { extractText } from "unpdf";
import { CV_MAX } from "./application";

export type CvTextResult = { text: string | null; note: string | null };

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export async function extractCvText(file: { bytes: ArrayBuffer; contentType: string; filename: string }): Promise<CvTextResult> {
  const type = file.contentType.toLowerCase();
  const name = file.filename.toLowerCase();

  if (type.startsWith("application/pdf") || name.endsWith(".pdf")) {
    const head = new Uint8Array(file.bytes, 0, Math.min(4, file.bytes.byteLength));
    if (!PDF_MAGIC.every((b, i) => head[i] === b)) return { text: null, note: "not a PDF (no %PDF header)" };
    try {
      const { text } = await extractText(new Uint8Array(file.bytes.slice(0)), { mergePages: true });
      const clean = text.replace(/\s+/g, " ").trim().slice(0, CV_MAX);
      return clean === "" ? { text: null, note: "PDF has no extractable text (scanned?)" } : { text: clean, note: null };
    } catch (err) {
      return { text: null, note: `PDF could not be read: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}` };
    }
  }

  if (type.startsWith("text/plain") || name.endsWith(".txt")) {
    const clean = new TextDecoder("utf-8").decode(file.bytes).trim().slice(0, CV_MAX);
    return clean === "" ? { text: null, note: "CV text file is empty" } : { text: clean, note: null };
  }

  return { text: null, note: `unsupported CV format ${file.contentType.slice(0, 100)}` };
}
