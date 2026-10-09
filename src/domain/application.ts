/**
 * Intake application contract: what a connector hands the funnel, and the pure decisions the funnel makes on it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/application.ts
 * Deps:    zod, src/domain/profile-url
 * Tested:  src/domain/__tests__/application.test.ts
 *
 * Key responsibilities:
 * - Zod schemas for an intake tag, source, status, CV file and IntakeInput (specs/intake/data.md)
 * - `candidateInput`: LinkedIn URL normalised or dropped with a note, CV text passed through
 * - `decideStatus`: unmatched > incomplete > capped > run-started, in that order; CAPPED_NOTE is the capped note
 * - `safeFilename` / `cvR2Key`: the R2 key a CV file is stored under
 * - Owns CV_MAX (run-body.ts re-exports it)
 *
 * Design constraints:
 * - Pure: no I/O; the funnel (src/workflow/intake.ts) is the only writer of applications
 */
import { z } from "zod";
import { normalizeLinkedinProfile } from "./profile-url";

/** Longest CV text a run accepts (pasted or extracted). */
export const CV_MAX = 20_000;
/** Largest CV file any connector stores (R2) or parses; the same cap for mail, form, apply page and StartupJobs. */
export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const NAME_MAX = 200;
export const EMAIL_MAX = 200;
export const PHONE_MAX = 40;
export const LINKEDIN_MAX = 500;
export const COVER_LETTER_MAX = 10_000;
/** Longest applications.note; joinNotes cuts here, so connectors never need their own limit. */
export const NOTE_MAX = 1000;
/** Longest CvFile.filename a connector may hand in (safeFilename cuts the stored key to 80). */
export const CV_FILENAME_MAX = 200;

/** Routing key of an open position: plus-address, apply page path, form hidden field, StartupJobs mapping. */
export const IntakeTag = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/);

export const ApplicationSource = z.enum(["email", "form", "apply-page", "startupjobs"]);
export type ApplicationSource = z.infer<typeof ApplicationSource>;

export const ApplicationStatus = z.enum(["received", "run-started", "unmatched", "incomplete", "capped"]);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const CvFile = z.object({
  bytes: z.instanceof(ArrayBuffer).refine((b) => b.byteLength <= CV_MAX_BYTES, { message: `CV file over ${String(CV_MAX_BYTES)} bytes` }),
  filename: z.string().min(1).max(CV_FILENAME_MAX),
  contentType: z.string().max(100),
});
export type CvFile = z.infer<typeof CvFile>;

/** Build a CvFile with the shared defaults: "cv.pdf" when the name is empty, "application/pdf" when the type is. */
export function toCvFile(file: { bytes: ArrayBuffer; filename?: string | null; contentType?: string | null }): CvFile {
  const filename = (file.filename ?? "").trim();
  const contentType = (file.contentType ?? "").trim();
  return {
    bytes: file.bytes,
    filename: (filename === "" ? "cv.pdf" : filename).slice(0, CV_FILENAME_MAX),
    contentType: (contentType === "" ? "application/pdf" : contentType).slice(0, 100),
  };
}

/** "; "-joined non-empty notes, cut to NOTE_MAX; null when there is nothing to say. */
export function joinNotes(...parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter((n): n is string => n !== null && n !== undefined && n !== "");
  return kept.length > 0 ? kept.join("; ").slice(0, NOTE_MAX) : null;
}

export const IntakeInput = z.object({
  source: ApplicationSource,
  externalId: z.string().min(1).max(300),
  /** Validated against IntakeTag by the funnel; kept raw here so an unknown tag can be shown on the row. */
  tag: z.string().trim().toLowerCase().max(60).optional(),
  name: z.string().trim().min(1).max(NAME_MAX).optional(),
  email: z.email().max(EMAIL_MAX).optional(),
  phone: z.string().trim().min(3).max(PHONE_MAX).optional(),
  /** Normalised in candidateInput(); an invalid URL is dropped with a note. */
  linkedinUrl: z.string().max(LINKEDIN_MAX).optional(),
  cvText: z.string().trim().min(1).max(CV_MAX).optional(),
  cv: CvFile.optional(),
  /** The connector already read `cv` and found no text: why. The funnel then stores this note and does not parse again. */
  cvNote: z.string().max(NOTE_MAX).optional(),
  coverLetter: z.string().trim().min(1).max(COVER_LETTER_MAX).optional(),
  note: z.string().max(NOTE_MAX).optional(),
});
export type IntakeInput = z.infer<typeof IntakeInput>;

/** One applications row, camelCase. */
export type Application = {
  id: string;
  source: ApplicationSource;
  externalId: string;
  tag: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  cvKey: string | null;
  cvText: string | null;
  coverLetter: string | null;
  status: ApplicationStatus;
  runId: string | null;
  note: string | null;
  receivedAt: string;
};

export type CandidateInput = { profileUrl?: string; cvText?: string; notes: string[] };

/** What a run needs from an application (plans/006): a normalised LinkedIn profile and/or CV text. */
export function candidateInput(app: Pick<IntakeInput, "linkedinUrl" | "cvText">): CandidateInput {
  const out: CandidateInput = { notes: [] };
  if (app.linkedinUrl !== undefined) {
    const url = normalizeLinkedinProfile(app.linkedinUrl);
    if (url === null) out.notes.push(`not a LinkedIn profile URL: ${app.linkedinUrl.slice(0, 120)}`);
    else out.profileUrl = url;
  }
  if (app.cvText !== undefined) out.cvText = app.cvText;
  return out;
}

export type DecidedStatus = Exclude<ApplicationStatus, "received">;

/** The note a capped row carries; the capped retry drops it when the run finally starts. */
export const CAPPED_NOTE = "intake run cap reached for this hour";

export function decideStatus(args: {
  tagKnown: boolean;
  senderAllowed: boolean;
  candidate: { profileUrl?: string; cvText?: string };
  capped: boolean;
}): { status: DecidedStatus; note: string | null } {
  if (!args.tagKnown) return { status: "unmatched", note: "unknown tag" };
  if (!args.senderAllowed) return { status: "unmatched", note: "sender not allowed" };
  if (args.candidate.profileUrl === undefined && args.candidate.cvText === undefined) {
    return { status: "incomplete", note: "no LinkedIn profile URL and no readable CV text" };
  }
  if (args.capped) return { status: "capped", note: CAPPED_NOTE };
  return { status: "run-started", note: null };
}

const FILENAME_MAX = 80;

/**
 * Basename with only [A-Za-z0-9._-] (diacritics folded: "Životopis" -> "Zivotopis"), no leading dot or underscore in
 * the name part, at most 80 chars, extension kept: "资料.pdf" -> "cv.pdf", never an extensionless "pdf"; "cv.pdf" when empty.
 */
export function safeFilename(name: string): string {
  const folded = (name.split(/[\\/]/).pop() ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = folded.replace(/[^A-Za-z0-9._-]+/g, "_");
  const ext = /\.[A-Za-z0-9]{1,10}$/.exec(cleaned)?.[0] ?? "";
  const stem = cleaned.slice(0, cleaned.length - ext.length).replace(/^[._]+/, "").replace(/_+$/, "");
  if (stem === "") return ext === "" ? "cv.pdf" : `cv${ext}`;
  return stem.slice(0, FILENAME_MAX - ext.length) + ext;
}

export function cvR2Key(applicationId: string, filename: string): string {
  return `intake/${applicationId}/${safeFilename(filename)}`;
}
