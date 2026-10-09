/**
 * Collector contract: how one declared source turns a step into requests and raw payloads into Sources.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/types.ts
 * Deps:    none (types from src/domain, Family from src/domain/position)
 * Tested:  src/recipe/__tests__/sources-identity.test.ts, src/recipe/__tests__/runner.test.ts (through fake collectors)
 *
 * Key responsibilities:
 * - StepContext: everything a step may read (never mutate)
 * - Collector: `requests()` decides what to fetch (empty array = nothing to do, triggers onEmpty); `parse()` maps one payload to sources;
 *   optional `alreadyFetched()` names sources an earlier step (seed) fetched, so the step does not scrape them twice;
 *   optional `followUp()` computes a second wave of requests from the first wave's request/payload pairs (`Fetched`); optional
 *   `digest()` summarises every pair into StepOutcome.digest; optional `skipReason()` names why `requests()` is empty when the
 *   default "no confirmed handle or id to look up" would be untrue (e.g. role not technical)
 * - githubHandles(): accepted github handles (deduped case-insensitively, `@` stripped, max 2), shared by the GitHub collectors
 * - identityFor(): "merged" only for urls under a merged candidate (profile url prefix or handle segment), else "unverified"
 *
 * Design constraints:
 * - Collectors are pure: no fetch, no LLM; the runner performs I/O through ports
 * - Excerpts are capped at EXCERPT_MAX chars so Workflow step payloads stay small
 */
import type { ChallengeRecord } from "@/domain/challenge";
import type { Brief, Candidate, Claim, Gap, GoalId, Source, SourceIdentity } from "@/domain/claim";
import type { Family } from "@/domain/position";
import type { Question, Step } from "@/recipe/step";

export const EXCERPT_MAX = 2000;

export type StepContext = {
  runId: string;
  subject: string;
  anchor: string;
  goal: GoalId;
  role: string | null;
  /** Family of the role being hired for: the matched role template's family, else familyOf(role); null without a role. */
  roleFamily: Family | null;
  /** Evidence sites of the matched role template (bare domains); empty without a template. */
  roleSites: readonly string[];
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

export type ParsedSource = {
  url: string;
  excerpt: string;
  raw: unknown;
  /** Runner copies this into Source.identity (omitted = "unverified"). "merged" only when fetched for a merged candidate. */
  identity?: SourceIdentity;
};

/** One performed request with the payload it returned (null = empty 2xx body); followUp and digest read these pairs. */
export type Fetched = { req: CollectorRequest; payload: unknown };

export type Collector = {
  /** Matches Step.actor. */
  id: string;
  requests: (ctx: StepContext, step: Step) => CollectorRequest[];
  /** Why `requests()` returned nothing, when it is not the missing handle (becomes the "not searched" gap); null = the default note. */
  skipReason?: (ctx: StepContext) => string | null;
  /** Sources an earlier step already fetched for this collector (seed); with no requests left the step reuses them. */
  alreadyFetched?: (ctx: StepContext) => Source[];
  /** `req` is the request that produced the payload (a stats payload carries no repo name; the URL does). */
  parse: (payload: unknown, ctx: StepContext, step: Step, req?: CollectorRequest) => ParsedSource[];
  /** Second wave of requests computed from the first wave's request/payload pairs (e.g. per-repo stats after the repo list); runs once, after every first-wave request. */
  followUp?: (ctx: StepContext, step: Step, fetched: readonly Fetched[]) => CollectorRequest[];
  /** Pure summary of all request/payload pairs of both waves (null = nothing). */
  digest?: (fetched: readonly Fetched[], ctx: StepContext) => unknown;
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
  /** verify only: the devil's advocate record (idea #8), written into the step's ledger ref as `challenge`. */
  challenge?: ChallengeRecord;
  /** Collector summary of everything it fetched (Collector.digest), written into the step's ledger ref as `digest`; read back by the run state route. */
  digest?: unknown;
};

/** Accepted identities only: the profiles the manager (or the threshold) confirmed. */
export function acceptedCandidates(ctx: StepContext): readonly Candidate[] {
  return ctx.candidates.filter((c) => c.decision === "merge");
}

/** Accepted github handles: `@` stripped, trimmed, deduplicated case-insensitively, at most `max`. */
export function githubHandles(ctx: StepContext, max = 2): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of acceptedCandidates(ctx)) {
    const h = (c.handle ?? "").trim().replace(/^@/, "");
    if (c.platform !== "github" || h === "" || seen.has(h.toLowerCase())) continue;
    seen.add(h.toLowerCase());
    out.push(h);
  }
  return out.slice(0, max);
}

/** Same set as acceptedCandidates; the name the identity rule reads by. */
export const mergedCandidates = acceptedCandidates;

// Path segments that sit before the handle: linkedin.com/in/<h>, bsky.app/profile/<h>, youtube.com/c/<h>.
const PREFIX_SEGMENTS = new Set(["in", "profile", "c", "user", "company"]);

function hostPath(url: string): { host: string; path: string } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname.toLowerCase().replace(/^www\./, ""), path: u.pathname.toLowerCase().replace(/\/+$/, "") };
  } catch {
    return null;
  }
}

/**
 * "merged" when the url sits under a merged candidate's profile url (same host, equal or deeper path),
 * or its first handle segment equals that candidate's handle on the candidate's platform; else "unverified".
 */
export function identityFor(ctx: StepContext, url: string): SourceIdentity {
  const u = hostPath(url);
  if (u === null) return "unverified";
  const segs = u.path.split("/").filter((x) => x.length > 0);
  const first = (PREFIX_SEGMENTS.has(segs[0] ?? "") ? segs[1] : segs[0])?.replace(/^@/, "") ?? "";
  const onPlatform = (platform: string): boolean => platformOf(url) === platform || u.host.split(".").includes(platform);
  const hit = mergedCandidates(ctx).some((c) => {
    const handle = (c.handle ?? "").replace(/^@/, "").toLowerCase();
    if (handle !== "" && first === handle && onPlatform(c.platform)) return true;
    return c.profile_urls.some((p) => {
      const n = hostPath(p);
      return n !== null && n.host === u.host && (u.path === n.path || u.path.startsWith(`${n.path}/`));
    });
  });
  return hit ? "merged" : "unverified";
}

export function clip(text: string, max = EXCERPT_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** `{subject}`, `{anchor}` and `{role_sites}` (a `site:a OR site:b` clause) substituted. */
export function fillQuery(template: string, ctx: StepContext): string {
  return template
    .replaceAll("{subject}", ctx.subject)
    .replaceAll("{anchor}", ctx.anchor)
    .replaceAll("{role_sites}", ctx.roleSites.map((s) => `site:${s}`).join(" OR "));
}

/** Platform key of a URL; the pasted CV's pseudo-URL "cv:<runId>" is "cv", anything unparsable "web". */
export function platformOf(url: string): string {
  if (url.startsWith("cv:")) return "cv";
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
  if (host.endsWith("facebook.com") || host.endsWith("fb.com")) return "facebook";
  if (host.endsWith("ares.gov.cz")) return "ares";
  return "web";
}
