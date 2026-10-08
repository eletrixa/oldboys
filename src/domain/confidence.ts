/**
 * Deterministic confidence for one brief section: how well the research backs it, never a rating of the person.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/confidence.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/confidence.test.ts
 *
 * Key responsibilities:
 * - sourceOrigin: classify a URL as "self" (the subject's own profile or site), "mirror" (aggregator repeating a profile)
 *   or "independent" (press, podcast, employer page, registry)
 * - sectionConfidence: score 0..1 plus a one-sentence plain-words reason
 * - Effective sources = independent + (self if any, else one if only mirrors): mirrors never add to what self gives
 * - Score = 0.3 + 0.5 × fact share + 0.1 per extra effective source (max +0.2), then caps:
 *   1 effective source → 0.6, no confirmed (merged) source → 0.5, no verified fact → 0.4,
 *   no independent source → 0.75, one independent source → 0.85; any contradiction → −0.2
 *
 * Design constraints:
 * - Pure: counts in, number and sentence out; computed in the synthesize seam, never by the LLM
 * - Rounded to 2 decimals, clamped to 0..0.95 (a public-web brief is never certain)
 */

export type SourceOrigin = "self" | "mirror" | "independent";

const MIRROR_HOSTS = ["rocketreach.co", "theorg.com", "zoominfo.com", "signalhire.com", "apollo.io", "contactout.com", "lusha.com"];
const SELF_HOSTS = ["instagram.com", "facebook.com", "x.com", "twitter.com"];
/** Hosts shared by many people: a profile URL there makes only its own first path segment "self". */
const SHARED_HOSTS = new Set(["linkedin.com", "github.com", "gitlab.com", "medium.com", "youtube.com", "tiktok.com", "bsky.app", "substack.com", ...SELF_HOSTS]);

function parts(url: string): { host: string; path: string } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname.toLowerCase().replace(/^www\./, ""), path: u.pathname.toLowerCase() };
  } catch {
    return null;
  }
}
const onHost = (host: string, base: string): boolean => host === base || host.endsWith(`.${base}`);
const firstSegment = (path: string): string => path.split("/")[1] ?? "";

/** Where a source comes from relative to the subject; `profileUrls` are the merged candidates' profile URLs. */
export function sourceOrigin(url: string, profileUrls: readonly string[] = []): SourceOrigin {
  const u = parts(url);
  if (u === null) return "independent";
  const { host, path } = u;
  if (MIRROR_HOSTS.some((m) => onHost(host, m))) return "mirror";
  if ((onHost(host, "bloomberg.com") && path.startsWith("/profile")) || (onHost(host, "crunchbase.com") && path.startsWith("/person"))) return "mirror";
  if (onHost(host, "linkedin.com")) return path.startsWith("/in/") || path.startsWith("/posts/") ? "self" : "independent";
  if (SELF_HOSTS.some((h) => onHost(host, h))) return "self";
  for (const p of profileUrls.flatMap((pu) => parts(pu) ?? [])) {
    if (SHARED_HOSTS.has(p.host)) {
      if (p.host === host && firstSegment(p.path) !== "" && firstSegment(p.path) === firstSegment(path)) return "self";
    } else if (onHost(host, p.host)) return "self";
  }
  return "independent";
}

export type SectionCounts = {
  /** All claims in the section (FACT, INFERENCE, STATEMENT). */
  claims: number;
  /** FACT claims with at least one confirmed supporting source (verify already checked the quote). */
  facts: number;
  /** INFERENCE claims. */
  inferences: number;
  /** Distinct supporting sources. */
  sources: number;
  /** Distinct supporting sources whose identity is "merged". */
  confirmed_sources: number;
  /** Claims that name at least one contradicting source. */
  contradictions: number;
  /** Distinct sources by origin (see sourceOrigin); they sum to `sources`. */
  self_sources: number;
  mirror_sources: number;
  independent_sources: number;
};

export type SectionConfidence = { confidence: number; confidence_reason: string };

const SINGLE_SOURCE_CAP = 0.6;
const UNCONFIRMED_CAP = 0.5;
const NO_FACT_CAP = 0.4;
const SELF_ONLY_CAP = 0.75;
const ONE_INDEPENDENT_CAP = 0.85;
const CONTRADICTION_PENALTY = 0.2;
/** A public-web brief is never certain. */
const MAX_SCORE = 0.95;

/** Plain-words reason for a hiring manager, one sentence. */
function reason(c: SectionCounts): string {
  let base: string;
  if (c.claims === 0) base = "Listed for reference; no claim relies on it";
  else if (c.sources === 0) base = c.facts === 0 ? "Inferred, no source" : "No source found";
  else if (c.facts === 0) base = "Inferred, no verbatim quote";
  else if (c.confirmed_sources === 0) base = "Not confirmed as the same person";
  else if (c.independent_sources >= 2) base = `Confirmed by ${String(c.independent_sources)} independent sources`;
  else if (c.independent_sources === 1) base = c.self_sources + c.mirror_sources === 0 ? "Single independent source, not corroborated" : "Self-reported, plus one independent source";
  else if (c.self_sources > 0) base = c.mirror_sources > 0 ? "Self-reported; a mirror site repeats it" : "Self-reported only";
  else base = "Only mirror sites, no original source";
  return c.contradictions > 0 ? `${base}; sources disagree` : base;
}

export function sectionConfidence(c: SectionCounts): SectionConfidence {
  const effective = c.independent_sources + (c.self_sources > 0 ? c.self_sources : Math.min(c.mirror_sources, 1));
  const factShare = c.claims > 0 ? c.facts / c.claims : 0;
  let score = 0.3 + 0.5 * factShare + 0.1 * Math.min(Math.max(effective - 1, 0), 2);
  if (effective <= 1) score = Math.min(score, SINGLE_SOURCE_CAP);
  if (c.confirmed_sources === 0) score = Math.min(score, UNCONFIRMED_CAP);
  if (c.facts === 0) score = Math.min(score, NO_FACT_CAP);
  if (c.independent_sources === 0) score = Math.min(score, SELF_ONLY_CAP);
  else if (c.independent_sources === 1) score = Math.min(score, ONE_INDEPENDENT_CAP);
  if (c.contradictions > 0) score -= CONTRADICTION_PENALTY;
  const confidence = Math.round(Math.min(MAX_SCORE, Math.max(0, score)) * 100) / 100;
  return { confidence, confidence_reason: reason(c) };
}
