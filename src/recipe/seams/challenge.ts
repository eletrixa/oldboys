/**
 * Devil's advocate inside verify (idea #8): one extra model call tries to break each confirmed must-have FACT.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/challenge.ts
 * Deps:    zod, src/domain/challenge
 * Tested:  src/recipe/__tests__/challenge.test.ts
 *
 * Key responsibilities:
 * - Eligible claims (challengeEligible: must-have or CV-match FACTs, best rank first, at most 15); none = no call
 * - A claim whose every cited public source is a fork is challenged as "fork or copy" without the model
 * - One `verify` model call for the rest: id, claim, quote, source URL, retrieved date and ~600 chars around the quote;
 *   the model answers holds=true/false with one of four grounds and a short reason about the SOURCE
 * - Reasons go through screenWhy; unknown ids, second answers for one id and "does not hold" without a ground are ignored
 * - Returns the ChallengeRecord (checked, held, challenges); verify downgrades the challenged claims to INFERENCE
 *   (synthesize then moves them to "To verify") and puts the record into its ledger ref
 *
 * Design constraints:
 * - Downgrade only, never promote, never add a claim; an LLM failure keeps the claims as they were, with a note
 * - Rates the evidence, never the candidate
 */
import { z } from "zod";
import type { Claim, Source } from "@/domain/claim";
import { type Challenge, ChallengeGround, type ChallengeRecord, NEUTRAL_WHY, challengeEligible, forkPrecheck, quoteSource, quoteWindow, screenWhy } from "@/domain/challenge";
import type { Ports } from "@/domain/ports";
import type { StepOutcome } from "@/recipe/sources/types";

const Verdicts = z.array(z.object({ id: z.string(), holds: z.boolean(), ground: ChallengeGround.nullable(), why: z.string() }));

export const CHALLENGE_SYSTEM = [
  "You are a devil's advocate for a research report. For each claim, try to break it using the source shown, on these four grounds only:",
  "someone-else: the work or page is about or by another person, a team or company page, or a namesake;",
  "fork-or-copy: the repository or content is forked, copied or mirrored from someone else's;",
  "tutorial-or-course: it is a template, tutorial, bootcamp or course exercise, or a starter kit;",
  "outdated: the evidence shown is clearly older than about 5 years while the claim is phrased as a current skill or role.",
  "Answer holds=true with ground=null and why=\"\" when none of the grounds clearly applies. Answer holds=false only with the one ground that applies and a short neutral `why` (max 20 words) describing the SOURCE, never the person: no judgement, no motives, nothing about health, beliefs, origin or other personal traits.",
  "You may only answer for the ids given. Never add claims, never strengthen a claim.",
].join("\n");

function block(c: Claim, sources: readonly Source[]): string {
  const s = quoteSource(c, sources);
  return [
    `id=${c.id}`,
    `claim: ${c.text}`,
    `quote: ${c.quote ?? ""}`,
    `source: ${s?.url ?? ""}`,
    `retrieved: ${s?.fetched_at ?? ""}`,
    `around the quote: ${quoteWindow(c.quote, s?.excerpt ?? "")}`,
  ].join("\n");
}

/**
 * Challenges the eligible FACTs of `claims` and returns the record; the caller downgrades `record.challenges`.
 * Adds the model call, its cost and notes to `out`.
 */
export async function challengeClaims(claims: readonly Claim[], sources: readonly Source[], ports: Ports, out: StepOutcome): Promise<ChallengeRecord> {
  const eligible = challengeEligible(claims);
  const challenges: Challenge[] = [];
  const forks = eligible.filter((c) => forkPrecheck(c, sources));
  for (const c of forks) challenges.push({ claim_id: c.id, ground: "fork-or-copy", why: NEUTRAL_WHY["fork-or-copy"] });
  const asked = eligible.filter((c) => !forks.includes(c));
  let answered = 0;
  if (asked.length > 0) {
    try {
      const r = await ports.llm({ model: "verify", system: CHALLENGE_SYSTEM, prompt: asked.map((c) => block(c, sources)).join("\n\n"), schema: Verdicts });
      out.calls += 1;
      out.cost_usd += r.cost_usd;
      const pending = new Set(asked.map((c) => c.id));
      for (const v of r.value) {
        if (!pending.delete(v.id)) continue; // unknown id or second answer for one claim
        answered += 1;
        // "Does not hold" without a ground names no reason to show: it counts as held
        if (!v.holds && v.ground !== null) challenges.push({ claim_id: v.id, ground: v.ground, why: screenWhy(v.ground, v.why) });
      }
    } catch (error) {
      out.notes.push(`devil's advocate model failed, claims kept: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const ch of challenges) out.notes.push(`downgraded (devil's advocate, ${ch.ground}): ${ch.claim_id}`);
  const checked = forks.length + answered;
  return { checked, held: checked - challenges.length, challenges };
}
