/**
 * CV file to plain text: PDF via unpdf, Word (.docx) via mammoth, text files decoded, old Word (.doc) and anything else stored and noted.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cv-text.ts
 * Deps:    unpdf, mammoth, src/domain/application (CV_MAX), src/domain/cv-kind
 * Tested:  src/domain/__tests__/cv-text.test.ts
 *
 * Key responsibilities:
 * - `extractCvText`: text (whitespace-collapsed for PDF and DOCX, trimmed, at most CV_MAX chars) or a note saying why not
 *
 * Design constraints:
 * - Never throws: a library error becomes a note, the caller still stores the file
 * - Never mutates or detaches the input bytes (they are written to R2 afterwards); the parsers get a copy
 * - Parsed only when the bytes carry the format's magic (%PDF, or PK for the DOCX zip), whatever the type or name claims
 * - Format detection lives in cv-kind.ts so client code can use it without these parsers
 */
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { CV_MAX } from "./application";
import { cvKind } from "./cv-kind";

export type CvTextResult = { text: string | null; note: string | null };

type CvBytes = { bytes: ArrayBuffer; contentType: string; filename: string };

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b]; // PK

const startsWith = (bytes: ArrayBuffer, magic: readonly number[]): boolean => {
  const head = new Uint8Array(bytes, 0, Math.min(magic.length, bytes.byteLength));
  return magic.every((b, i) => head[i] === b);
};

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, CV_MAX);
const reason = (err: unknown): string => (err instanceof Error ? err.message : String(err)).slice(0, 200);

async function pdfText(bytes: ArrayBuffer): Promise<CvTextResult> {
  if (!startsWith(bytes, PDF_MAGIC)) return { text: null, note: "not a PDF (no %PDF header)" };
  try {
    const { text } = await extractText(new Uint8Array(bytes.slice(0)), { mergePages: true });
    const clean = collapse(text);
    return clean === "" ? { text: null, note: "PDF has no extractable text (scanned?)" } : { text: clean, note: null };
  } catch (err) {
    return { text: null, note: `PDF could not be read: ${reason(err)}` };
  }
}

async function docxText(bytes: ArrayBuffer): Promise<CvTextResult> {
  if (!startsWith(bytes, ZIP_MAGIC)) return { text: null, note: "not a Word file (no ZIP header)" };
  try {
    const copy = bytes.slice(0);
    // mammoth's Node entry reads `buffer`, its browser entry `arrayBuffer`; both point at the same copy.
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(copy), arrayBuffer: copy });
    const clean = collapse(value);
    return clean === "" ? { text: null, note: "Word file has no readable text" } : { text: clean, note: null };
  } catch (err) {
    return { text: null, note: `Word file could not be read: ${reason(err)}` };
  }
}

function plainText(bytes: ArrayBuffer): CvTextResult {
  const clean = new TextDecoder("utf-8").decode(bytes).trim().slice(0, CV_MAX);
  return clean === "" ? { text: null, note: "CV text file is empty" } : { text: clean, note: null };
}

export async function extractCvText(file: CvBytes): Promise<CvTextResult> {
  switch (cvKind(file)) {
    case "pdf":
      return pdfText(file.bytes);
    case "docx":
      return docxText(file.bytes);
    case "txt":
      return plainText(file.bytes);
    case "doc":
      return { text: null, note: "old Word (.doc) file stored, not read" };
    case null:
      return { text: null, note: `unsupported CV format ${file.contentType.slice(0, 100)}` };
  }
}
