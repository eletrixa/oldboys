/**
 * Two numbers a results row shows from a stored brief: the position fit % and the count of independent evidence lines.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/profile-stats.ts
 * Deps:    ./claim (Profile)
 * Tested:  src/domain/__tests__/profile-stats.test.ts
 *
 * Key responsibilities:
 * - briefStats: brief_json (raw D1 text) to {fit_pct, independent}; fit = profile.position_fit[0].fit_pct
 * - independent = distinct evidence lines (source + quote) with strength "strong" across every profile section
 *
 * Design constraints:
 * - Pure; malformed or pre-profile briefs give {fit_pct: null, independent: 0} and never throw
 * - Fit is the evidence share of the position's must-haves, never a score of the person; no ranking here
 */
import { Profile, type ProfileEvidence } from "./claim";

export type BriefStats = { fit_pct: number | null; independent: number };

const NONE: BriefStats = { fit_pct: null, independent: 0 };

export function briefStats(briefJson: string | null): BriefStats {
  if (briefJson === null) return NONE;
  let raw: unknown;
  try {
    raw = JSON.parse(briefJson);
  } catch {
    return NONE;
  }
  const parsed = Profile.safeParse(typeof raw === "object" && raw !== null && "profile" in raw ? raw.profile : null);
  if (!parsed.success) return NONE;
  const p = parsed.data;
  const lines: ProfileEvidence[] = [
    ...[...p.achievements, ...p.risks, ...p.history, ...p.personality.traits].flatMap((i) => i.evidence),
    ...p.personality.evidence,
    ...p.position_fit.flatMap((f) => f.traits.flatMap((t) => t.evidence)),
  ];
  const strong = new Set(lines.filter((e) => e.strength === "strong").map((e) => `${e.source_id}\u0000${e.quote}`));
  return { fit_pct: p.position_fit[0]?.fit_pct ?? null, independent: strong.size };
}
