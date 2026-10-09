/**
 * Body schema for POST /api/intake/tags and the D1 duplicate-key classifier.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/tags/tag-body.ts
 * Deps:    zod, src/domain/{application (IntakeTag),position (POSITION_ID)}
 * Tested:  src/app/api/intake/tags/__tests__/tag-body.test.ts
 *
 * Key responsibilities:
 * - TagBody: {tag, role 1..300 (optional when positionId is given), positionId?, goal hiring only (default), startupjobsOfferId? <= 40}; the tag is trimmed and lowercased, then checked against IntakeTag
 * - duplicateField: which unique column (tag primary key or startupjobs_offer_id index) a D1 error names, else null
 *
 * Design constraints:
 * - Pure: the route owns D1 and the 409
 */
import { z } from "zod";
import { IntakeTag } from "@/domain/application";
import { POSITION_ID } from "@/domain/position";

export const TagBody = z.object({
  tag: z.string().trim().toLowerCase().pipe(IntakeTag),
  /** Optional when `positionId` is given: the route then uses the position's title. */
  role: z.string().trim().min(1).max(300).optional(),
  /** Binds the tag to a position: applications through it pool there instead of starting a run. */
  positionId: POSITION_ID.optional(),
  /** Hiring only: the funnel starts runs from a profile URL or CV, and a due-diligence run needs subject + anchor. */
  goal: z
    .literal("hiring", { error: "intake tags are hiring-only: a due-diligence run needs subject and anchor, which an application does not carry" })
    .default("hiring"),
  startupjobsOfferId: z.string().trim().min(1).max(40).optional(),
}).refine((b) => b.role !== undefined || b.positionId !== undefined, { message: "role or positionId is required", path: ["role"] });
export type TagBody = z.infer<typeof TagBody>;

/** "tag" or "startupjobs_offer_id" when `err` is a D1 UNIQUE violation on intake_tags; null for anything else. */
export function duplicateField(err: unknown): "tag" | "startupjobs_offer_id" | null {
  if (!(err instanceof Error)) return null;
  const hit = /UNIQUE constraint failed: intake_tags\.(tag|startupjobs_offer_id)\b/.exec(err.message);
  return hit?.[1] === "tag" || hit?.[1] === "startupjobs_offer_id" ? hit[1] : null;
}
