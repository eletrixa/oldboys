/**
 * Body schemas for the candidate pool routes: add one person by hand, start enrichment for a set of pooled rows.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/candidate-body.ts
 * Deps:    zod, src/domain/{application (CV_MAX, IntakeInput),profile-url,stable-id}
 * Tested:  src/app/api/_lib/__tests__/candidate-body.test.ts
 *
 * Key responsibilities:
 * - CandidateBody: {name?, email?, linkedinUrl?, cvText?} with a LinkedIn URL or CV text required
 * - manualIntake: the IntakeInput for a hand-added candidate; the external id is stable per (position, profile or CV), so a repeat is a duplicate
 * - EnrichBody: {applicationIds} 1..200 ids of [A-Za-z0-9-]; ids beyond ENRICH_MAX are skipped by startEnrichment, not rejected
 *
 * Design constraints:
 * - Pure: the routes own auth, D1 and the funnel
 * - A LinkedIn URL that does not normalise is passed through raw so the funnel can note it
 */
import { z } from "zod";
import { CV_MAX, EMAIL_MAX, type IntakeInput } from "@/domain/application";
import { normalizeLinkedinProfile } from "@/domain/profile-url";
import { stableId } from "@/domain/stable-id";

/** Most ids one request may name: a whole pool page (handler MAX_POOL); startEnrichment starts the first ENRICH_MAX and skips the rest. */
export const ENRICH_IDS_MAX = 200;

export const CandidateBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.email().max(EMAIL_MAX).optional(),
    linkedinUrl: z.string().trim().min(1).max(500).optional(),
    cvText: z.string().trim().min(1).max(CV_MAX).optional(),
  })
  .refine((b) => b.linkedinUrl !== undefined || b.cvText !== undefined, { message: "linkedinUrl or cvText is required", path: ["linkedinUrl"] });
export type CandidateBody = z.infer<typeof CandidateBody>;

export function manualIntake(positionId: string, body: CandidateBody): IntakeInput {
  const profile = body.linkedinUrl === undefined ? undefined : (normalizeLinkedinProfile(body.linkedinUrl) ?? body.linkedinUrl);
  const key = profile ?? body.cvText;
  if (key === undefined) throw new Error("manualIntake needs a LinkedIn URL or CV text");
  return {
    source: "manual",
    externalId: stableId(positionId, key),
    positionId,
    ...(body.name !== undefined && { name: body.name }),
    ...(body.email !== undefined && { email: body.email }),
    ...(profile !== undefined && { linkedinUrl: profile }),
    ...(body.cvText !== undefined && { cvText: body.cvText }),
  };
}

export const EnrichBody = z.object({
  applicationIds: z.array(z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/)).min(1).max(ENRICH_IDS_MAX),
});
export type EnrichBody = z.infer<typeof EnrichBody>;
