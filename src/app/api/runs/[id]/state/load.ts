/**
 * Run state loader: one-shot projection of a run for the brief page poller and the report translation route.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/state/load.ts
 * Deps:    D1Database (passed in), src/domain/run-issues (readRunIssues), src/domain/scrub (scrubReason), src/domain/code-profile (readCodeProfile), src/domain/profile-facts (readProfileFacts), src/domain/profile-signals (profileSignals), src/domain/report-translation (TRANSLATE_STEP), src/domain/call-questions-llm (CALL_QUESTIONS_STEP), src/recipe/goals, src/domain/run-cost, src/domain/cv-check, src/domain/challenge, src/app/runs/[id]/challenge, src/app/intake/intake-rows (type), ./public-state
 * Tested:  src/app/api/runs/[id]/state/__tests__/route.test.ts (through the route; publicState: __tests__/public-state.test.ts; withCvQuestion: src/domain/__tests__/cv-check.test.ts; readChallenge: src/domain/__tests__/challenge.test.ts; challengeState: src/app/runs/[id]/__tests__/challenge.test.ts)
 *
 * Key responsibilities:
 * - Read investigation, candidates, claims, sources, brief and last ledger step from D1
 * - Questions = recipe base questions + investigations.questions_json, plus `cv-consistency` when the run has a CV
 *   source (withCvQuestion, same rule as the Workflow's loadContext); mentions = COUNT(sources)
 * - step_index/step_count from the recipe; failed_step = first recipe step without a ledger row on a failed run;
 *   the report translation row (step TRANSLATE_STEP, idea #24) is never the current step
 * - role = investigations.role (the brief's "Hiring for" line); subject is "" until the seed step derived it;
 *   headline = what the seed_profile ledger row recorded (plans/006); sources carry identity_reason (migration 0008),
 *   fetched_at and expires_at
 * - claims / quote_contexts / brief / failure go through publicState (the route is open): only the claims the brief
 *   shows and none touching an Art. 9 topic ([] before the brief), saved text around a quote (idea #5) only from
 *   confirmed (identity 'merged') sources, gap reasons and the failure scrubbed (scrubReason); whole excerpts never leave
 * - challenges / challenge_summary = the devil's advocate record (idea #8) read from the verify ledger row's
 *   `ref.challenge` (readChallenge, challengeState), challenges only for the kept claims; [] / null for runs before it
 * - position = LEFT JOIN positions on investigations.position_id ({id, title}); null without one or once purged (migration 0009)
 * - organization_name = LEFT JOIN organizations (null for bearer/extension runs)
 * - last_at = newest ledger ts (created_at without rows); the page shows a stalled notice from it (isStalled)
 * - cost = runCost over the ledger rows (seq order) from investigations.created_at
 * - intake = the applications row LEFT JOINed into the head query on investigations.application_id ({source, tag, receivedAt}), null for runs started by hand; never cv_text or cover_letter
 * - code_profile = readCodeProfile over the same ledger rows (the github_deep step's `ref.digest`); null for runs before it or non-technical roles
 * - issues = readRunIssues over the ledger rows with every reason through scrubReason (the route is open), so the page can list
 *   failed requests, budget stops and gaps while the run is still loading
 * - profile_signals = profileSignals over readProfileFacts(ledger), the same code profile and the mapped candidates, relative to the request time (plans/012); derived at read time, never stored
 *
 * Design constraints:
 * - Pure read; no Next.js imports; null for an unknown run (callers answer 404)
 */
import type { Candidate, Claim } from "@/domain/claim";
import { Brief, GoalId } from "@/domain/claim";
import { readChallenge } from "@/domain/challenge";
import { readCodeProfile } from "@/domain/code-profile";
import { readProfileFacts } from "@/domain/profile-facts";
import { profileSignals } from "@/domain/profile-signals";
import { readRegistryChecks } from "@/domain/cz-registry";
import { readRunIssues } from "@/domain/run-issues";
import { scrubReason } from "@/domain/scrub";
import { withCvQuestion } from "@/domain/cv-check";
import { TRANSLATE_STEP } from "@/domain/report-translation";
import { CALL_QUESTIONS_STEP } from "@/domain/call-questions-llm";
import { type CostRow, runCost } from "@/domain/run-cost";
import { recipeFor } from "@/recipe/goals";
import type { RunIntake } from "@/app/intake/intake-rows";
import { challengeState } from "@/app/runs/[id]/challenge";
import { type RunState, type RunStatus, seedHeadline } from "@/app/runs/[id]/state";
import { publicState } from "./public-state";

type HeadRow = {
  id: string;
  subject: string;
  goal: string;
  role: string | null;
  status: RunStatus;
  questions_json: string | null;
  created_at: string;
  position_id: string | null;
  position_title: string | null;
  organization_name: string | null;
  intake_source: RunIntake["source"] | null;
  intake_tag: string | null;
  intake_received_at: string | null;
};
type CandidateRow = Omit<Candidate, "profile_urls" | "reasons"> & { profile_urls_json: string; reasons_json: string };
type ClaimRow = Omit<Claim, "supports" | "contradicts"> & { supports_json: string; contradicts_json: string };
type SourceRow = { id: string; url: string; identity: string; identity_reason: string | null; fetched_at: string; expires_at: string; excerpt: string };

function parseList<T>(json: string | null): T[] {
  if (json === null || json === "") return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

/** The run as the report page sees it, or null for an unknown run. */
export async function loadRunState(db: D1Database, id: string): Promise<RunState | null> {
  const head = await db.prepare(
    `SELECT i.id, i.subject, i.goal, i.role, i.status, i.questions_json, i.created_at,
            p.id AS position_id, p.title AS position_title,
            o.name AS organization_name,
            a.source AS intake_source, a.tag AS intake_tag, a.received_at AS intake_received_at
     FROM investigations i
     LEFT JOIN positions p ON p.id = i.position_id
     LEFT JOIN organizations o ON o.id = i.organization_id
     LEFT JOIN applications a ON a.id = i.application_id
     WHERE i.id = ?`,
  )
    .bind(id)
    .first<HeadRow>();
  if (!head) return null;

  const [cands, claims, sources, brief, ledger] = await Promise.all([
    db.prepare("SELECT * FROM candidates WHERE run_id = ? ORDER BY score DESC").bind(id).all<CandidateRow>(),
    db.prepare("SELECT * FROM claims WHERE run_id = ? ORDER BY rank").bind(id).all<ClaimRow>(),
    db.prepare("SELECT id, url, identity, identity_reason, fetched_at, expires_at, excerpt FROM sources WHERE run_id = ?").bind(id).all<SourceRow>(),
    db.prepare("SELECT brief_json FROM briefs WHERE run_id = ?").bind(id).first<{ brief_json: string }>(),
    db.prepare("SELECT step, ts, kind, cost_usd, ms, ref_json FROM ledger_entries WHERE run_id = ? ORDER BY seq")
      .bind(id)
      .all<CostRow & { step: string; ref_json: string | null }>(),
  ]);
  // The failure row is written under step "run"; the step that broke is the first recipe step with no row yet.
  // A report translation (idea #24) and an AI call-question draft run after the research and are no research steps.
  const last = ledger.results.findLast((row) => row.step !== "run" && row.step !== TRANSLATE_STEP && row.step !== CALL_QUESTIONS_STEP);
  const failure = ledger.results
    .map((row) => {
      try {
        const ref: unknown = row.ref_json === null ? null : JSON.parse(row.ref_json);
        return typeof ref === "object" && ref !== null && "failed" in ref && "reason" in ref && typeof ref.reason === "string" ? ref.reason : null;
      } catch {
        return null;
      }
    })
    .find((r): r is string => r !== null);

  const goal = GoalId.safeParse(head.goal);
  const recipe = goal.success ? recipeFor(goal.data) : null;
  const base = recipe?.questions ?? [];
  const recipeSteps = recipe?.steps ?? [];
  const stepIndex = last === undefined ? 0 : recipeSteps.findIndex((s) => s.id === last.step) + 1;
  const extra = parseList<{ id: string; text: string; title?: string }>(head.questions_json);

  const runClaims = claims.results.map(({ supports_json, contradicts_json, ...c }) => ({
    ...c,
    supports: parseList<string>(supports_json),
    contradicts: parseList<string>(contradicts_json),
  }));
  const open = publicState({
    claims: runClaims,
    sources: sources.results,
    // Brief.parse fills defaults (profile, sections...) for briefs stored before those fields existed
    brief: brief ? Brief.parse(JSON.parse(brief.brief_json)) : null,
    failure: failure ?? null,
  });

  const candidates = cands.results.map(({ profile_urls_json, reasons_json, ...c }) => ({
    ...c,
    profile_urls: parseList<string>(profile_urls_json),
    reasons: parseList<string>(reasons_json),
  }));
  const codeProfile = readCodeProfile(ledger.results);

  const state: RunState = {
    id: head.id,
    subject: head.subject,
    headline: seedHeadline(ledger.results),
    role: head.role,
    position: head.position_id !== null && head.position_title !== null ? { id: head.position_id, title: head.position_title } : null,
    organization_name: head.organization_name,
    created_at: head.created_at,
    last_at: ledger.results.at(-1)?.ts ?? head.created_at,
    status: head.status,
    step: last?.step ?? null,
    mentions: sources.results.length,
    candidates,
    claims: open.claims,
    sources: sources.results.map(({ excerpt: _excerpt, identity: _identity, ...s }) => s),
    quote_contexts: open.quote_contexts,
    ...challengeState(readChallenge(ledger.results), new Set(open.claims.map((c) => c.id))),
    code_profile: codeProfile,
    profile_signals: profileSignals({ facts: readProfileFacts(ledger.results), codeProfile, candidates, now: new Date().toISOString() }),
    registry_checks: readRegistryChecks(ledger.results),
    issues: readRunIssues(ledger.results).map((i) => ({ ...i, reason: scrubReason(i.reason) })),
    questions: withCvQuestion(head.goal, [...base, ...extra], sources.results),
    brief: open.brief,
    cost: runCost(ledger.results, head.created_at),
    failure: open.failure,
    failed_step: head.status === "failed" ? (recipeSteps[stepIndex]?.id ?? last?.step ?? null) : null,
    step_index: stepIndex,
    step_count: recipeSteps.length,
    intake:
      head.intake_source === null || head.intake_received_at === null
        ? null
        : { source: head.intake_source, tag: head.intake_tag, receivedAt: head.intake_received_at },
  };
  return state;
}
