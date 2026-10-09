/**
 * Run progress projection: how far a research run is, how long it typically takes and what is still to be read.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/run-eta.ts
 * Deps:    src/recipe/step (types only)
 * Tested:  src/domain/__tests__/run-eta.test.ts
 *
 * Key responsibilities:
 * - `runProgress(steps, rows, createdAt)`: the server-side projection (plans/015): the recipe steps grouped into the five
 *   human phases (search, lineup, read, check, write), per phase the typical duration (pool-aware: parallel phases count
 *   max(longest step, sum / window), serial phases count the sum), the step ids without a ledger row yet, the earliest
 *   known start (ledger ts - ms of its finished rows, else the previous phase's end) and the end once every step has a row
 * - `progressView(progress, status, nowMs)`: the client-side view between polls: time-weighted share (0..1), the active
 *   phase, the run's pace so far (`runPace`: finished phases' actual over typical time, damped, 0.6x to 2x) applied to
 *   what is left, the remaining-time range (0.6x to 2x of the estimate; a wider band reads as "no idea"), the `longer` flag once the phase ran past 2.5x its typical time, the elapsed time in the phase, the ids still to read
 * - `remainingText(view)`: "about 2 to 4 min left" / "under a minute left" / null while paused or longer than usual
 * - TYPICAL_MS: per-step typical durations, the production baseline (plans/013-run-latency/01-BASELINE.md) blended with
 *   the local QA ledger of 2026-10-09 (newer recipe: Instagram / Facebook name searches, longer synthesis); unknown steps
 *   fall back to a per-kind default, so a new recipe step never breaks the estimate
 *
 * Design constraints:
 * - Pure: no I/O, no Date.now(); the caller passes the clock
 * - Honest: a range, never a point; a paused run shows no countdown (human time is not research time); past 2.5x the
 *   typical phase time the estimate is withdrawn ("longer than usual") instead of counting down to zero
 * - A rough step-level model is enough: the recipe keeps getting faster (plans/013), so the table is a calibration, not a
 *   promise; refresh it from the ledger with the query in plans/015-run-progress/00-SYNTHESIS.md
 */
import type { Step, StepKind } from "@/recipe/step";

export type PhaseKey = "search" | "lineup" | "read" | "check" | "write";
export const PHASES: readonly PhaseKey[] = ["search", "lineup", "read", "check", "write"];

export type StepRow = { step: string; ts: string; ms: number };

export type PhaseProgress = {
  key: PhaseKey;
  steps: number;
  done: number;
  /** Step ids without a ledger row yet, in recipe order. */
  left: string[];
  /** Typical duration of the whole phase, pool-aware. */
  typical_ms: number;
  /** Typical duration of the steps still left, pool-aware. */
  left_ms: number;
  started_at: string | null;
  ended_at: string | null;
};

export type RunProgress = { phases: PhaseProgress[]; typical_total_ms: number };

/** Workers allow 6 simultaneous outbound connections; the Workflow's pools use the same window. */
const WINDOW = 6;
const LOW = 0.6;
const HIGH = 2.0;
/** A phase this many times over its typical time has left the range the table knows; the estimate is withdrawn. */
const LONGER = 2.5;

const BY_KIND: Readonly<Record<StepKind, number>> = { seed: 7_000, serp: 30_000, actor: 5_000, ares: 3_000, resolve: 7_000, extract: 30_000, verify: 12_000, synthesize: 60_000 };

/** When TYPICAL_MS was last fitted; refit after each plans/013 phase (query in plans/015-run-progress/00-SYNTHESIS.md). */
export const CALIBRATED_ON = "2026-10-09";

export const TYPICAL_MS: Readonly<Record<string, number>> = {
  seed_profile: 7_000,
  serp_person: 30_000,
  social_serp: 35_000,
  instagram_search: 60_000,
  facebook_search: 8_000,
  github_search: 2_000,
  // treg second source (plans/016): one proxied HTTP read each, catalog medians 0.3 to 4 s
  treg_person_enrich: 2_000,
  treg_people_search: 3_000,
  resolve_lineup: 7_000,
  linkedin_profile: 3_000,
  linkedin_posts: 6_000,
  employer_company: 7_000,
  github_profile: 1_000,
  github_deep: 5_000,
  github_apify: 10_000,
  stackexchange_profile: 500,
  huggingface_profile: 500,
  orcid_search: 1_000,
  openalex_author: 2_000,
  x_profile: 12_000,
  instagram_profile: 4_000,
  tiktok_profile: 3_000,
  youtube_channel: 25_000,
  facebook_page: 18_000,
  bluesky_profile: 500,
  treg_social_verify: 6_000,
  treg_company_enrich: 1_000,
  personal_site_crawl: 24_000,
  role_sites_serp: 30_000,
  cz_registries: 2_000,
  talks_serp: 35_000,
  press_serp: 35_000,
  // Depth steps (plans/013): free registries and SERP packs, then the page reader; local QA ledger of 2026-10-09
  sec_edgar: 3_000,
  wikipedia: 1_000,
  podcast_episodes: 1_000,
  regulatory_serp: 60_000,
  legal_serp: 45_000,
  business_press_serp: 15_000,
  boards_serp: 20_000,
  read_pages: 25_000,
  extract_claims: 40_000,
  verify_claims: 14_000,
  synthesize_report: 100_000,
};

export function typicalMs(step: Pick<Step, "id" | "kind">): number {
  return TYPICAL_MS[step.id] ?? BY_KIND[step.kind];
}

/** Collectors before the lineup run in the search pool, after it in the read pool; the model seams run one after another. */
export function phaseOf(step: Pick<Step, "kind">, afterResolve: boolean): PhaseKey {
  switch (step.kind) {
    case "resolve":
      return "lineup";
    case "extract":
    case "verify":
      return "check";
    case "synthesize":
      return "write";
    case "seed":
      return "search";
    case "serp":
    case "actor":
    case "ares":
      return afterResolve ? "read" : "search";
  }
}

const PARALLEL: ReadonlySet<PhaseKey> = new Set(["search", "read"]);

/** Pool phases finish when their longest step does, unless the window is the bottleneck; serial phases add up. */
function poolMs(key: PhaseKey, durations: readonly number[]): number {
  const sum = durations.reduce((a, b) => a + b, 0);
  if (!PARALLEL.has(key)) return sum;
  return Math.max(Math.max(0, ...durations), Math.ceil(sum / WINDOW));
}

function parse(iso: string | null): number {
  return iso === null ? Number.NaN : Date.parse(iso);
}

export function runProgress(steps: readonly Step[], rows: readonly StepRow[], createdAt: string): RunProgress {
  // Earliest known start and latest end per step id (a retried step may have several rows)
  const span = new Map<string, { start: number; end: number }>();
  for (const row of rows) {
    const end = Date.parse(row.ts);
    if (Number.isNaN(end)) continue;
    const start = end - Math.max(0, row.ms);
    const prev = span.get(row.step);
    span.set(row.step, { start: prev === undefined ? start : Math.min(prev.start, start), end: prev === undefined ? end : Math.max(prev.end, end) });
  }

  let afterResolve = false;
  const groups = new Map<PhaseKey, Step[]>(PHASES.map((k) => [k, []]));
  for (const step of steps) {
    groups.get(phaseOf(step, afterResolve))?.push(step);
    if (step.kind === "resolve") afterResolve = true;
  }

  const phases: PhaseProgress[] = [];
  let previousEnd: string | null = createdAt;
  for (const key of PHASES) {
    const members = groups.get(key) ?? [];
    const done = members.filter((s) => span.has(s.id));
    const left = members.filter((s) => !span.has(s.id));
    const starts = done.map((s) => span.get(s.id)?.start ?? Number.NaN).filter((n) => !Number.isNaN(n));
    const ends = done.map((s) => span.get(s.id)?.end ?? Number.NaN).filter((n) => !Number.isNaN(n));
    // The first phase starts with the run; a later phase is under way as soon as the previous one ended, and once one of
    // its steps finished, its earliest known start is the better bound (after a lineup pause the previous end is the pause);
    // never before the previous phase's end, so a clock skew between rows cannot make phases overlap
    const earliest = starts.length > 0 ? Math.min(...starts) : Number.NaN;
    const prevMs = parse(previousEnd);
    const started = key === "search" ? createdAt : Number.isNaN(earliest) ? previousEnd : new Date(Number.isNaN(prevMs) ? earliest : Math.max(earliest, prevMs)).toISOString();
    const ended = members.length > 0 && left.length === 0 && ends.length > 0 ? new Date(Math.max(...ends)).toISOString() : null;
    phases.push({
      key,
      steps: members.length,
      done: done.length,
      left: left.map((s) => s.id),
      typical_ms: poolMs(key, members.map(typicalMs)),
      left_ms: poolMs(key, left.map(typicalMs)),
      // An empty phase (e.g. no lineup step in a recipe) is skipped: it starts and ends with the previous one
      started_at: members.length === 0 ? previousEnd : started,
      ended_at: members.length === 0 ? previousEnd : ended,
    });
    if (ended !== null) previousEnd = ended;
    else if (members.length > 0) previousEnd = null;
  }
  return { phases, typical_total_ms: phases.reduce((a, p) => a + p.typical_ms, 0) };
}

/** Actual over typical time of the finished phases, square-rooted (damped) and kept within 0.6x to 2x; 1 before any phase ended. */
export function runPace(ended: readonly Pick<PhaseProgress, "started_at" | "ended_at" | "typical_ms" | "steps">[]): number {
  let actual = 0;
  let typical = 0;
  for (const p of ended) {
    const took = parse(p.ended_at) - parse(p.started_at);
    if (p.steps === 0 || !Number.isFinite(took) || took < 0) continue;
    actual += took;
    typical += p.typical_ms;
  }
  if (typical === 0) return 1;
  return Math.min(2, Math.max(0.6, Math.sqrt(actual / typical)));
}

export type ProgressView = {
  /** 0..1, time-weighted; 1 only when every phase ended. */
  share: number;
  active: PhaseKey | null;
  /** Remaining research time as a range; null when paused, finished, failed or longer than usual. */
  remaining: { low_ms: number; high_ms: number } | null;
  /** The active phase ran past 2.5x its typical time. */
  longer: boolean;
  phase_elapsed_ms: number;
  /** Step ids of the active phase without a ledger row yet. */
  reading: string[];
};

type ViewStatus = "queued" | "running" | "paused" | "done" | "failed";

export function progressView(progress: RunProgress, status: ViewStatus, nowMs: number): ProgressView {
  const { phases } = progress;
  const total = progress.typical_total_ms;
  const finished = status === "done" || phases.every((p) => p.ended_at !== null);
  if (finished) return { share: 1, active: null, remaining: null, longer: false, phase_elapsed_ms: 0, reading: [] };

  const index = phases.findIndex((p) => p.ended_at === null);
  const active = phases[index];
  if (active === undefined) return { share: 1, active: null, remaining: null, longer: false, phase_elapsed_ms: 0, reading: [] };

  const ended = phases.slice(0, index);
  const doneMs = ended.reduce((a, p) => a + p.typical_ms, 0);
  // Pace of this run so far: how long its finished phases took against their typical times, damped and clamped, so a
  // run that is slow (or fast) from the start says so in its remaining time instead of trusting the table alone
  const pace = runPace(ended);
  const startedAt = parse(active.started_at);
  const elapsed = Number.isNaN(startedAt) ? 0 : Math.max(0, nowMs - startedAt);
  const expected = active.typical_ms * pace;
  const longer = status === "running" && elapsed > expected * LONGER;
  // What is left of the active phase: never more than its unfinished steps need, never more than its expected time minus what already passed
  const activeLeft = Math.max(0, Math.min(active.left_ms * pace, expected - elapsed));
  const laterMs = phases.slice(index + 1).reduce((a, p) => a + p.typical_ms, 0) * pace;
  const activeDone = expected > 0 ? Math.min(0.95, 1 - activeLeft / expected) : 0;
  const share = total > 0 ? Math.min(0.99, Math.max(0, (doneMs + activeDone * active.typical_ms) / total)) : 0;
  const counting = status === "running" || status === "queued";
  const estimate = activeLeft + laterMs;
  return {
    share,
    active: active.key,
    remaining: counting && !longer ? { low_ms: Math.round(estimate * LOW), high_ms: Math.round(estimate * HIGH) } : null,
    longer,
    phase_elapsed_ms: status === "paused" ? 0 : elapsed,
    reading: active.left,
  };
}

/** Whole minutes for the range, "under a minute" below it; null when there is nothing honest to say. */
export function remainingText(view: Pick<ProgressView, "remaining">): string | null {
  if (view.remaining === null) return null;
  const low = Math.round(view.remaining.low_ms / 60_000);
  const high = Math.max(1, Math.ceil(view.remaining.high_ms / 60_000));
  if (view.remaining.high_ms < 60_000) return "under a minute left";
  if (low < 1) return `up to ${String(high)} min left`;
  if (low === high) return `about ${String(high)} min left`;
  return `about ${String(low)} to ${String(high)} min left`;
}
