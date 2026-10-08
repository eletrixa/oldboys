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
 * - `decideStatus`: unmatched > incomplete > capped > run-started, in that order
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

/** Routing key of an open position: plus-address, apply page path, form hidden field, StartupJobs mapping. */
export const IntakeTag = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/);

export const ApplicationSource = z.enum(["email", "form", "apply-page", "startupjobs"]);
export type ApplicationSource = z.infer<typeof ApplicationSource>;

export const ApplicationStatus = z.enum(["received", "run-started", "unmatched", "incomplete", "capped"]);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const CvFile = z.object({
  bytes: z.instanceof(ArrayBuffer),
  filename: z.string().min(1).max(200),
  contentType: z.string().max(100),
});
export type CvFile = z.infer<typeof CvFile>;

export const IntakeInput = z.object({
  source: ApplicationSource,
  externalId: z.string().min(1).max(300),
  /** Validated against IntakeTag by the funnel; kept raw here so an unknown tag can be shown on the row. */
  tag: z.string().trim().toLowerCase().max(60).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  email: z.email().max(200).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  /** Normalised in candidateInput(); an invalid URL is dropped with a note. */
  linkedinUrl: z.string().max(500).optional(),
  cvText: z.string().trim().min(1).max(CV_MAX).optional(),
  cv: CvFile.optional(),
  coverLetter: z.string().trim().min(1).max(10_000).optional(),
  note: z.string().max(1000).optional(),
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
  if (args.capped) return { status: "capped", note: "intake run cap reached for this hour" };
  return { status: "run-started", note: null };
}

const FILENAME_MAX = 80;

/** Basename with only [A-Za-z0-9._-], no leading dot or underscore, at most 80 chars (extension kept); "cv.pdf" when empty. */
export function safeFilename(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
  if (base === "") return "cv.pdf";
  if (base.length <= FILENAME_MAX) return base;
  const ext = /\.[A-Za-z0-9]{1,10}$/.exec(base)?.[0] ?? "";
  return base.slice(0, FILENAME_MAX - ext.length) + ext;
}

export function cvR2Key(applicationId: string, filename: string): string {
  return `intake/${applicationId}/${safeFilename(filename)}`;
}
