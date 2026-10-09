/**
 * Devil's advocate (idea #8): pure rules for challenging confirmed must-have FACTs, shared by the verify seam and the report.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/challenge.ts
 * Deps:    zod, src/domain/art9 (containsArt9Topic), src/domain/cv-check (CV_QUESTION_ID, isCvSource), src/domain/quote (quoteContext, quoteInExcerpt)
 * Tested:  src/domain/__tests__/challenge.test.ts
 *
 * Key responsibilities:
 * - Four grounds only: someone else, fork or copy, tutorial or course, outdated
 * - challengeEligible: FACTs of a must-have question (`mh-`) or a `cv-consistency` match, best rank first, at most
 *   CHALLENGE_MAX
 * - forkPrecheck: every cited public source's excerpt says it is a fork ("forked repository", "forked from"): challenged
 *   without a model
 * - quoteWindow: the cited excerpt around the quote (max ~600 chars) the challenger model reads
 * - screenWhy: a reason that judges the person (JUDGEMENT) or names a sensitive trait (Art. 9) is replaced by a fixed
 *   neutral sentence for its ground
 * - ChallengeRecord: what verify writes into its ledger ref (`ref.challenge`); readChallenge reads the latest one back
 *   defensively (null for runs before this feature)
 *
 * Design constraints:
 * - Pure; a challenge describes the SOURCE, never the person, and may only move a FACT to "verify at the interview"
 * - No schema change: the record lives in the append-only ledger, never in the claims table
 */
import { z } from "zod";
import type { Claim, Source } from "./claim";
import { containsArt9Topic } from "./art9";
import { CV_QUESTION_ID, isCvSource } from "./cv-check";
import { quoteContext, quoteInExcerpt } from "./quote";

export const ChallengeGround = z.enum(["someone-else", "fork-or-copy", "tutorial-or-course", "outdated"]);
export type ChallengeGround = z.infer<typeof ChallengeGround>;

export const Challenge = z.object({ claim_id: z.string().min(1), ground: ChallengeGround, why: z.string() });
export type Challenge = z.infer<typeof Challenge>;

/** Per run: how many findings were challenged, how many held, and the ones that did not hold. */
export const ChallengeRecord = z.object({
  checked: z.number().int().nonnegative(),
  held: z.number().int().nonnegative(),
  challenges: z.array(Challenge),
});
export type ChallengeRecord = z.infer<typeof ChallengeRecord>;

export const CHALLENGE_MAX = 15;
/** Characters of saved text on each side of the quote the challenger sees. */
const WINDOW_RADIUS = 260;
const WINDOW_MAX = 600;
const WHY_MAX = 200;

/** Words that judge the candidate instead of describing a source; never allowed in a CV claim or a challenge reason. */
export const JUDGEMENT = /(?<!\p{L})(?:fake\w*|lie|lies|lied|lying|liar|inflat\w*|dishonest\w*|suspicious\w*|fraud\w*|fabricat\w*|untrustworthy)(?!\p{L})/iu;
/** Extra verdict words a challenge reason may not use (it may say "copied", it may not accuse). */
const ACCUSATION = /(?<!\p{L})(?:cheat\w*|plagiar\w*|steal\w*|stole\w*|stolen|mislead\w*|misrepresent\w*|pretend\w*|deceiv\w*|decept\w*|exaggerat\w*|bogus|scam\w*)(?!\p{L})/iu;

/** Fixed neutral reasons, used when the model's reason fails the screen and for the deterministic fork check. */
export const NEUTRAL_WHY: Record<ChallengeGround, string> = {
  "someone-else": "The source may describe another person, a team or a company page.",
  "fork-or-copy": "The cited repository or content is marked as a fork or copy of another project.",
  "tutorial-or-course": "The cited work looks like a tutorial, template or course exercise.",
  outdated: "The cited evidence is several years old for a current skill or role.",
};

const FORK = /(?<!\p{L})(?:forked repository|forked from|fork of)(?!\p{L})/iu;

const isMustHave = (questionId: string): boolean => questionId.startsWith("mh-") || questionId === CV_QUESTION_ID;

/** Lower rank first, then higher confidence; input order breaks ties. */
export function challengeEligible(claims: readonly Claim[], max = CHALLENGE_MAX): Claim[] {
  return claims
    .filter((c) => c.kind === "FACT" && isMustHave(c.question_id))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.rank - b.c.rank || b.c.confidence - a.c.confidence || a.i - b.i)
    .slice(0, max)
    .map(({ c }) => c);
}

/** Cited public sources of a claim (the pasted CV never proves anything about a repository). */
function citedPublic(claim: Claim, sources: readonly Source[]): Source[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return claim.supports.flatMap((id) => {
    const s = byId.get(id);
    return s === undefined || isCvSource(s) ? [] : [s];
  });
}

/** True when every cited public source says it is a fork; a claim with one own repository among them still holds. */
export function forkPrecheck(claim: Claim, sources: readonly Source[]): boolean {
  const cited = citedPublic(claim, sources);
  return cited.length > 0 && cited.every((s) => FORK.test(s.excerpt));
}

/** The cited source that holds the quote (public before the CV), or the first cited one. */
export function quoteSource(claim: Claim, sources: readonly Source[]): Source | undefined {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const cited = claim.supports.flatMap((id) => byId.get(id) ?? []);
  const ordered = [...cited.filter((s) => !isCvSource(s)), ...cited.filter((s) => isCvSource(s))];
  return ordered.find((s) => claim.quote !== null && quoteInExcerpt(claim.quote, s.excerpt)) ?? ordered[0];
}

/** Saved text around the quote, at most ~600 characters; the excerpt's start when the quote is not found. */
export function quoteWindow(quote: string | null, excerpt: string): string {
  const ctx = quote === null ? null : quoteContext(quote, excerpt, WINDOW_RADIUS);
  const text = ctx === null ? excerpt : `${ctx.before}${ctx.match}${ctx.after}`;
  return text.length <= WINDOW_MAX ? text : `${text.slice(0, WINDOW_MAX - 1)}…`;
}

/** The model's reason when it only describes the source; the fixed neutral sentence for the ground otherwise. */
export function screenWhy(ground: ChallengeGround, why: string): string {
  const text = why.replace(/\s+/g, " ").trim();
  if (text === "" || text.length > WHY_MAX || JUDGEMENT.test(text) || ACCUSATION.test(text) || containsArt9Topic(text)) return NEUTRAL_WHY[ground];
  return text;
}

/** The latest `ref.challenge` among ledger rows (verify writes one per run); null when none parses (older runs). */
export function readChallenge(rows: readonly { ref_json: string | null }[]): ChallengeRecord | null {
  for (const row of [...rows].reverse()) {
    if (row.ref_json === null) continue;
    try {
      const ref: unknown = JSON.parse(row.ref_json);
      if (typeof ref !== "object" || ref === null || !("challenge" in ref)) continue;
      const parsed = ChallengeRecord.safeParse(ref.challenge);
      if (parsed.success) return parsed.data;
    } catch {
      continue;
    }
  }
  return null;
}
