/**
 * Intake application body contract shared by the form connector and the apply page (specs/intake/form.md).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/intake-body.ts
 * Deps:    zod, src/domain/application (IntakeInput, IntakeTag, CV_FILENAME_MAX, toCvFile)
 * Tested:  src/app/api/_lib/__tests__/intake-body.test.ts
 *
 * Key responsibilities:
 * - Validate {tag, externalId, name?, email?, phone?, linkedinUrl?, cvText?, cvBase64?, cvFilename?, cvContentType?, coverLetter?}
 *   by deriving from IntakeInput (omit source, note, cv, tag), so the limits cannot drift from the funnel's own parse
 * - At least one of linkedinUrl, cvText, cvBase64; cvBase64 (standard or url-safe) is decoded into cv.bytes;
 *   toCvFile fills a blank or missing cvFilename / cvContentType (cv.pdf, application/pdf)
 *
 * Design constraints:
 * - Lives outside route.ts because Next.js route modules may only export handlers
 * - Output carries no source and no note; each connector adds its own
 */
import { z } from "zod";
import { CV_FILENAME_MAX, IntakeInput, IntakeTag, toCvFile, type CvFile } from "@/domain/application";

/** About 6 MB of file; Apps Script sends at most 6,000,000 bytes. */
const CV_BASE64_MAX = 8_000_000;

const STANDARD_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Standard or url-safe base64, padding and whitespace optional; null when it is not base64. */
function decodeBase64(raw: string): ArrayBuffer | null {
  const body = STANDARD_BASE64.test(raw) ? raw : raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let binary: string;
  try {
    binary = atob(body);
  } catch {
    return null;
  }
  if (binary.length === 0) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const IntakeFormBody = IntakeInput.omit({ source: true, note: true, cv: true, tag: true })
  .extend({
    tag: z.string().trim().toLowerCase().pipe(IntakeTag),
    cvBase64: z.string().min(1).max(CV_BASE64_MAX).optional(),
    cvFilename: z.string().max(CV_FILENAME_MAX).optional(),
    cvContentType: z.string().max(100).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.linkedinUrl === undefined && b.cvText === undefined && b.cvBase64 === undefined) {
      ctx.addIssue({ code: "custom", message: "send linkedinUrl, cvText or cvBase64" });
    }
  })
  .transform(({ cvBase64, cvFilename, cvContentType, ...rest }, ctx) => {
    let cv: CvFile | undefined;
    if (cvBase64 !== undefined) {
      const bytes = decodeBase64(cvBase64);
      if (bytes === null) {
        ctx.addIssue({ code: "custom", path: ["cvBase64"], message: "cvBase64 is not valid base64" });
        return z.NEVER;
      }
      cv = toCvFile({ bytes, filename: cvFilename, contentType: cvContentType });
    }
    return { ...rest, cv };
  });
export type IntakeFormBody = z.infer<typeof IntakeFormBody>;
