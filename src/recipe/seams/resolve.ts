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
 * - Deterministic fallback when the LLM call fails: anchor substring match, never above ASK range (no silent merge)
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

function surname(subject: string): string {
  return subject.trim().split(/\s+/).at(-1)?.toLowerCase() ?? subject.toLowerCase();
}

export async function resolveCandidates(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  const known = new Set(ctx.candidates.flatMap((c) => c.profile_urls));
  const drafts = ctx.sources
    .filter((s) => !known.has(s.url))
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
    scores = drafts.map((d) => ({
      id: d.id,
      // Without a model we never merge on our own: anchor in excerpt is a strong hint, still asked (below MERGE_FLOOR)
      score: d.excerpt.toLowerCase().includes(ctx.anchor.toLowerCase()) ? 0.75 : 0.5,
      reasons: [d.excerpt.toLowerCase().includes(ctx.anchor.toLowerCase()) ? "fallback: anchor found in text, please confirm" : "fallback: name match only"],
    }));
  }
  const byId = new Map(scores.map((s) => [s.id, s]));
  out.candidates = drafts.map((d) => {
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
  out.empty = out.candidates.length === 0;
  return out;
}
