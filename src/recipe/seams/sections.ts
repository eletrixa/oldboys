/**
 * Brief sections: the finished brief cut by what the run found, each with a deterministic confidence and its reason.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/sections.ts
 * Deps:    src/domain/confidence, src/recipe/sources/types (platformOf)
 * Tested:  src/recipe/__tests__/sections.test.ts
 *
 * Key responsibilities:
 * - One section per question with at least one kept claim (short title; role must-haves "mh-*" by their text)
 * - One "Social presence" section for confirmed social profiles no claim cites, one section per other platform
 *   group (GitHub, business registry, web pages) whose confirmed sources no claim cites
 * - Counts per section feed sectionConfidence: facts need a merged supporting source, sources are distinct ids
 *
 * Design constraints:
 * - Pure, called by synthesizeBrief; never asks the model, so a degraded brief gets the same sections
 * - Questions with nothing found get no section (they stay in the gap lists); order is recipe order, the UI sorts
 */
import { sectionConfidence } from "@/domain/confidence";
import type { Brief, BriefSection, Claim, Source } from "@/domain/claim";
import { platformOf } from "@/recipe/sources/types";

const QUESTION_TITLE: Record<string, string> = {
  "current-role": "Current role",
  "career-history": "Career history",
  "public-code": "Public code",
  "public-talks": "Talks and writing",
  "location-match": "Location",
  contradictions: "Contradictions",
  "legal-entity": "Legal entity",
  "statutory-bodies": "Statutory bodies and owners",
  "registered-address": "Registered address",
  "legal-signals": "Legal signals",
  "public-reputation": "Public reputation",
  "social-consistency": "Social consistency",
};

const SOCIAL: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  facebook: "Facebook",
};
const GROUP_TITLE: Record<string, string> = { github: "GitHub", ares: "Business registry", web: "Web pages" };
const TITLE_MAX = 90;

/** Short human title: known ids get a fixed label, role must-haves and unknown ids their own text. */
export function sectionTitle(q: { id: string; text: string }): string {
  const known = QUESTION_TITLE[q.id];
  if (known !== undefined) return known;
  const t = q.text.trim().replace(/\?$/, "");
  return t.length <= TITLE_MAX ? t : `${t.slice(0, TITLE_MAX - 1)}…`;
}

function section(id: string, title: string, claims: readonly Claim[], sourceIds: readonly string[], identityOf: ReadonlyMap<string, Source["identity"]>, summary: string): BriefSection {
  const isMerged = (sid: string): boolean => identityOf.get(sid) === "merged";
  const ids = [...new Set(sourceIds)];
  const conf = sectionConfidence({
    claims: claims.length,
    facts: claims.filter((c) => c.kind === "FACT" && c.supports.some(isMerged)).length,
    inferences: claims.filter((c) => c.kind === "INFERENCE").length,
    sources: ids.length,
    confirmed_sources: ids.filter(isMerged).length,
    contradictions: claims.filter((c) => c.contradicts.length > 0).length,
  });
  return { id, title, ...conf, claim_ids: claims.map((c) => c.id), source_ids: ids, summary };
}

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/**
 * `confirmedSources`: merged identity, not rejected (as in evidenceOf); `allSources` gives the identity of every
 * cited source; `perQuestion` carries the summaries (model or fallback) already written for the brief.
 */
export function sectionsOf(
  questions: readonly { id: string; text: string }[],
  claims: readonly Claim[],
  perQuestion: Brief["per_question"],
  allSources: readonly Source[],
  confirmedSources: readonly Source[],
): BriefSection[] {
  const identityOf = new Map(allSources.map((s) => [s.id, s.identity]));
  const summaryOf = new Map(perQuestion.map((q) => [q.question_id, q.summary]));
  const fromQuestions = questions.flatMap((q) => {
    const cs = claims.filter((c) => c.question_id === q.id);
    if (cs.length === 0) return [];
    return [section(q.id, sectionTitle(q), cs, cs.flatMap((c) => c.supports), identityOf, summaryOf.get(q.id) ?? "")];
  });

  const cited = new Set(claims.flatMap((c) => c.supports));
  const byPlatform = Map.groupBy(confirmedSources, (s) => platformOf(s.url));
  const uncited = [...byPlatform].filter(([, ss]) => !ss.some((s) => cited.has(s.id)));
  const social = uncited.filter(([p]) => p in SOCIAL);
  const socialSection =
    social.length === 0
      ? []
      : [
          section(
            "social-presence",
            "Social presence",
            [],
            social.flatMap(([, ss]) => ss.map((s) => s.id)),
            identityOf,
            `Confirmed profiles on ${social.map(([p]) => SOCIAL[p] ?? p).join(", ")}; nothing from them is used in a claim.`,
          ),
        ];
  const groups = uncited
    .filter(([p]) => !(p in SOCIAL))
    .map(([p, ss]) =>
      section(`evidence-${p}`, GROUP_TITLE[p] ?? p, [], ss.map((s) => s.id), identityOf, `${plural(ss.length, "confirmed source")}; nothing from them is used in a claim.`),
    );
  return [...fromQuestions, ...socialSection, ...groups];
}
