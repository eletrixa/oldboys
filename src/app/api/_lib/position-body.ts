/**
 * Request bodies of the /api/positions routes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/position-body.ts
 * Deps:    zod, src/domain/position (Family, MustHaves)
 * Tested:  src/app/api/_lib/__tests__/position-body.test.ts
 *
 * Key responsibilities:
 * - `CreatePositionBody`: postingText and/or postingUrl (http or https), or a title alone (manual entry); optional title, company and location overrides
 * - `PatchPositionBody`: title, family and/or 1 to 5 must-haves; strict, at least one key
 *
 * Design constraints:
 * - Limits mirror specs/positions-api.md; must-have ids are checked by the domain `MustHave` schema (`mh-` prefix)
 */
import { z } from "zod";
import { Family, MustHaves } from "@/domain/position";

const title = z.string().trim().min(1).max(300);

export const CreatePositionBody = z
  .object({
    postingText: z.string().trim().min(1).max(20_000).optional(),
    postingUrl: z.url({ protocol: /^https?$/ }).max(500).optional(),
    title: title.optional(),
    company: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().min(1).max(200).optional(),
  })
  .refine((b) => b.postingText !== undefined || b.postingUrl !== undefined || b.title !== undefined, { message: "postingText, postingUrl or title is required" });
export type CreatePositionBody = z.infer<typeof CreatePositionBody>;

export const PatchPositionBody = z
  .strictObject({
    title: title.optional(),
    family: Family.optional(),
    must_haves: MustHaves.min(1).optional(),
  })
  .refine((b) => b.title !== undefined || b.family !== undefined || b.must_haves !== undefined, { message: "at least one of title, family, must_haves is required" });
export type PatchPositionBody = z.infer<typeof PatchPositionBody>;
