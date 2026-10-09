/**
 * Public run state: what the open GET /api/runs/:id/state may expose of the claims, quote contexts, brief reasons and failure.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/state/public-state.ts
 * Deps:    zod, src/domain/art9 (containsArt9Topic), src/domain/quote (quoteContexts), src/domain/scrub (scrubReason),
 *          src/app/runs/[id]/state (briefSections, RunState type)
 * Tested:  src/app/api/runs/[id]/state/__tests__/public-state.test.ts
 *
 * Key responsibilities:
 * - claims: only the claims the stored brief shows (per_question and sections claim_ids), never one whose text or quote
 *   touches a GDPR Art. 9 topic; [] while there is no brief (no consumer reads claims before it)
 * - quote_contexts: quoteContexts over the kept claims and the excerpts of confirmed sources (identity 'merged') only,
 *   so a namesake's page text never leaves the server
 * - brief.not_searched / brief.searched_empty reasons and failure go through scrubReason (no URLs with queries,
 *   e-mails or phone numbers); the rest of the brief is returned as stored
 *
 * Design constraints:
 * - Pure; the route has no auth (unguessable id), so anything the run page does not show stays out
 * - Special-category data is dropped, never masked; unconfirmed hits are never presented as the person's data
 */
import { z } from "zod";
import { containsArt9Topic } from "@/domain/art9";
import type { Brief, Claim } from "@/domain/claim";
import { type ClaimQuoteContext, quoteContexts } from "@/domain/quote";
import { scrubReason } from "@/domain/scrub";
import { briefSections, type RunState } from "@/app/runs/[id]/state";

export type PublicStateInput = {
  claims: readonly Claim[];
  sources: readonly { id: string; identity: string; excerpt: string }[];
  brief: Brief | null;
  failure: string | null;
};

export type PublicState = Pick<RunState, "claims" | "brief" | "failure"> & { quote_contexts: ClaimQuoteContext[] };

const Gaps = z.array(z.object({ source: z.string(), reason: z.string() }).loose());

/** Gap list with scrubbed reasons; [] when the stored value is not a gap list (dropping is the safe direction). */
function scrubbedGaps(value: unknown): Brief["not_searched"] {
  const parsed = Gaps.safeParse(value);
  return parsed.success ? parsed.data.map((g) => ({ ...g, reason: scrubReason(g.reason) })) : [];
}

/** The stored brief with its gap reasons scrubbed; `searched_empty` stays absent on older briefs that lack it. */
export function publicBrief(brief: Brief): Brief {
  const fields: Record<string, unknown> = brief;
  return {
    ...brief,
    not_searched: scrubbedGaps(fields.not_searched),
    ...(fields.searched_empty === undefined ? {} : { searched_empty: scrubbedGaps(fields.searched_empty) }),
  };
}

/** Claim ids the brief shows: every per-question list and every section list. */
function briefClaimIds(brief: Brief): Set<string> {
  return new Set([...brief.per_question, ...(briefSections(brief) ?? [])].flatMap((s) => s.claim_ids));
}

const touchesArt9 = (c: Claim): boolean => containsArt9Topic(c.text) || (c.quote !== null && containsArt9Topic(c.quote));

export function publicState(input: PublicStateInput): PublicState {
  const shown = input.brief === null ? new Set<string>() : briefClaimIds(input.brief);
  const claims = input.claims.filter((c) => shown.has(c.id) && !touchesArt9(c));
  const confirmed = new Map(input.sources.filter((s) => s.identity === "merged").map((s) => [s.id, s.excerpt]));
  return {
    claims,
    quote_contexts: quoteContexts(claims, confirmed),
    brief: input.brief === null ? null : publicBrief(input.brief),
    failure: input.failure === null ? null : scrubReason(input.failure),
  };
}
