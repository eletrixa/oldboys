/**
 * "Confidence in this brief" as plain lines for the interview kit and other text exports (plans/014).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/trust-box-text.ts
 * Deps:    ./trust-box (TrustBox, labels, TRUST_BOX_NOTE)
 * Tested:  src/app/runs/[id]/__tests__/trust-box-text.test.ts
 *
 * Key responsibilities:
 * - trustBoxLines(box): the evidence line ("Verified facts: 78% (11 facts, 3 inferences)" or the reason none is shown), the
 *   sources line, the devil's advocate line, the identity line, one line per check with its ask and links, the honesty note
 *
 * Design constraints:
 * - Pure; English only, like the card
 */
import { TRUST_BOX_NOTE, type TrustBox, evidenceLabel, sourcesLabel } from "./trust-box";

export type TrustLine = { text: string; urls: string[] };

export function trustBoxLines(box: TrustBox | null): TrustLine[] {
  if (box === null) return [];
  const e = box.evidence;
  const i = box.identity;
  const counts = i.counts.endsWith(".") ? i.counts : `${i.counts}.`;
  const identity = `${i.label}${i.supplied ? " (from the profile link you supplied)" : ""}: ${counts}${i.reasons.length > 0 ? ` Matched on ${i.reasons.join("; ")}.` : ""}`;
  return [
    { text: e.pct === null ? `Verified facts: not shown (${e.unavailable ?? evidenceLabel(e)})` : `Verified facts: ${String(e.pct)}% (${evidenceLabel(e)})`, urls: [] },
    { text: sourcesLabel(e.sources), urls: [] },
    ...(e.challenge === null ? [] : [{ text: e.challenge, urls: [] }]),
    { text: identity, urls: [] },
    ...box.checks.map((c) => ({ text: `${c.label}: ${c.text}${c.ask === null ? "" : ` ${c.ask}`}`, urls: c.urls })),
    { text: TRUST_BOX_NOTE, urls: [] },
  ];
}
