/**
 * Devil's advocate (idea #8) in the report: plain HR words per ground, the state mapping, the "To verify" reasons and the summary line.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/challenge.ts
 * Deps:    src/domain/challenge (types), src/domain/claim (types), ./state (RunState, briefSections)
 * Tested:  src/app/runs/[id]/__tests__/challenge.test.ts
 *
 * Key responsibilities:
 * - challengeState: the ledger record -> `challenges` (only for claims the run still has) and `challenge_summary`
 *   {checked, held, moved}; empty / null for runs before this feature
 * - challengeTag: "Challenged: may be a fork, not own work — ask at the interview" next to a claim
 * - challengeReason: the same words plus the source-level reason, for "To verify" and the interview kit
 * - toVerifyItems: the brief's to_verify with the reason of a challenged item; a challenged claim the brief's cap cut
 *   off is appended, but only when the brief shows that claim (never a claim the Art. 9 filter removed)
 * - challengeLine: "Devil's advocate: checked 5 findings, 4 held, 1 moved to the interview"; null when nothing was checked
 *
 * Design constraints:
 * - Pure and server-safe; the words rate the research evidence, never the candidate
 */
import type { Challenge, ChallengeGround, ChallengeRecord } from "@/domain/challenge";
import type { Brief, Claim } from "@/domain/claim";
import { type RunState, briefSections } from "./state";

export type ChallengeSummary = { checked: number; held: number; moved: number };

/** What a ground means for the recruiter, after "may be" / "evidence may be". */
export const GROUND_LABEL: Record<ChallengeGround, string> = {
  "someone-else": "may be about someone else",
  "fork-or-copy": "may be a fork, not own work",
  "tutorial-or-course": "may be a tutorial or course exercise",
  outdated: "evidence may be outdated",
};

export function challengeState(record: ChallengeRecord | null, claimIds: ReadonlySet<string>): { challenges: Challenge[]; challenge_summary: ChallengeSummary | null } {
  if (record === null) return { challenges: [], challenge_summary: null };
  const challenges = record.challenges.filter((c) => claimIds.has(c.claim_id));
  return { challenges, challenge_summary: { checked: record.checked, held: record.held, moved: record.challenges.length } };
}

/** Challenge per claim id; empty for older runs. */
export function challengesById(state: Pick<RunState, "challenges">): ReadonlyMap<string, Challenge> {
  return new Map((state.challenges ?? []).map((c) => [c.claim_id, c]));
}

export function challengeTag(ground: ChallengeGround): string {
  return `Challenged: ${GROUND_LABEL[ground]} — ask at the interview`;
}

/** "Challenged: may be a fork, not own work (The cited repository is marked as a fork …)". */
export function challengeReason(c: Pick<Challenge, "ground" | "why">): string {
  const why = c.why.trim().replace(/\.$/, "");
  return why === "" ? `Challenged: ${GROUND_LABEL[c.ground]}` : `Challenged: ${GROUND_LABEL[c.ground]} (${why})`;
}

/** Claim ids the brief shows (sections, or per question for older briefs). */
function shownIds(brief: Brief): Set<string> {
  const sections = briefSections(brief);
  return new Set((sections ?? brief.per_question).flatMap((s) => s.claim_ids));
}

export type ToVerifyItem = { text: string; reason: string | null };

export function toVerifyItems(brief: Brief, claims: readonly Claim[], challenges: ReadonlyMap<string, Challenge>): ToVerifyItem[] {
  const challenged = claims.filter((c) => challenges.has(c.id));
  const reasonOf = (text: string): string | null => {
    const c = challenged.find((x) => x.text === text);
    const ch = c === undefined ? undefined : challenges.get(c.id);
    return ch === undefined ? null : challengeReason(ch);
  };
  const listed = brief.to_verify.map((text) => ({ text, reason: reasonOf(text) }));
  const shown = shownIds(brief);
  const missing = challenged.filter((c) => c.kind === "INFERENCE" && shown.has(c.id) && !brief.to_verify.includes(c.text));
  return [...listed, ...missing.map((c) => ({ text: c.text, reason: reasonOf(c.text) }))];
}

const count = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

export function challengeLine(summary: ChallengeSummary | null | undefined): string | null {
  if (summary === null || summary === undefined || summary.checked === 0) return null;
  return `Devil's advocate: checked ${count(summary.checked, "finding")}, ${String(summary.held)} held, ${String(summary.moved)} moved to the interview`;
}
