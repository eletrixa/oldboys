/**
 * Intake application body contract shared by the form connector and the apply page (specs/intake/form.md).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/intake-body.ts
 * Deps:    zod, src/domain/application (IntakeTag, CV_MAX, CvFile)
 * Tested:  src/app/api/_lib/__tests__/intake-body.test.ts
 *
 * Key responsibilities:
 * - Validate {tag, externalId, name?, email?, phone?, linkedinUrl?, cvText?, cvBase64?, cvFilename?, cvContentType?, coverLetter?}
 *   with the same limits as IntakeInput, so the funnel's own parse cannot fail on a validated body
 * - At least one of linkedinUrl, cvText, cvBase64; cvBase64 (standard or url-safe) is decoded into cv.bytes
 *   with default filename cv.pdf and content type application/pdf
 *
 * Design constraints:
 * - Lives outside route.ts because Next.js route modules may only export handlers
 * - Output carries no source; each connector adds its own
 */
import { z } from "zod";
import { CV_MAX, IntakeTag, type CvFile } from "@/domain/application";

/** About 6 MB of file; Apps Script sends at most 6,000,000 bytes. */
const CV_BASE64_MAX = 8_000_000;

/** Standard or url-safe base64, padding and whitespace optional; null when it is not base64. */
function decodeBase64(raw: string): ArrayBuffer | null {
  const body = raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]+$/.test(body) || body.length % 4 === 1) return null;
  const binary = atob(body.padEnd(Math.ceil(body.length / 4) * 4, "="));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}

export const IntakeFormBody = z
  .object({
    tag: z.string().trim().toLowerCase().pipe(IntakeTag),
    externalId: z.string().min(1).max(300),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.email().max(200).optional(),
    phone: z.string().trim().min(3).max(40).optional(),
    linkedinUrl: z.string().max(500).optional(),
    cvText: z.string().trim().min(1).max(CV_MAX).optional(),
    cvBase64: z.string().min(1).max(CV_BASE64_MAX).optional(),
    cvFilename: z.string().min(1).max(200).default("cv.pdf"),
    cvContentType: z.string().max(100).default("application/pdf"),
    coverLetter: z.string().trim().min(1).max(10_000).optional(),
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
      cv = { bytes, filename: cvFilename, contentType: cvContentType };
    }
    return { ...rest, cv };
  });
export type IntakeFormBody = z.infer<typeof IntakeFormBody>;
