/**
 * Profile fit and question rules: the run's role must-haves as the fixed trait list, and the top-5 question cut.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/profile-fit.ts
 * Deps:    src/domain/role-catalog (ROLE_CATALOG, matchRoleTemplate)
 * Tested:  src/recipe/__tests__/profile.test.ts
 *
 * Key responsibilities:
 * - `fitTraits`: the brief's must-haves (`mh-` questions, weight 2) plus the matched catalog template's must-haves not
 *   already in the brief (weight 1); empty without a role. The model only reports status and evidence per id.
 * - `topQuestions`: priority 1 (contradictions, date overlaps) before 2 (unverifiable self-reported results) before 3
 *   (must-have gaps), tie-break by the evidence count of the risk the question closes, stable, max 5
 *
 * Design constraints:
 * - Pure, no I/O; no model-invented roles or traits
 */
import { matchRoleTemplate, ROLE_CATALOG } from "@/domain/role-catalog";
import type { StepContext } from "@/recipe/sources/types";

export const MAX_QUESTIONS = 5;
export const MUST_HAVE_WEIGHT = 2;
export const CATALOG_WEIGHT = 1;

export type FitTrait = { id: string; trait: string; text: string; weight: number };

/** The run's role traits: brief must-haves first (weight 2), then catalog extras (weight 1); [] without a role. */
export function fitTraits(ctx: Pick<StepContext, "role" | "questions">): FitTrait[] {
  if (ctx.role === null || ctx.role.trim() === "") return [];
  const brief = ctx.questions
    .filter((q) => q.id.startsWith("mh-"))
    .map((q) => ({ id: q.id, trait: (q.title ?? q.text).trim(), text: q.text, weight: MUST_HAVE_WEIGHT }));
  // ponytail: static catalog, same data the D1 role_templates seed comes from; pass templates via ctx if they become editable
  const extras = (matchRoleTemplate(ctx.role, ROLE_CATALOG)?.must_haves ?? []).map((m) => ({ id: m.id, trait: (m.title ?? m.text).trim(), text: m.text, weight: CATALOG_WEIGHT }));
  const seen = new Set<string>();
  return [...brief, ...extras].filter((t) => {
    const keys = [t.id, `t:${t.trait.toLowerCase()}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
}

/** Best 5: priority ascending, then evidence count of the closed risk descending; stable within ties. */
export function topQuestions<Q extends { priority: number }>(questions: readonly Q[], riskEvidence: (q: Q) => number): Q[] {
  return questions
    .map((q, i) => ({ q, i, n: riskEvidence(q) }))
    .sort((a, b) => a.q.priority - b.q.priority || b.n - a.n || a.i - b.i)
    .slice(0, MAX_QUESTIONS)
    .map((x) => x.q);
}
