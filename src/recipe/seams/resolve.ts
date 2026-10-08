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
 * - Drops PDF and genealogy/translation noise; dedupes candidates by host + path keeping the best score
 *
 * Design constraints:
 * - Never merges on name alone (plans/001 case studies §B); below ASK_FLOOR the UI asks the manager
 */
import { z } from "zod";
import type { Candidate } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
import { platformOf, type StepContext, type StepOutcome } from "@/recipe/sources/types";

export const MERGE_FLOOR = 0.8;
export const ASK_FLOOR = 0.3;

const PROFILE_PLATFORMS = new Set(["linkedin", "github", "instagram", "x", "tiktok", "youtube", "bluesky"]);

const Scores = z.array(z.object({ id: z.string(), score: z.number().min(0).max(1), reasons: z.array(z.string()) }));

export function decisionFor(score: number): Candidate["decision"] {
  if (score >= MERGE_FLOOR) return "merge";
  if (score <= ASK_FLOOR) return "rejected";
  return "possibly-same-as";
}

function handleOf(url: string): string | null {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean);
    const last = seg.at(-1) ?? null;
    return last === null ? null : decodeURIComponent(last).replace(/^@/, "");
  } catch {
    return null;
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
    if (aKey !== null && keys.get(d.id) === aKey) return { id: d.id, score: 0.85, reasons: ["fallback: this is the anchor URL"] };
    // ponytail: substring link check; misses shortened or redirected links, fine for profile cross-links
    const partner = drafts.find((o) => (linked(d, o) || linked(o, d)) && (inAnchor || o.excerpt.toLowerCase().includes(anchorLc)));
    if (partner) return { id: d.id, score: 0.85, reasons: [`fallback: cross-linked with ${partner.url}`] };
    return inAnchor ? { id: d.id, score: 0.6, reasons: ["fallback: anchor found in text, please confirm"] } : { id: d.id, score: 0.5, reasons: ["fallback: name match only"] };
  });
}

function surname(subject: string): string {
  return subject.trim().split(/\s+/).at(-1)?.toLowerCase() ?? subject.toLowerCase();
}

export async function resolveCandidates(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  const known = new Set(ctx.candidates.flatMap((c) => c.profile_urls));
  const drafts = ctx.sources
    .filter((s) => !known.has(s.url) && !isNoise(s.url))
    .filter((s) => PROFILE_PLATFORMS.has(platformOf(s.url)) || s.excerpt.toLowerCase().includes(surname(ctx.subject)))
    .slice(0, 12)
    .map((s) => ({ id: ports.newId(), url: s.url, platform: platformOf(s.url), handle: handleOf(s.url), snippet: s.excerpt.split("\n")[0] ?? "" , excerpt: s.excerpt }));
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
  // Dedupe by host + path (query strings and www differ between SERP runs); keep the highest score
  const best = new Map<string, Candidate>();
  for (const c of all) {
    const key = pageKey(c.profile_urls[0] ?? "") ?? c.id;
    const prev = best.get(key);
    if (prev === undefined || c.score > prev.score) best.set(key, c);
  }
  out.candidates = [...best.values()];
  out.empty = out.candidates.length === 0;
  return out;
}
