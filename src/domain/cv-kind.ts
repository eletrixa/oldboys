/**
 * Which CV files the intake takes: PDF, Word (.docx) and plain text it reads, old Word (.doc) it only stores; by media type or file name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cv-kind.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/cv-kind.test.ts
 *
 * Key responsibilities:
 * - `cvKind`: "pdf" | "docx" | "txt" | "doc" | null; `isPdf` for the email connector; `CV_MEDIA_TYPE` per kind
 * - `sniffCvKind`: the kind the bytes carry by their magic (%PDF-, the ZIP local header, the CFB header), so a .docx
 *   sent as application/pdf is read and stored as Word
 *
 * Design constraints:
 * - Dependency-free so the apply page's client bundle can check a picked file without pulling unpdf or mammoth
 *   (cv-text.ts holds the extractors)
 * - `cvKind` says nothing about the bytes; on the server `sniffCvKind` lets the magic win over the declared kind, and
 *   cv-text.ts still checks the %PDF / PK magic before parsing (a declared kind without its magic is noted, not parsed)
 * - PDF wins over a conflicting media type, as isPdf always did
 * - "doc" is binary CFB that no bundled parser reads: cv-text.ts stores it with a note, the apply page wants LinkedIn beside it
 */

export type CvKind = "pdf" | "docx" | "txt" | "doc";

export const CV_MEDIA_TYPE = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  doc: "application/msword",
} as const satisfies Record<CvKind, string>;

const EXTENSION: Record<CvKind, string> = { pdf: ".pdf", docx: ".docx", txt: ".txt", doc: ".doc" };

type NamedFile = { filename: string; contentType: string };

function matches(file: NamedFile, kind: CvKind): boolean {
  return file.contentType.toLowerCase().startsWith(CV_MEDIA_TYPE[kind]) || file.filename.toLowerCase().endsWith(EXTENSION[kind]);
}

/** Media type application/pdf or a .pdf file name. */
export function isPdf(file: NamedFile): boolean {
  return matches(file, "pdf");
}

export function cvKind(file: NamedFile): CvKind | null {
  if (isPdf(file)) return "pdf";
  if (matches(file, "docx")) return "docx";
  if (matches(file, "txt")) return "txt";
  if (matches(file, "doc")) return "doc";
  return null;
}

/** Leading bytes per kind: "%PDF-", the ZIP local file header (a .docx), the CFB header (an older .doc). */
const MAGIC: readonly (readonly [CvKind, readonly number[]])[] = [
  ["pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]],
  ["docx", [0x50, 0x4b, 0x03, 0x04]],
  ["doc", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
];

/**
 * The kind the bytes carry when their magic names one, else the declared kind (plain text has no magic; a declared
 * PDF or Word file without its magic stays declared, and cv-text.ts notes it as unreadable).
 */
export function sniffCvKind(bytes: ArrayBuffer, declared: CvKind): CvKind {
  const head = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
  const hit = MAGIC.find(([, magic]) => magic.every((b, i) => head[i] === b));
  return hit?.[0] ?? declared;
}
