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
 *
 * Design constraints:
 * - Dependency-free so the apply page's client bundle can check a picked file without pulling unpdf or mammoth
 *   (cv-text.ts holds the extractors)
 * - Says nothing about the bytes: cv-text.ts checks the %PDF / PK magic before parsing
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
