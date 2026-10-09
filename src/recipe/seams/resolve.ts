/**
 * Resolve seam: turn search hits into identity candidates scored against the anchor (merge / possibly-same-as / rejected).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/resolve.ts
 * Deps:    zod, src/domain/corroborate, src/domain/cv-check (isCvSource), src/recipe/sources/linkedin (experienceCompanies)
 * Tested:  src/recipe/__tests__/seams.test.ts, src/recipe/__tests__/identity-corroboration.test.ts
 *
 * Key responsibilities:
 * - Draft one candidate per profile-like source; LLM scores each vs subject + anchor; thresholds decide
 * - Deterministic fallback when the LLM call fails: anchor substring caps at 0.6, name only 0.5; merge only on
 *   hard links (anchor URL itself, or cross-linked drafts with a website/IČO anchor in one of them, never a city)
 * - Drops PDF, genealogy/translation noise, directory/listing pages (LinkedIn /pub/dir/, Facebook /public/,
 *   "N profiles" titles) and election pages, so one "Yes" can never confirm a page that lists
 *   several people; ranks profile platforms before web and dedupes by profile key BEFORE the 12-draft cap (web hits
 *   capped at 6, each profile platform at 4), so a LinkedIn hit deep in the SERP still becomes a candidate
 * - The pasted CV (actor "cv", url "cv:<runId>") is the seed's own input, never a lineup hit: pickDrafts skips it
 * - A draft must carry the subject's first name as well as the surname (diacritic-folded, one edit allowed, or a
 *   leading initial "L. Pokorný") in its title line or URL handle, so surname-only namesakes never fill the lineup
 * - Handles come only from known profile URL shapes; Instagram posts/reels and unknown paths on profile platforms
 *   get no handle (never a post code or a path word)
 * - Model merges need a strong deterministic corroboration (anchor link or website/IČO text, merged-profile
 *   employer, cross-link to or from a merged profile); a name/handle-only or name + city hit is capped at
 *   UNCORROBORATED_CAP (possibly-same-as, asked in the lineup), since many people share a name in one city.
 *   The place still sets anchor_match, as do the model's reasons saying the location matched, never while the
 *   anchor is still empty
 * - Lineup reasons and snippets carry professional identifiers only (personal-life details filtered, prompt says so)
 * - `sourceIdentityUpdates`: after the lineup, sources whose profile key equals a merged candidate's become
 *   "merged", sources under a rejected candidate "unverified"; then (rule 2) a still-unverified source naming the
 *   subject in full plus a confirmed employer token becomes "merged" with a reason; extract and synthesize trust only "merged"
 * - `confirmedSources`: merged and not under a rejected profile, the one filter extract, verify and synthesize share
 * - `noneConfirmed`: a collector found hits but none sits on a merged profile; the Workflow records UNCONFIRMED_GAP
 * - `lineupNeedsAnswer`: pause for the manager when there are candidates and none is merged (a seed merge counts), or when a
 *   platform in `askPlatforms` (github for a technical role) has a possibly-same-as and no merge; otherwise a possibly-same-as next to a merged
 *   candidate never pauses, it stays possibly-same-as with unverified sources
 *
 * Design constraints:
 * - Never merges on name alone or name + city (plans/001 case studies §B; eval p2); below ASK_FLOOR the UI asks the manager
 */
import { z } from "zod";
import type { Candidate, Source, SourceIdentity } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
import { isCvSource } from "@/domain/cv-check";
import { corroborationReason, employerHit, fold, mentionsPlace, orgTokens, placeOf, professionalReasons, professionalSnippet, type OrgToken } from "@/domain/corroborate";
import { experienceCompanies, LINKEDIN_PROFILE_ACTORS } from "@/recipe/sources/linkedin";
import { clip, platformOf, type StepContext, type StepOutcome } from "@/recipe/sources/types";

export const MERGE_FLOOR = 0.8;
export const ASK_FLOOR = 0.3;

/** Profile platforms in value order; anything else is "web" and ranks last. */
export const PLATFORM_RANK = ["linkedin", "github", "x", "instagram", "tiktok", "youtube", "bluesky", "facebook"];
const PROFILE_PLATFORMS = new Set(PLATFORM_RANK);
const DRAFT_MAX = 12;
const WEB_DRAFT_MAX = 6;
const PLATFORM_DRAFT_MAX = 4;

const Scores = z.array(z.object({ id: z.string(), score: z.number().min(0).max(1), reasons: z.array(z.string()) }));

export function decisionFor(score: number): Candidate["decision"] {
  if (score >= MERGE_FLOOR) return "merge";
  if (score <= ASK_FLOOR) return "rejected";
  return "possibly-same-as";
}

/**
 * Profile URL + handle for a social hit. Post, status and photo links collapse onto the profile they belong to,
 * so one LinkedIn post about the subject yields a `/in/<handle>` candidate the collectors can fetch.
 */
export function canonicalProfile(url: string): { url: string; handle: string | null } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const seg = u.pathname.split("/").filter(Boolean).map((x) => decodeURIComponent(x));
    const clean = (h: string) => h.replace(/^@/, "").toLowerCase();
    if (host.endsWith("linkedin.com")) {
      if (seg[0] === "in" && seg[1] !== undefined) return { url, handle: clean(seg[1]) };
      if (seg[0] === "posts" && seg[1] !== undefined) {
        const h = clean(seg[1].split("_")[0] ?? "");
        return h.length > 0 ? { url: `https://www.linkedin.com/in/${h}/`, handle: h } : { url, handle: null };
      }
      return { url, handle: null };
    }
    if ((host === "x.com" || host === "twitter.com") && seg[0] !== undefined && !["search", "hashtag", "i"].includes(seg[0])) {
      return { url: `https://x.com/${clean(seg[0])}`, handle: clean(seg[0]) };
    }
    if (host === "instagram.com") {
      if (seg[0] === undefined || IG_NOT_PROFILE.has(seg[0].toLowerCase())) return { url, handle: null };
      return { url: `https://www.instagram.com/${clean(seg[0])}/`, handle: clean(seg[0]) };
    }
    if (host === "tiktok.com" && seg[0]?.startsWith("@") === true) {
      return { url: `https://www.tiktok.com/${seg[0]}`, handle: clean(seg[0]) };
    }
    if (host === "github.com" && seg[0] !== undefined) return { url: `https://github.com/${seg[0]}`, handle: seg[0] };
    if (host.endsWith("facebook.com") || host === "fb.com") {
      const id = u.searchParams.get("id");
      if (seg[0] === "profile.php" && id !== null) return { url: `https://www.facebook.com/profile.php?id=${id}`, handle: id };
      if (seg[0] === undefined || FB_NOT_PROFILE.has(seg[0].toLowerCase()) || seg[0].includes(".")) return { url, handle: null };
      return { url: `https://www.facebook.com/${clean(seg[0])}`, handle: clean(seg[0]) };
    }
    if (host.endsWith("youtube.com")) {
      if (seg[0]?.startsWith("@") === true) return { url: `https://www.youtube.com/${seg[0]}`, handle: clean(seg[0]) };
      if (["channel", "c", "user"].includes(seg[0] ?? "") && seg[1] !== undefined) return { url: `https://www.youtube.com/${seg[0] ?? ""}/${seg[1]}`, handle: seg[1] };
      return { url, handle: null };
    }
    if (host === "bsky.app" && seg[0] === "profile" && seg[1] !== undefined) return { url: `https://bsky.app/profile/${seg[1]}`, handle: clean(seg[1]) };
    // Generic last segment only for plain web pages; on a profile platform an unknown path is never a handle
    if (platformOf(url) !== "web") return { url, handle: null };
    const last = seg.at(-1) ?? null;
    return { url, handle: last === null ? null : clean(last) };
  } catch {
    return { url, handle: null };
  }
}

/** Instagram first path segments that are posts, reels, stories or browse pages, never an account. */
const IG_NOT_PROFILE = new Set(["p", "reel", "reels", "tv", "stories", "popular", "explore"]);

/** Facebook first path segments that are listings, groups or content, never a person's profile. */
const FB_NOT_PROFILE = new Set(["public", "people", "groups", "pages", "watch", "events", "search", "hashtag", "photo", "story.php", "share", "reel", "marketplace"]);

/** Directory, genealogy and translation noise: never a profile of the subject. */
const NOISE_HOSTS = ["myheritage.", "geni.com", "ancestry.", "familysearch.", "translate.google."];

/** host (no www) + pathname without trailing slash, lowercased: the identity of a page for dedupe and link checks. */
export function pageKey(url: string): string | null {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Identity of the profile a URL belongs to: posts, statuses and query/locale variants collapse onto one key.
 * LinkedIn country hosts (cz.linkedin.com) and locale suffixes (/in/x/cs) key as linkedin.com/in/<handle>.
 */
export function profileKey(url: string): string | null {
  const p = canonicalProfile(url);
  if (platformOf(p.url) === "linkedin" && p.handle !== null && p.url.includes('/in/')) return `linkedin.com/in/${p.handle}`;
  // profile.php?id= keys by id (pageKey drops the query); m./web./www. hosts already collapse in canonicalProfile
  if (p.handle !== null && p.url.startsWith("https://www.facebook.com/")) return `facebook.com/${p.handle}`;
  return pageKey(p.url);
}

/** Sources trusted as the subject: identity "merged" and not under a rejected candidate's profile key (extract, verify, synthesize). */
export function confirmedSources(ctx: Pick<StepContext, "sources" | "candidates">): Source[] {
  const rejected = new Set(ctx.candidates.filter((c) => c.decision === "rejected").flatMap((c) => c.profile_urls.map(profileKey)));
  return ctx.sources.filter((s) => s.identity === "merged" && !rejected.has(profileKey(s.url)));
}

export type IdentitySource = Pick<Source, "id" | "url" | "identity"> & Partial<Pick<Source, "excerpt" | "actor">>;
export type IdentityUpdate = { id: string; identity: SourceIdentity; reason: string | null };

/** Companies in the experience lines of merged LinkedIn profile sources (seed scrape or linkedin collector). */
export function mergedProfileOrgs(sources: readonly IdentitySource[]): string[] {
  return sources.filter((s) => s.identity === "merged" && LINKEDIN_PROFILE_ACTORS.has(s.actor ?? "")).flatMap((s) => experienceCompanies(s.excerpt ?? ""));
}

/**
 * Identity changes after the lineup.
 * Rule 1 (profile key): under a merged candidate -> merged, under a rejected one -> unverified (reason null).
 * Rule 2 (name + employer, only with `corroboration`): a source still unverified and not on a rejected profile
 * becomes merged when it names the subject in full AND carries a distinctive token of a confirmed organisation:
 * `orgs` (seed employer, headline orgs) plus the companies of merged LinkedIn profiles. Candidates never change.
 */
export function sourceIdentityUpdates(
  candidates: readonly Pick<Candidate, "decision" | "profile_urls">[],
  sources: readonly IdentitySource[],
  corroboration?: { subject: string; orgs: readonly string[] },
): IdentityUpdate[] {
  const keys = (d: Candidate["decision"]) => new Set(candidates.filter((c) => c.decision === d).flatMap((c) => c.profile_urls.map(profileKey)));
  const merged = keys("merge");
  const rejected = keys("rejected");
  const out: IdentityUpdate[] = [];
  const after = sources.map((s) => {
    const k = profileKey(s.url);
    const next: SourceIdentity | null = k === null ? null : rejected.has(k) ? "unverified" : merged.has(k) ? "merged" : null;
    if (next !== null && next !== s.identity) out.push({ id: s.id, identity: next, reason: null });
    return { ...s, identity: next ?? s.identity, rejected: k !== null && rejected.has(k) };
  });
  if (corroboration === undefined) return out;
  const tokens = orgTokens([...corroboration.orgs, ...mergedProfileOrgs(after)], corroboration.subject);
  if (tokens.length === 0) return out;
  for (const s of after) {
    if (s.identity === "merged" || s.rejected) continue;
    const reason = corroborationReason(corroboration.subject, tokens, { url: s.url, excerpt: s.excerpt ?? "" });
    if (reason !== null) out.push({ id: s.id, identity: "merged", reason });
  }
  return out;
}

/** Gap reason for a post-lineup collector whose hits are all namesakes or unverified. */
export const UNCONFIRMED_GAP = "hits found, none confirmed (same name, identity not verified)";

/** True when there are hits and none is merged, by collector identity or by profile key of a merged candidate. */
export function noneConfirmed(sources: readonly Pick<Source, "url" | "identity">[], candidates: readonly Pick<Candidate, "decision" | "profile_urls">[]): boolean {
  const merged = new Set(candidates.filter((c) => c.decision === "merge").flatMap((c) => c.profile_urls.map(profileKey)));
  return sources.length > 0 && !sources.some((s) => s.identity === "merged" || merged.has(profileKey(s.url)));
}

/**
 * The lineup pauses only when there are candidates and none is merged (no profile/CV given, nothing confirmed).
 * `all` must include earlier candidates (the seed's merged profile): the given profile settles identity, so a
 * possibly-same-as beside a merge never asks "is this them?".
 */
export function lineupNeedsAnswer(all: readonly (Pick<Candidate, "decision"> & Partial<Pick<Candidate, "platform">>)[], askPlatforms: readonly string[] = []): boolean {
  if (all.length === 0) return false;
  if (!all.some((c) => c.decision === "merge")) return true;
  return askPlatforms.some((p) => all.some((c) => c.platform === p && c.decision === "possibly-same-as") && !all.some((c) => c.platform === p && c.decision === "merge"));
}

/** Titles of people-search and directory listings: one page, many different people. */
// ponytail: "ů" is not a \w char, so "profilů" is matched without a trailing \b; "Results" stays case-sensitive
const LISTING_TITLE = /profilů|\bprofily\b|\bprofiles\b|\bpeople named\b/i;
const RESULTS_TITLE = /\bResults\b/;
/** Election pages (candidacy, results): political data a hiring brief must never show. */
const ELECTION_TITLE = /výsledky voleb|(?<!\p{L})volby(?!\p{L})|election results|(?<!\p{L})kandidát|candidate list/iu;

/**
 * Never a candidate: PDFs, genealogy/translation hosts, LinkedIn pages other than /in/, /posts/, /company/
 * (directories such as /pub/dir/), Facebook /public/ listings, and pages whose title reads like a listing,
 * is about an election.
 */
export function isNoise(url: string, excerpt = ""): boolean {
  const key = pageKey(url) ?? "";
  if (key.endsWith(".pdf") || NOISE_HOSTS.some((h) => key.includes(h))) return true;
  const [host = "", first = ""] = key.split("/");
  if (host.endsWith("linkedin.com") && !["in", "posts", "company"].includes(first)) return true;
  if ((host.endsWith("facebook.com") || host === "fb.com") && first === "public") return true;
  const title = excerpt.split("\n")[0] ?? "";
  // Art. 9 stems (health, politic...) are NOT used here: "Head of Health Partnerships" is a real profile. The
  // protected-category filter runs on brief output (synthesize), where it belongs.
  return LISTING_TITLE.test(title) || RESULTS_TITLE.test(title) || ELECTION_TITLE.test(title);
}

/** The anchor as a page key when it is a URL or bare domain (contains a dot, no spaces); null for a city or IČO. */
function anchorKey(anchor: string): string | null {
  const a = anchor.trim();
  return a.includes(".") && !/\s/.test(a) ? pageKey(a) : null;
}

type Draft = { id: string; url: string; excerpt: string };

/**
 * No-model scoring. Never merges on text: anchor substring caps at 0.6, name only at 0.5.
 * Merge (0.85) only on hard links: the URL is the anchor URL, or two drafts cross-link and one mentions a website or
 * IČO anchor. A city anchor never merges a cross-linked pair: two namesake pages may link each other.
 */
export function fallbackScores(drafts: readonly Draft[], anchor: string): { id: string; score: number; reasons: string[] }[] {
  const aKey = anchorKey(anchor);
  const anchorLc = anchor.toLowerCase();
  const keys = new Map(drafts.map((d) => [d.id, pageKey(d.url)]));
  const linked = (from: Draft, to: Draft): boolean => {
    const k = keys.get(to.id);
    return k !== null && k !== undefined && from.id !== to.id && from.excerpt.toLowerCase().includes(k);
  };
  return drafts.map((d) => {
    const inAnchor = d.excerpt.toLowerCase().includes(anchorLc);
    if (aKey !== null && keys.get(d.id) === aKey) return { id: d.id, score: 0.85, reasons: ["Profile link you supplied"] };
    // ponytail: substring link check; misses shortened or redirected links, fine for profile cross-links
    const partner = placeOf(anchor) !== null ? undefined : drafts.find((o) => (linked(d, o) || linked(o, d)) && (inAnchor || o.excerpt.toLowerCase().includes(anchorLc)));
    if (partner !== undefined) return { id: d.id, score: 0.85, reasons: [`Links to a profile that mentions ${anchor}`] };
    return inAnchor ? { id: d.id, score: 0.6, reasons: [`Same name, mentions ${anchor}`] } : { id: d.id, score: 0.5, reasons: ["Same name only"] };
  });
}

function surname(subject: string): string {
  return subject.trim().split(/\s+/).at(-1)?.toLowerCase() ?? subject.toLowerCase();
}

/** True when a and b differ by at most one insert, delete or substitution (Jozef / Josef). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  return a.length === b.length ? a.slice(i + 1) === b.slice(i + 1) : long.slice(i + 1) === short.slice(i);
}

/**
 * The hit names the subject, not a namesake: first name (one edit allowed for names of 4+ letters, or a leading
 * initial "L. Pokorný") and surname in the title line, or both (or initial + surname) in the URL handle.
 */
export function namesSubject(subject: string, url: string, excerpt: string): boolean {
  const parts = fold(subject).split(/[^\p{L}]+/u).filter(Boolean);
  const first = parts[0] ?? "";
  const sur = parts.at(-1) ?? "";
  if (first === "" || first === sur) return true;
  const near = (w: string, name: string): boolean => (name.length >= 4 ? withinOneEdit(w, name) : w === name);
  const line = fold(excerpt.split("\n")[0] ?? "");
  const words = line.split(/[^\p{L}]+/u);
  const initial = new RegExp(`(?<!\\p{L})${first.charAt(0)}\\.\\s*${sur}`, "u").test(line);
  if (words.some((w) => near(w, sur)) && (words.some((w) => near(w, first)) || initial)) return true;
  const handle = fold(canonicalProfile(url).handle ?? "").replace(/[^a-z]/g, "");
  return handle.includes(sur) && (handle.includes(first) || handle.startsWith(`${first.charAt(0)}${sur}`));
}

const rankOf = (url: string): number => {
  const i = PLATFORM_RANK.indexOf(platformOf(url));
  return i < 0 ? PLATFORM_RANK.length : i;
};

/**
 * Rank (profile platforms first, stable within a platform), drop the pasted CV and surname-only namesakes, dedupe by profile key,
 * cap each platform (web 6, profile platforms 4), THEN cap the total.
 * Duplicate hits for one profile pool their excerpts so the scorer sees every mention of the anchor.
 */
export function pickDrafts(ctx: Pick<StepContext, "candidates" | "sources" | "subject">): { url: string; excerpt: string }[] {
  const known = new Set(ctx.candidates.flatMap((c) => c.profile_urls.map(profileKey)));
  const name = surname(ctx.subject);
  const eligible = ctx.sources
    .filter((s) => !isCvSource(s) && !isNoise(s.url, s.excerpt) && !known.has(profileKey(s.url)))
    .filter((s) => PROFILE_PLATFORMS.has(platformOf(s.url)) || s.excerpt.toLowerCase().includes(name))
    .filter((s) => namesSubject(ctx.subject, s.url, s.excerpt))
    .sort((a, b) => rankOf(a.url) - rankOf(b.url));
  const byKey = new Map<string, { url: string; excerpt: string }>();
  const perPlatform = new Map<string, number>();
  for (const s of eligible) {
    const key = profileKey(s.url) ?? s.url;
    const prev = byKey.get(key);
    if (prev !== undefined) {
      prev.excerpt = clip(`${prev.excerpt}\n${s.excerpt}`);
      continue;
    }
    const platform = platformOf(s.url);
    const n = (perPlatform.get(platform) ?? 0) + 1;
    perPlatform.set(platform, n);
    if (n > (platform === "web" ? WEB_DRAFT_MAX : PLATFORM_DRAFT_MAX)) continue;
    if (byKey.size >= DRAFT_MAX) continue;
    byKey.set(key, { url: s.url, excerpt: s.excerpt });
  }
  return [...byKey.values()];
}

/** Highest score a name- or handle-only hit may keep: possibly-same-as, never merge. */
export const UNCORROBORATED_CAP = 0.7;
const UNCORROBORATED_REASON = "name or handle only: no location, employer or cross-link match";
const PLACE_ONLY_REASON = "name and city only: no employer or link to a confirmed profile";
const LOCATION_REASON = /\b(?:location|located|based in|lives in)\b/i;

/**
 * What besides the name ties a hit to the subject: the anchor link or text, a token of a merged LinkedIn profile's
 * employer, a cross-link to or from a merged profile, or (weak, never enough to merge) the anchor's place.
 * Null when it is name/handle only.
 */
export function corroboration(
  d: { url: string; excerpt: string },
  ctx: Pick<StepContext, "subject" | "anchor" | "candidates" | "sources">,
  tokens: readonly OrgToken[] = orgTokens(mergedProfileOrgs(ctx.sources), ctx.subject),
): string | null {
  const text = `${d.excerpt}\n${d.url}`;
  const lc = text.toLowerCase();
  const aKey = anchorKey(ctx.anchor);
  if (aKey !== null && pageKey(d.url) === aKey) return "anchor link";
  const place = placeOf(ctx.anchor);
  if (place === null && ctx.anchor.trim() !== "" && lc.includes(ctx.anchor.trim().toLowerCase())) return "anchor";
  // "Kódovna Brno" must not turn the city into an employer match
  const employer = employerHit(text, tokens.filter((t) => t.token !== place));
  if (employer !== null) return `employer (${employer})`;
  const mergedKeys = ctx.candidates.filter((c) => c.decision === "merge").flatMap((c) => c.profile_urls.map(pageKey)).filter((k): k is string => k !== null);
  // ponytail: substring link check, like fallbackScores; misses shortened or redirected links
  if (mergedKeys.some((k) => lc.includes(k))) return "cross-link";
  const own = pageKey(d.url);
  if (own !== null && ctx.sources.some((s) => s.identity === "merged" && s.excerpt.toLowerCase().includes(own))) return "cross-link";
  return place !== null && mentionsPlace(ctx.anchor, text) ? "location" : null;
}

/** A corroboration strong enough to keep a merge: anything but the place alone. */
const isStrong = (why: string | null): boolean => why !== null && why !== "location";

/** anchor_match: the hit matched the anchor or its place, or the model's reasons say the location matched. */
function anchorMatched(anchor: string, why: string | null, reasons: readonly string[]): boolean {
  if (why === "anchor link" || why === "anchor" || why === "location") return true;
  return reasons.some((r) => LOCATION_REASON.test(r) || mentionsPlace(anchor, r));
}

export async function resolveCandidates(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  const drafts = pickDrafts(ctx).map((s) => {
    const prof = canonicalProfile(s.url);
    return { id: ports.newId(), url: prof.url, platform: platformOf(s.url), handle: prof.handle, snippet: s.excerpt.split("\n")[0] ?? "", excerpt: s.excerpt };
  });
  if (drafts.length === 0) {
    out.notes.push("no profile-like sources to resolve");
    return out;
  }

  let scores: z.infer<typeof Scores>;
  let byModel = false;
  const employers = mergedProfileOrgs(ctx.sources);
  try {
    const r = await ports.llm({
      model: "primary",
      system: [
        "You resolve whether a public web hit belongs to the person described. Score 0..1 = probability it is the same person.",
        "Use the anchor (city, employer, website or IČO), the confirmed employers, cross-links between profiles, and name match.",
        `Score ${String(MERGE_FLOOR)} or more only when the name matches AND the hit shows a confirmed employer, the anchor website or IČO, or a cross-link to a confirmed profile.`,
        `A name or handle match alone, or name + city, is at most ${String(UNCORROBORATED_CAP)} (many people share a name in one city); a bare name match is at most 0.5.`,
        "Give short reasons citing only professional identifiers: name, handle, headline, employer, location, cross-links.",
        "Never mention personal-life details (check-ins, profile pictures, photos, family, hobbies).",
      ].join(" "),
      prompt: `Subject: ${ctx.subject}\nAnchor: ${ctx.anchor}\nConfirmed employers: ${employers.length > 0 ? employers.join(", ") : "none yet"}\n\nHits:\n${drafts.map((d) => `- id=${d.id} platform=${d.platform} url=${d.url}\n  ${d.excerpt.replaceAll("\n", " ")}`).join("\n")}`,
      schema: Scores,
    });
    out.cost_usd += r.cost_usd;
    out.calls += 1;
    scores = r.value;
    byModel = true;
  } catch (error) {
    out.notes.push(`llm scoring failed, deterministic fallback: ${error instanceof Error ? error.message : String(error)}`);
    scores = fallbackScores(drafts, ctx.anchor);
  }
  const byId = new Map(scores.map((s) => [s.id, s]));
  const tokens = orgTokens(employers, ctx.subject);
  const all = drafts.map((d) => {
    const s = byId.get(d.id) ?? { score: 0.5, reasons: ["unscored"] };
    const why = corroboration(d, ctx, tokens);
    // fallbackScores already merges only on hard links; a model merge also needs a strong deterministic corroboration
    const capped = byModel && s.score >= MERGE_FLOOR && !isStrong(why);
    const score = capped ? UNCORROBORATED_CAP : s.score;
    return {
      id: d.id,
      run_id: ctx.runId,
      name: ctx.subject,
      profile_urls: [d.url],
      anchor_match: ctx.anchor !== "" && anchorMatched(ctx.anchor, why, s.reasons) ? ctx.anchor : null,
      score,
      decision: decisionFor(score),
      platform: d.platform,
      handle: d.handle,
      snippet: professionalSnippet(d.snippet),
      reasons: professionalReasons(capped ? [...s.reasons, why === "location" ? PLACE_ONLY_REASON : UNCORROBORATED_REASON] : s.reasons),
    };
  });
  out.candidates = all;
  out.empty = out.candidates.length === 0;
  return out;
}
