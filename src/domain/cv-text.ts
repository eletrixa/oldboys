/**
 * CV file to plain text: PDF via unpdf, Word (.docx) via mammoth, text files decoded, old Word (.doc) and anything else stored and noted.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cv-text.ts
 * Deps:    unpdf, mammoth, src/domain/application (CV_MAX), src/domain/cv-kind, src/domain/cv-inflate
 * Tested:  src/domain/__tests__/cv-text.test.ts
 *
 * Key responsibilities:
 * - `extractCvText`: text (whitespace-collapsed for PDF and DOCX, trimmed, at most CV_MAX chars) or a note saying why not
 *
 * Design constraints:
 * - Never throws: a library error becomes a note, the caller still stores the file
 * - Never mutates or detaches the input bytes (they are written to R2 afterwards); the parsers get a copy
 * - The kind is the bytes' magic when they carry one (`sniffCvKind`), else the declared type or name; parsed only when
 *   the bytes carry the format's magic (%PDF, or PK for the DOCX zip)
 * - Never handed to a parser when it would inflate past CV_INFLATE_MAX (cv-inflate.ts): a decompression bomb is a note
 * - Text files: UTF-8, or UTF-16 by its BOM; bytes that are not text (NULs, control characters, invalid UTF-8 that is
 *   not Czech windows-1250 either) are a note, never "readable" junk that would start a run
 * - Format detection lives in cv-kind.ts so client code can use it without these parsers
 */
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { CV_MAX } from "./application";
import { pdfInflateProblem, zipInflateProblem } from "./cv-inflate";
import { cvKind, sniffCvKind } from "./cv-kind";

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
  const bomb = await pdfInflateProblem(bytes);
  if (bomb !== null) return { text: null, note: bomb };
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
  const bomb = await zipInflateProblem(bytes);
  if (bomb !== null) return { text: null, note: bomb };
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

/** C0 and C1 controls other than tab, line feed, form feed and carriage return, plus U+FFFD (UTF-16 code units). */
const notText = (code: number): boolean =>
  (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0c && code !== 0x0d) || (code >= 0x80 && code <= 0x9f) || code === 0xfffd;

/** UTF-16 by its BOM; else UTF-8, or Czech windows-1250 (Notepad "ANSI") when the bytes are not valid UTF-8. */
function decodeText(bytes: ArrayBuffer): string {
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (head[0] === 0xff && head[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (head[0] === 0xfe && head[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

function plainText(bytes: ArrayBuffer): CvTextResult {
  // Only the head can reach the run (CV_MAX), and it shows a binary file as well as the whole would.
  const head = decodeText(bytes).trimStart().slice(0, CV_MAX * 2);
  let kept = "";
  for (let i = 0; i < head.length; i++) if (!notText(head.charCodeAt(i))) kept += head.charAt(i);
  // A binary file renamed .txt, or UTF-16 without a BOM, is full of NULs and control characters: not a CV.
  if (head.length - kept.length > head.length / 100) return { text: null, note: "CV text file is not readable text" };
  const clean = kept.trim().slice(0, CV_MAX);
  return clean === "" ? { text: null, note: "CV text file is empty" } : { text: clean, note: null };
}

export async function extractCvText(file: CvBytes): Promise<CvTextResult> {
  const declared = cvKind(file);
  switch (declared === null ? null : sniffCvKind(file.bytes, declared)) {
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
