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
 * - `toIntakeInput`: payload (+ tag, + downloaded CV) to one IntakeInput literal (undefined for absent fields) that always passes
 *   the funnel's own parse; limits come from src/domain/application
 * - `tagFor`: offer id mapping wins, else the internal position name when it is a valid tag
 *
 * Design constraints:
 * - Pure: no I/O. Empty, null and invalid fields are dropped (invalid email is noted), over-long ones truncated
 * - A test payload gets its own external id (`test:` prefix) so it can never shadow a real application
 */
import { z } from "zod";
import {
  COVER_LETTER_MAX,
  EMAIL_MAX,
  IntakeTag,
  joinNotes,
  LINKEDIN_MAX,
  NAME_MAX,
  PHONE_MAX,
  type CvFile,
  type IntakeInput,
} from "./application";
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
});
export type StartupJobsWebhook = z.infer<typeof StartupJobsWebhook>;

/** Trimmed text cut to `max`, or undefined when absent or blank. */
function text(value: string | null | undefined, max: number): string | undefined {
  const t = value?.trim() ?? "";
  return t === "" ? undefined : t.slice(0, max);
}

export function toIntakeInput(p: StartupJobsWebhook, tag: string | undefined, cv?: CvFile): IntakeInput {
  const email = text(p.email, EMAIL_MAX);
  const emailOk = email !== undefined && z.email().safeParse(email).success;
  const position = text(p.position, 200);
  const phone = text(p.phone, PHONE_MAX);

  return {
    source: "startupjobs",
    externalId: `${p.test === true ? "test:" : ""}${String(p.offerID)}:${String(p.candidateID)}`,
    tag,
    name: text(p.name, NAME_MAX),
    email: emailOk ? email : undefined,
    phone: phone !== undefined && phone.length >= 3 ? phone : undefined,
    linkedinUrl: text(p.linkedin, LINKEDIN_MAX),
    coverLetter: text(htmlToText(p.why ?? ""), COVER_LETTER_MAX),
    cv,
    note:
      joinNotes(
        p.test === true ? "StartupJobs test payload" : `startupjobs offer ${String(p.offerID)}${position !== undefined ? ` ${position}` : ""}`,
        p.test !== true && email !== undefined && !emailOk ? "invalid email" : null,
      ) ?? undefined,
  };
}

export function tagFor(p: StartupJobsWebhook, byOfferId?: string): string | undefined {
  if (byOfferId !== undefined) return byOfferId;
  const candidate = p.internalPositionName?.trim().toLowerCase();
  const parsed = IntakeTag.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
