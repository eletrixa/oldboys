/**
 * Pure helpers for the hosted apply form, used by the client form, the CV uploader and by POST /api/apply.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-fields.ts
 * Deps:    zod, src/domain (application limits, cv-kind, profile-url), ./apply-copy
 * Tested:  src/app/apply/[tag]/__tests__/apply-fields.test.ts
 *
 * Key responsibilities:
 * - Limits are the domain's (CV 10 MiB, pasted CV, name, email, LinkedIn URL, message); sentences come from apply-copy
 * - `checkApplyAll`: every problem in a draft, one per field in form order; `checkApply`: the first, or null; the
 *   server runs the same check, the email is validated once here with z.email()
 * - `cvFileProblem` / `cvRefusal`: the instant check when a file is picked, naming the refused file (and the one that
 *   stays attached, if any)
 * - `isCvFile` (PDF / DOCX / TXT read, older .doc stored only), `formatSize`, `attachedLine`, `replyOutcome`
 * - The bot traps both sides share: the honeypot field `HONEYPOT` and the fill time `FILL_MS` (`MIN_FILL_MS`)
 *
 * Design constraints:
 * - Pure: no DOM; the client bundle takes zod and the domain constants, never unpdf or mammoth (cv-kind, not cv-text)
 * - Convenience on the client, authority on the server: never trust a client pass
 * - A file wins over pasted text: the text is neither checked nor sent when a file is attached
 * - A .doc is unreadable, so it counts as a CV only beside a LinkedIn profile
 * - Never a rate-limit sentence: every status the candidate cannot fix themselves is "try again"
 * - Only 201 is "Received": the 200 the handler gives a bot (honeypot filled, sent too fast) is "try again" on our
 *   page, so a candidate whose browser autofilled the trap is never told an unstored application arrived
 */
import { z } from "zod";
import { COVER_LETTER_MAX, CV_MAX, CV_MAX_BYTES, EMAIL_MAX, LINKEDIN_MAX, NAME_MAX } from "@/domain/application";
import { CV_MEDIA_TYPE, cvKind, type CvKind } from "@/domain/cv-kind";
import { normalizeLinkedinProfile } from "@/domain/profile-url";
import { COPY, type ApplyMessages, type Lang } from "./apply-copy";

export const MESSAGE_MAX = COVER_LETTER_MAX;

/** The honeypot: a name no autofill heuristic maps to a person's data (a "website" field gets filled by browsers). */
export const HONEYPOT = "hp_contact";
/** Milliseconds from the form's first render to Send, set by the page; missing or under MIN_FILL_MS is a bot. */
export const FILL_MS = "fill_ms";
export const MIN_FILL_MS = 3000;

const Email = z.email().max(EMAIL_MAX);

const MB = 1024 * 1024;

/** The English sentences (the default language); `COPY[lang].messages` for any other. */
export const MESSAGES: ApplyMessages = COPY.en.messages;

/** The `<input type=file accept>` value: exactly the accepted formats, by extension and media type. */
export const CV_ACCEPT = [".pdf", ".docx", ".txt", ".doc", ...Object.values(CV_MEDIA_TYPE)].join(",");

export type ApplyField = "name" | "email" | "linkedinUrl" | "cv" | "cvText" | "coverLetter";
export type ApplyProblem = { field: ApplyField; message: string };

export type ApplyDraft = {
  name: string;
  email: string;
  linkedinUrl: string;
  cv: File | null;
  /** Pasted CV text; ignored when `cv` is set. */
  cvText: string;
  message: string;
};

type PickedFile = Pick<File, "name" | "type">;

export const fileKind = (file: PickedFile): CvKind | null => cvKind({ filename: file.name, contentType: file.type });

export function isCvFile(file: PickedFile): boolean {
  return fileKind(file) !== null;
}

export type FileProblem = "type" | "size" | "empty";

/** Type, then size (over the cap, or 0 bytes): why the form would refuse a file, or null. */
export function cvFileProblem(file: PickedFile & Pick<File, "size">): FileProblem | null {
  if (!isCvFile(file)) return "type";
  if (file.size > CV_MAX_BYTES) return "size";
  if (file.size === 0) return "empty";
  return null;
}

/** The sentence for a refused pick: it names the picked file, and the good one that stays attached, if any. */
export function cvRefusal(problem: FileProblem, picked: string, kept: string | null = null, lang: Lang = "en"): string {
  const m = COPY[lang].messages;
  const refused = { type: m.refusedType, size: m.refusedSize, empty: m.refusedEmpty }[problem](picked);
  return kept === null ? refused : `${refused} ${m.stillAttached(kept)}`;
}

/** Of several dropped files, the first the form takes, else the first (its refusal names why). */
export function pickDropped<F extends PickedFile & Pick<File, "size">>(files: readonly F[]): F | undefined {
  return files.find((f) => cvFileProblem(f) === null) ?? files[0];
}

/** Every problem with the draft, at most one per field, in form order; empty when it can be sent. */
export function checkApplyAll(draft: ApplyDraft, lang: Lang = "en"): ApplyProblem[] {
  const m = COPY[lang].messages;
  const name = draft.name.trim();
  const email = draft.email.trim();
  const linkedinUrl = draft.linkedinUrl.trim();
  const cvText = draft.cv === null ? draft.cvText.trim() : "";
  const fileProblem = draft.cv === null ? null : cvFileProblem(draft.cv);
  const problems: (ApplyProblem | null)[] = [
    name === "" || name.length > NAME_MAX ? { field: "name", message: m.name } : null,
    Email.safeParse(email).success ? null : { field: "email", message: m.email },
    linkedinUrl !== "" && (linkedinUrl.length > LINKEDIN_MAX || normalizeLinkedinProfile(linkedinUrl) === null)
      ? { field: "linkedinUrl", message: m.linkedin }
      : linkedinUrl === "" && draft.cv === null && cvText === ""
        ? { field: "linkedinUrl", message: m.linkedinOrCv }
        : null,
    fileProblem !== null
      ? { field: "cv", message: { type: m.cvType, size: m.cvSize, empty: m.cvEmpty }[fileProblem] }
      : draft.cv !== null && fileKind(draft.cv) === "doc" && linkedinUrl === ""
        ? { field: "cv", message: m.cvDoc }
        : null,
    cvText.length > CV_MAX ? { field: "cvText", message: m.cvText } : null,
    draft.message.length > MESSAGE_MAX ? { field: "coverLetter", message: m.message } : null,
  ];
  return problems.filter((p) => p !== null);
}

/** The first problem with the draft, tied to the field to focus, or null when it can be sent. */
export function checkApply(draft: ApplyDraft, lang: Lang = "en"): ApplyProblem | null {
  return checkApplyAll(draft, lang)[0] ?? null;
}

/** "900 bytes", "350 KB", "1.2 MB", "10 MB": one decimal only under 10 MB, never a trailing ".0". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes === 1 ? "1 byte" : `${String(bytes)} bytes`;
  if (bytes < MB) return `${String(Math.round(bytes / 1024))} KB`;
  const mb = bytes / MB;
  return `${String(mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb))} MB`;
}

/** The done card's line naming what was sent. */
export function attachedLine(sent: { cvName: string | null; pastedCv: boolean; linkedin: boolean }, lang: Lang = "en"): string {
  const d = COPY[lang].done;
  const cv = sent.cvName !== null ? d.cvFile(sent.cvName) : sent.pastedCv ? d.cvPasted : null;
  if (cv === null) return d.linkedin;
  return sent.linkedin ? `${cv}${d.andLinkedin}` : cv;
}

/** A send that did not arrive: the sentence, whether to offer Try again, and `field: "cv"` when it belongs under the CV. */
export type SendFailure = { message: string; retry: boolean; field?: "cv" };
export type ReplyOutcome = { kind: "done" } | ({ kind: "error" } & SendFailure);

/**
 * What the candidate sees for a response: 201 is the only "Received"; the handler's 400 sentences as they are (with
 * `field: "cv"` when the handler names the CV), never any other body. Anything else (5xx, the in-flight 503, a 429,
 * the 200 a trapped send gets) asks to try again: the candidate never sees our own limits.
 */
export function replyOutcome(status: number, body: unknown, lang: Lang = "en"): ReplyOutcome {
  const m = COPY[lang].messages;
  if (status === 201) return { kind: "done" };
  if (status === 400) {
    const reply = typeof body === "object" && body !== null ? (body as { error?: unknown; field?: unknown }) : {};
    const message = typeof reply.error === "string" ? reply.error : m.check;
    return reply.field === "cv" ? { kind: "error", message, retry: false, field: "cv" } : { kind: "error", message, retry: false };
  }
  return { kind: "error", message: m.server, retry: true };
}
