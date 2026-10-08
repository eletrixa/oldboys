/**
 * StartupJobs webhook payload schema and its mapping to the intake contract.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/startupjobs.ts
 * Deps:    zod, src/domain/application, src/domain/html-text
 * Tested:  src/domain/__tests__/startupjobs.test.ts
 *
 * Key responsibilities:
 * - `StartupJobsWebhook`: the documented payload (specs/intake/startupjobs.md), tolerant of null fields and string ids
 * - `toIntakeInput`: payload (+ tag, + downloaded CV) to an IntakeInput that always passes the funnel's own parse
 * - `tagFor`: offer id mapping wins, else the internal position name when it is a valid tag
 *
 * Design constraints:
 * - Pure: no I/O. Empty, null and invalid fields are dropped (invalid email is noted), over-long ones truncated
 * - A test payload gets its own external id (`test:` prefix) so it can never shadow a real application
 */
import { z } from "zod";
import { IntakeTag, type CvFile, type IntakeInput } from "./application";
import { htmlToText } from "./html-text";

const optionalText = z.string().nullish();

export const StartupJobsWebhook = z.looseObject({
  candidateID: z.coerce.number().int(),
  offerID: z.coerce.number().int(),
  name: optionalText,
  email: optionalText,
  phone: optionalText,
  why: optionalText,
  linkedin: optionalText,
  position: optionalText,
  internalPositionName: optionalText,
  files: z
    .array(z.string())
    .nullish()
    .transform((files) => files ?? []),
  test: z.boolean().nullish(),
  date: optionalText,
});
export type StartupJobsWebhook = z.infer<typeof StartupJobsWebhook>;

const NAME_MAX = 200;
const PHONE_MAX = 40;
const LINKEDIN_MAX = 500;
const COVER_LETTER_MAX = 10_000;
const NOTE_MAX = 1000;

/** Trimmed text cut to `max`, or undefined when absent or blank. */
function text(value: string | null | undefined, max: number): string | undefined {
  const t = value?.trim() ?? "";
  return t === "" ? undefined : t.slice(0, max);
}

export function toIntakeInput(p: StartupJobsWebhook, tag: string | undefined, cv?: CvFile): IntakeInput {
  const notes: string[] = [];
  const email = text(p.email, 200);
  const emailOk = email !== undefined && z.email().safeParse(email).success;
  if (email !== undefined && !emailOk) notes.push("invalid email");

  const position = text(p.position, 200);
  const note = p.test === true ? "StartupJobs test payload" : [`startupjobs offer ${String(p.offerID)}${position !== undefined ? ` ${position}` : ""}`, ...notes].join("; ");

  const phone = text(p.phone, PHONE_MAX);
  const input: IntakeInput = {
    source: "startupjobs",
    externalId: `${p.test === true ? "test:" : ""}${String(p.offerID)}:${String(p.candidateID)}`,
    note: note.slice(0, NOTE_MAX),
  };
  if (tag !== undefined) input.tag = tag;
  const name = text(p.name, NAME_MAX);
  if (name !== undefined) input.name = name;
  if (emailOk) input.email = email;
  if (phone !== undefined && phone.length >= 3) input.phone = phone;
  const linkedinUrl = text(p.linkedin, LINKEDIN_MAX);
  if (linkedinUrl !== undefined) input.linkedinUrl = linkedinUrl;
  const coverLetter = text(htmlToText(p.why ?? ""), COVER_LETTER_MAX);
  if (coverLetter !== undefined) input.coverLetter = coverLetter;
  if (cv !== undefined) input.cv = cv;
  return input;
}

export function tagFor(p: StartupJobsWebhook, lookup: { byOfferId?: string }): string | undefined {
  if (lookup.byOfferId !== undefined) return lookup.byOfferId;
  const candidate = p.internalPositionName?.trim().toLowerCase();
  const parsed = IntakeTag.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
