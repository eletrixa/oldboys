/**
 * POST /api/runs body contract (plans/006 profile-first): a LinkedIn profile URL or a pasted CV, plus goal and role.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/run-body.ts
 * Deps:    zod, src/domain/claim (GoalId), src/domain/profile-url, src/domain/application (CV_MAX)
 * Tested:  src/app/api/_lib/__tests__/run-body.test.ts
 *
 * Key responsibilities:
 * - Validate {goal, role?, profileUrl?, cvText?, subject?, anchor?, sourceUrl?}; profileUrl normalised to
 *   https://www.linkedin.com/in/<handle> (no query), cvText at most 20000 chars
 * - At least one of profileUrl, cvText or subject + anchor; due-diligence keeps the subject + anchor pair
 * - Hiring run from the extension on a LinkedIn profile page: sourceUrl doubles as profileUrl
 *
 * Design constraints:
 * - Lives outside route.ts because Next.js route modules may only export handlers
 */
import { z } from "zod";
import { CV_MAX } from "@/domain/application";
import { GoalId } from "@/domain/claim";
import { normalizeLinkedinProfile } from "@/domain/profile-url";

export { CV_MAX };

const ProfileUrl = z
  .string()
  .max(500)
  .transform((raw, ctx) => {
    const url = normalizeLinkedinProfile(raw);
    if (url === null) {
      ctx.addIssue({ code: "custom", message: "profileUrl must be a linkedin.com/in/... profile URL" });
      return z.NEVER;
    }
    return url;
  });

export const StartRunBody = z
  .object({
    goal: GoalId,
    /** Free-text role the manager is hiring for; drives the must-have questions (hiring goal). */
    role: z.string().trim().min(1).max(300).optional(),
    profileUrl: ProfileUrl.optional(),
    cvText: z.string().trim().min(1).max(CV_MAX).optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    anchor: z.string().trim().min(1).max(200).optional(),
    sourceUrl: z.url().max(500).optional(),
  })
  .transform((b) => {
    const fromPage = b.goal === "hiring" && b.sourceUrl !== undefined ? normalizeLinkedinProfile(b.sourceUrl) : null;
    return { ...b, profileUrl: b.profileUrl ?? fromPage ?? undefined };
  })
  .superRefine((b, ctx) => {
    const pair = b.subject !== undefined && b.anchor !== undefined;
    if (b.goal === "hiring" && (pair || b.profileUrl !== undefined || b.cvText !== undefined)) return;
    if (b.goal !== "hiring" && pair) return;
    ctx.addIssue({
      code: "custom",
      message: b.goal === "hiring" ? "send profileUrl, cvText, or subject and anchor" : "send subject and anchor",
    });
  });
export type StartRunBody = z.infer<typeof StartRunBody>;
