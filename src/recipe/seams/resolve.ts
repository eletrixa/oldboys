/**
 * Resolve seam: turn search hits into identity candidates scored against the anchor (merge / possibly-same-as / rejected).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/resolve.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/seams.test.ts
 *
 * Key responsibilities:
 * - Draft one candidate per profile-like source; LLM scores each vs subject + anchor; thresholds decide
 * - Deterministic fallback when the LLM call fails: anchor substring caps at 0.6, name only 0.5; merge only on
 *   hard links (anchor URL itself, or cross-linked drafts with the anchor in one of them)
 * - Drops PDF and genealogy/translation noise; ranks profile platforms before web and dedupes by profile key
 *   BEFORE the 12-draft cap (web hits capped at 6), so a LinkedIn hit deep in the SERP still becomes a candidate
 * - `sourceIdentityUpdates`: after the lineup, sources whose profile key equals a merged candidate's become
 *   "merged", sources under a rejected candidate "unverified"; extract and synthesize trust only "merged"
 *
 * Design constraints:
 * - Never merges on name alone (plans/001 case studies §B); below ASK_FLOOR the UI asks the manager
 */
import { z } from "zod";
import type { Candidate, Source, SourceIdentity } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
import { clip, platformOf, type StepContext, type StepOutcome } from "@/recipe/sources/types";

export const MERGE_FLOOR = 0.8;
export const ASK_FLOOR = 0.3;

/** Profile platforms in value order; anything else is "web" and ranks last. */
const PLATFORM_RANK = ["linkedin", "github", "x", "instagram", "tiktok", "youtube", "bluesky"];
const PROFILE_PLATFORMS = new Set(PLATFORM_RANK);
const DRAFT_MAX = 12;
const WEB_DRAFT_MAX = 6;

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
    if (host === "instagram.com" && seg[0] !== undefined && !["p", "reel", "explore"].includes(seg[0])) {
      return { url: `https://www.instagram.com/${clean(seg[0])}/`, handle: clean(seg[0]) };
    }
    if (host === "tiktok.com" && seg[0]?.startsWith("@") === true) {
      return { url: `https://www.tiktok.com/${seg[0]}`, handle: clean(seg[0]) };
    }
    if (host === "github.com" && seg[0] !== undefined) return { url: `https://github.com/${seg[0]}`, handle: seg[0] };
    const last = seg.at(-1) ?? null;
    return { url, handle: last === null ? null : clean(last) };
  } catch {
    return { url, handle: null };
  }
}

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
  return pageKey(p.url);
}

/** Identity changes after the lineup: under a merged candidate -> merged, under a rejected one -> unverified. */
export function sourceIdentityUpdates(
  candidates: readonly Pick<Candidate, "decision" | "profile_urls">[],
  sources: readonly Pick<Source, "id" | "url" | "identity">[],
): { id: string; identity: SourceIdentity }[] {
  const keys = (d: Candidate["decision"]) => new Set(candidates.filter((c) => c.decision === d).flatMap((c) => c.profile_urls.map(profileKey)));
  const merged = keys("merge");
  const rejected = keys("rejected");
  const out: { id: string; identity: SourceIdentity }[] = [];
  for (const s of sources) {
    const k = profileKey(s.url);
    if (k === null) continue;
    const next: SourceIdentity | null = rejected.has(k) ? "unverified" : merged.has(k) ? "merged" : null;
    if (next !== null && next !== s.identity) out.push({ id: s.id, identity: next });
  }
  return out;
}

function isNoise(url: string): boolean {
  const key = pageKey(url) ?? "";
  return key.endsWith(".pdf") || NOISE_HOSTS.some((h) => key.includes(h));
}

/** The anchor as a page key when it is a URL or bare domain (contains a dot, no spaces); null for a city or IČO. */
function anchorKey(anchor: string): string | null {
  const a = anchor.trim();
  return a.includes(".") && !/\s/.test(a) ? pageKey(a) : null;
}

type Draft = { id: string; url: string; excerpt: string };

/**
 * No-model scoring. Never merges on text: anchor substring caps at 0.6, name only at 0.5.
 * Merge (0.85) only on hard links: the URL is the anchor URL, or two drafts cross-link and one mentions the anchor.
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
    const partner = drafts.find((o) => (linked(d, o) || linked(o, d)) && (inAnchor || o.excerpt.toLowerCase().includes(anchorLc)));
    if (partner) return { id: d.id, score: 0.85, reasons: [`Links to a profile that mentions ${anchor}`] };
    return inAnchor ? { id: d.id, score: 0.6, reasons: [`Same name, mentions ${anchor}`] } : { id: d.id, score: 0.5, reasons: ["Same name only"] };
  });
}

function surname(subject: string): string {
  return subject.trim().split(/\s+/).at(-1)?.toLowerCase() ?? subject.toLowerCase();
}

const rankOf = (url: string): number => {
  const i = PLATFORM_RANK.indexOf(platformOf(url));
  return i < 0 ? PLATFORM_RANK.length : i;
};

/**
 * Rank (profile platforms first, stable within a platform), dedupe by profile key, cap web hits, THEN cap the total.
 * Duplicate hits for one profile pool their excerpts so the scorer sees every mention of the anchor.
 */
export function pickDrafts(ctx: Pick<StepContext, "candidates" | "sources" | "subject">): { url: string; excerpt: string }[] {
  const known = new Set(ctx.candidates.flatMap((c) => c.profile_urls.map(profileKey)));
  const name = surname(ctx.subject);
  const eligible = ctx.sources
    .filter((s) => !isNoise(s.url) && !known.has(profileKey(s.url)))
    .filter((s) => PROFILE_PLATFORMS.has(platformOf(s.url)) || s.excerpt.toLowerCase().includes(name))
    .sort((a, b) => rankOf(a.url) - rankOf(b.url));
  const byKey = new Map<string, { url: string; excerpt: string }>();
  let web = 0;
  for (const s of eligible) {
    const key = profileKey(s.url) ?? s.url;
    const prev = byKey.get(key);
    if (prev !== undefined) {
      prev.excerpt = clip(`${prev.excerpt}\n${s.excerpt}`);
      continue;
    }
    if (platformOf(s.url) === "web" && ++web > WEB_DRAFT_MAX) continue;
    if (byKey.size >= DRAFT_MAX) continue;
    byKey.set(key, { url: s.url, excerpt: s.excerpt });
  }
  return [...byKey.values()];
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
  try {
    const r = await ports.llm({
      model: "primary",
      system:
        "You resolve whether a public web hit belongs to the person described. Score 0..1 = probability it is the same person. Use the anchor (city, employer, website or IČO), cross-links between profiles, and name match. A bare name match is at most 0.5. Give short reasons.",
      prompt: `Subject: ${ctx.subject}\nAnchor: ${ctx.anchor}\n\nHits:\n${drafts.map((d) => `- id=${d.id} platform=${d.platform} url=${d.url}\n  ${d.excerpt.replaceAll("\n", " ")}`).join("\n")}`,
      schema: Scores,
    });
    out.cost_usd += r.cost_usd;
    out.calls += 1;
    scores = r.value;
  } catch (error) {
    out.notes.push(`llm scoring failed, deterministic fallback: ${error instanceof Error ? error.message : String(error)}`);
    scores = fallbackScores(drafts, ctx.anchor);
  }
  const byId = new Map(scores.map((s) => [s.id, s]));
  const all = drafts.map((d) => {
    const s = byId.get(d.id) ?? { score: 0.5, reasons: ["unscored"] };
    return {
      id: d.id,
      run_id: ctx.runId,
      name: ctx.subject,
      profile_urls: [d.url],
      anchor_match: d.excerpt.toLowerCase().includes(ctx.anchor.toLowerCase()) ? ctx.anchor : null,
      score: s.score,
      decision: decisionFor(s.score),
      platform: d.platform,
      handle: d.handle,
      snippet: d.snippet,
      reasons: s.reasons,
    };
  });
  out.candidates = all;
  out.empty = out.candidates.length === 0;
  return out;
}
