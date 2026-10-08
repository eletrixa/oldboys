/**
 * Mark: what the extension captures from the page the user is looking at, and nothing more.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/mark.ts
 * Deps:    zod
 * Tested:  extension/src/lib/__tests__/mark.test.ts
 *
 * Key responsibilities:
 * - parseProfile: LinkedIn /in/ page → Mark from URL, visible h1 and location line (title fallback)
 * - markFromSelection: any page → Mark from the selected text and the page's hostname
 *
 * Design constraints:
 * - Pure; takes strings, never the DOM. Reads only fields visible to the user (plans/004 risk register)
 * - The source URL is normalised to the profile path so the API can dedupe repeated marks
 */
import { z } from "zod";
import { GoalId } from "@domain/claim";

export const Mark = z.object({
  subject: z.string().trim().min(1).max(200),
  anchor: z.string().trim().min(1).max(200),
  goal: GoalId,
  sourceUrl: z.url().max(500),
});
export type Mark = z.infer<typeof Mark>;

export type ProfilePage = {
  url: string;
  h1: string | null;
  title: string;
  locationLine: string | null;
};

const PROFILE_URL = /^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+/i;

/** "Jan Novák - CTO - Firma | LinkedIn" → "Jan Novák". */
function subjectFromTitle(title: string): string {
  return title.split(" | ")[0]?.split(" - ")[0]?.trim() ?? "";
}

export function parseProfile(page: ProfilePage, goal: GoalId): Mark | null {
  const match = PROFILE_URL.exec(page.url);
  if (!match) return null;
  const sourceUrl = match[0];
  const subject = page.h1?.trim() ?? "";
  const anchor = page.locationLine?.trim() ?? "";
  const result = Mark.safeParse({
    subject: subject.length > 0 ? subject : subjectFromTitle(page.title),
    anchor: anchor.length > 0 ? anchor : sourceUrl,
    goal,
    sourceUrl,
  });
  return result.success ? result.data : null;
}

export function markFromSelection(selection: string, pageUrl: string, goal: GoalId): Mark | null {
  let hostname: string;
  try {
    hostname = new URL(pageUrl).hostname;
  } catch {
    return null;
  }
  const result = Mark.safeParse({ subject: selection, anchor: hostname, goal, sourceUrl: pageUrl });
  return result.success ? result.data : null;
}
