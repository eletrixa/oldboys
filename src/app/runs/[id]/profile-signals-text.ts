/**
 * Profile signals text: the plain lines the interview kit prints and the asks both the kit and the card use.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-signals-text.ts
 * Deps:    src/domain/profile-signals (types, caveats), ./code-profile-text (safeHref)
 * Tested:  src/app/runs/[id]/__tests__/profile-signals-card.test.ts
 *
 * Key responsibilities:
 * - signalLines: "sentence (source: url)" per signal, then "Not checked: …" lines, then the caveats; [] without signals data
 * - askLines: the distinct non-null interview questions, in signal order
 * - safeHref: re-exported http(s)-only link check
 *
 * Design constraints:
 * - Pure; the sentences are written by the domain and only joined here, never reworded
 */
import { PROFILE_SIGNAL_CAVEATS, type ProfileSignals } from "@/domain/profile-signals";
import { safeHref } from "./code-profile-text";

export { safeHref };

export function signalLines(ps: ProfileSignals | null): string[] {
  if (ps === null) return [];
  return [
    ...ps.signals.map((s) => {
      const href = safeHref(s.source_url);
      return href === null ? s.text : `${s.text} (source: ${href})`;
    }),
    ...ps.not_checked.map((n) => `Not checked: ${n}`),
    ...PROFILE_SIGNAL_CAVEATS,
  ];
}

export function askLines(ps: ProfileSignals | null): string[] {
  if (ps === null) return [];
  return [...new Set(ps.signals.flatMap((s) => (s.ask === null ? [] : [s.ask])))];
}
