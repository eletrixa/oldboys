/**
 * Collector contract: how one declared source turns a step into requests and raw payloads into Sources.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/types.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/runner.test.ts (through fake collectors)
 *
 * Key responsibilities:
 * - StepContext: everything a step may read (never mutate)
 * - Collector: `requests()` decides what to fetch (empty array = nothing to do, triggers onEmpty); `parse()` maps one payload to sources
 *
 * Design constraints:
 * - Collectors are pure: no fetch, no LLM; the runner performs I/O through ports
 * - Excerpts are capped at EXCERPT_MAX chars so Workflow step payloads stay small
 */
import type { Brief, Candidate, Claim, Gap, GoalId, Source } from "@/domain/claim";
import type { Question, Step } from "@/recipe/step";

export const EXCERPT_MAX = 2000;

export type StepContext = {
  runId: string;
  subject: string;
  anchor: string;
  goal: GoalId;
  role: string | null;
  questions: readonly Question[];
  candidates: readonly Candidate[];
  sources: readonly Source[];
  claims: readonly Claim[];
  gaps: readonly Gap[];
  budget: { usd: number; calls: number };
  spent: { usd: number; calls: number };
};

export type CollectorRequest =
  | { via: "actor"; actor: string; input: Record<string, unknown>; maxTotalChargeUsd: number; timeoutSecs: number }
  | { via: "fetch"; url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } };

export type ParsedSource = { url: string; excerpt: string; raw: unknown };

export type Collector = {
  /** Matches Step.actor. */
  id: string;
  requests: (ctx: StepContext, step: Step) => CollectorRequest[];
  parse: (payload: unknown, ctx: StepContext, step: Step) => ParsedSource[];
};

export type StepOutcome = {
  sources: Source[];
  candidates: Candidate[];
  claims: Claim[];
  gaps: Gap[];
  brief: Brief | null;
  /** verify returns the full, updated claim list; everything else appends. */
  claims_mode: "append" | "replace";
  empty: boolean;
  cost_usd: number;
  calls: number;
  notes: string[];
};

/** Accepted identities only: the profiles the manager (or the threshold) confirmed. */
export function acceptedCandidates(ctx: StepContext): readonly Candidate[] {
  return ctx.candidates.filter((c) => c.decision === "merge");
}

export function clip(text: string, max = EXCERPT_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function fillQuery(template: string, ctx: StepContext): string {
  return template.replaceAll("{subject}", ctx.subject).replaceAll("{anchor}", ctx.anchor);
}

export function platformOf(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (host.endsWith("github.com")) return "github";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host === "x.com" || host.endsWith("twitter.com")) return "x";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("bsky.app")) return "bluesky";
  if (host.endsWith("ares.gov.cz")) return "ares";
  return "web";
}
