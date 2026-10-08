/**
 * Brief sections: the finished brief cut by what the run found, each with a deterministic confidence and its reason.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/sections.ts
 * Deps:    src/domain/confidence, src/domain/url (canonicalUrl), src/recipe/sources/types (platformOf)
 * Tested:  src/recipe/__tests__/sections.test.ts
 *
 * Key responsibilities:
 * - One section per question with at least one kept claim (short title; role must-haves "mh-*" by their text)
 * - One section per non-social platform group (GitHub, business registry, web pages) whose confirmed sources no claim
 *   cites; uncited social profiles get no section (it would only list links)
 * - Source origin (self / mirror / independent) comes from sourceOrigin with the merged candidates' profile URLs
 * - Counts per section feed sectionConfidence: facts need a merged supporting source, sources are distinct canonical URLs;
 *   a support id that is not among the run's sources counts as no source and puts "source missing" in the reason
 * - A claim counts as contradicted when `contradicts` is non-empty or a surviving "contradictions" claim cites one
 *   of its supporting sources (the contradictions section itself is not marked down for disagreeing)
 *
 * Design constraints:
 * - Pure, called by synthesizeBrief; never asks the model, so a degraded brief gets the same sections
 * - Questions with nothing found get no section (they stay in the gap lists); order is recipe order, the UI sorts
 */
import { sectionConfidence, sourceOrigin } from "@/domain/confidence";
import { canonicalUrl } from "@/domain/url";
import type { Brief, BriefSection, Claim, Source } from "@/domain/claim";
import { platformOf } from "@/recipe/sources/types";

const QUESTION_TITLE: Record<string, string> = {
  "current-role": "Current role",
  "career-history": "Career history",
  "public-code": "Public code",
  "public-talks": "Talks and writing",
  "location-match": "Location",
  contradictions: "Where sources disagree",
  "legal-entity": "Legal entity",
  "statutory-bodies": "Statutory bodies and owners",
  "registered-address": "Registered address",
  "legal-signals": "Legal signals",
  "public-reputation": "Public reputation",
  "social-consistency": "Social consistency",
};

/** Social profiles carry no claim of their own, so a "Social presence" section would only list links: it is not emitted. */
const SOCIAL = new Set(["linkedin", "x", "instagram", "tiktok", "youtube", "bluesky", "facebook"]);
const GROUP_TITLE: Record<string, string> = { github: "GitHub", ares: "Business registry", web: "Web pages" };
const TITLE_MAX = 48;

/** Deterministic short title from a question text: cut at the first " (", ", " or " such as", then at a word end within 48 chars. */
function shorten(text: string): string {
  const t = text.trim().replace(/\?$/, "");
  const cut = t.split(/ \(|, | such as/)[0] ?? t;
  if (cut.length <= TITLE_MAX) return cut;
  const head = cut.slice(0, TITLE_MAX + 1);
  const words = head.slice(0, head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") : TITLE_MAX);
  return words.replace(/[\s,;:-]+$/, "");
}

/** Short human title: known ids get a fixed label, role must-haves their model title, else a shortened text. */
export function sectionTitle(q: { id: string; text: string; title?: string }): string {
  return QUESTION_TITLE[q.id] ?? (q.title !== undefined && q.title.trim() !== "" ? q.title.trim() : shorten(q.text));
}

function section(
  id: string,
  title: string,
  claims: readonly Claim[],
  sourceIds: readonly string[],
  identityOf: ReadonlyMap<string, Source["identity"]>,
  urlOf: ReadonlyMap<string, string>,
  summary: string,
  profileUrls: readonly string[],
  disputed: ReadonlySet<string>,
  actorOf: ReadonlyMap<string, string>,
): BriefSection {
  const isMerged = (sid: string): boolean => identityOf.get(sid) === "merged";
  // unknown ids are no source; one source per canonical URL, preferring the confirmed copy
  const byUrl = new Map<string, string>();
  for (const sid of sourceIds) {
    const url = urlOf.get(sid);
    if (url === undefined) continue;
    const key = canonicalUrl(url);
    const have = byUrl.get(key);
    if (have === undefined || (!isMerged(have) && isMerged(sid))) byUrl.set(key, sid);
  }
  const ids = [...byUrl.values()];
  const missing = claims.filter((c) => c.supports.some((sid) => !identityOf.has(sid))).length;
  const origins = ids.map((sid) => sourceOrigin(urlOf.get(sid) ?? "", profileUrls, actorOf.get(sid)));
  const conf = sectionConfidence({
    self_sources: origins.filter((o) => o === "self").length,
    mirror_sources: origins.filter((o) => o === "mirror").length,
    independent_sources: origins.filter((o) => o === "independent").length,
    claims: claims.length,
    facts: claims.filter((c) => c.kind === "FACT" && c.supports.some(isMerged)).length,
    inferences: claims.filter((c) => c.kind === "INFERENCE").length,
    sources: ids.length,
    confirmed_sources: ids.filter(isMerged).length,
    contradictions: claims.filter((c) => c.contradicts.length > 0 || (c.question_id !== "contradictions" && c.supports.some((sid) => disputed.has(sid)))).length,
  });
  const confidence_reason = missing === 0 ? conf.confidence_reason : `${conf.confidence_reason}; ${missing === 1 ? "a cited source is missing" : `${String(missing)} cited sources are missing`}`;
  return { id, title, ...conf, confidence_reason, claim_ids: claims.map((c) => c.id), source_ids: ids, summary };
}

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/**
 * `confirmedSources`: merged identity, not rejected (as in evidenceOf); `allSources` gives the identity of every
 * cited source; `perQuestion` carries the summaries (model or fallback) already written for the brief.
 */
export function sectionsOf(
  questions: readonly { id: string; text: string; title?: string }[],
  claims: readonly Claim[],
  perQuestion: Brief["per_question"],
  allSources: readonly Source[],
  confirmedSources: readonly Source[],
  profileUrls: readonly string[] = [],
): BriefSection[] {
  const identityOf = new Map(allSources.map((s) => [s.id, s.identity]));
  const urlOf = new Map(allSources.map((s) => [s.id, s.url]));
  const actorOf = new Map(allSources.map((s) => [s.id, s.actor]));
  const summaryOf = new Map(perQuestion.map((q) => [q.question_id, q.summary]));
  // Sources a surviving contradiction claim cites: every other claim resting on one of them is disputed
  const disputed = new Set(claims.filter((c) => c.question_id === "contradictions").flatMap((c) => c.supports));
  const fromQuestions = questions.flatMap((q) => {
    const cs = claims.filter((c) => c.question_id === q.id);
    if (cs.length === 0) return [];
    return [section(q.id, sectionTitle(q), cs, cs.flatMap((c) => c.supports), identityOf, urlOf, summaryOf.get(q.id) ?? "", profileUrls, disputed, actorOf)];
  });

  const cited = new Set(claims.flatMap((c) => c.supports));
  const byPlatform = Map.groupBy(confirmedSources, (s) => platformOf(s.url));
  const uncited = [...byPlatform].filter(([, ss]) => !ss.some((s) => cited.has(s.id)));
  const groups = uncited
    .filter(([p]) => !SOCIAL.has(p))
    .map(([p, ss]) =>
      section(`evidence-${p}`, GROUP_TITLE[p] ?? p, [], ss.map((s) => s.id), identityOf, urlOf, `${plural(ss.length, "confirmed source")}; nothing from them is used in a claim.`, profileUrls, disputed, actorOf),
    );
  return [...fromQuestions, ...groups];
}
