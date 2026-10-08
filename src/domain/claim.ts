/**
 * Zod schemas for the core aggregates: Investigation, Candidate, Source, Claim, Gap, LedgerEntry.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/claim.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/claim.test.ts
 *
 * Key responsibilities:
 * - Single source of truth for the domain shapes (plans/001 domain map); every track imports from here
 * - Enforce the FACT invariant: a FACT must carry a quote (verify.ts, TODO, will check quote ⊂ excerpt)
 * - STATEMENT (plans/003): a consented callee said it on a verification call; same quote + support
 *   rule as FACT, but never presented as a public fact (confidence capped in call-ingest.ts)
 *
 * Design constraints:
 * - Field names are snake_case and mirror migrations/0001_init.sql one to one (no mapping layer)
 * - Pure: no I/O, no Workers types; must run under plain Node in Vitest
 */
import { z } from "zod";

export const GoalId = z.enum(["hiring", "due-diligence"]);
export type GoalId = z.infer<typeof GoalId>;

export const InvestigationStatus = z.enum(["queued", "running", "paused", "done", "failed"]);
export type InvestigationStatus = z.infer<typeof InvestigationStatus>;

export const Investigation = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  anchor: z.string().min(1),
  goal: GoalId,
  status: InvestigationStatus,
  budget_usd: z.number().nonnegative(),
  budget_calls: z.number().int().nonnegative(),
  budget_ms: z.number().int().positive(),
  created_at: z.string().min(1),
  /** Free-text role the manager is hiring for (hiring goal); null for other goals. */
  role: z.string().nullable(),
  /** Dynamic must-have questions derived from `role`; merged with the recipe's base questions. */
  questions: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })),
});
export type Investigation = z.infer<typeof Investigation>;

export const CandidateDecision = z.enum(["merge", "possibly-same-as", "rejected"]);
export type CandidateDecision = z.infer<typeof CandidateDecision>;

export const Candidate = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  name: z.string().min(1),
  profile_urls: z.array(z.url()),
  anchor_match: z.string().nullable(),
  score: z.number().min(0).max(1),
  decision: CandidateDecision,
  /** Where the profile lives: linkedin, github, instagram, x, web, ares ... */
  platform: z.string().min(1),
  handle: z.string().nullable(),
  /** Short public snippet shown in the lineup (title, employer, city). */
  snippet: z.string(),
  /** Human-readable reasons behind `score` and `decision`. */
  reasons: z.array(z.string()),
});
export type Candidate = z.infer<typeof Candidate>;

export const Source = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  url: z.url(),
  actor: z.string().min(1),
  fetched_at: z.string().min(1),
  excerpt: z.string(),
  r2_key: z.string().min(1),
  expires_at: z.string().min(1),
});
export type Source = z.infer<typeof Source>;

export const ClaimKind = z.enum(["FACT", "INFERENCE", "STATEMENT"]);
export type ClaimKind = z.infer<typeof ClaimKind>;

export const Claim = z
  .object({
    id: z.string().min(1),
    run_id: z.string().min(1),
    question_id: z.string().min(1),
    candidate_id: z.string().min(1).nullable(),
    text: z.string().min(1),
    kind: ClaimKind,
    confidence: z.number().min(0).max(1),
    quote: z.string().nullable(),
    supports: z.array(z.string().min(1)),
    contradicts: z.array(z.string().min(1)),
    rank: z.number().int().nonnegative(),
  })
  .refine((c) => c.kind === "INFERENCE" || (c.quote !== null && c.quote.trim().length > 0), {
    message: "A FACT or STATEMENT claim must carry a verbatim quote",
    path: ["quote"],
  })
  .refine((c) => c.kind === "INFERENCE" || c.supports.length > 0, {
    message: "A FACT or STATEMENT claim must cite at least one supporting source",
    path: ["supports"],
  });
export type Claim = z.infer<typeof Claim>;

export const Gap = z.object({
  run_id: z.string().min(1),
  question_id: z.string().min(1),
  reason: z.string().min(1),
});
export type Gap = z.infer<typeof Gap>;

export const LedgerKind = z.enum(["call", "llm", "decision", "pause"]);
/** A Gap is recorded as a `decision` ledger row with `ref: { gap: true, ... }` (no schema change on D1). */
export type LedgerKind = z.infer<typeof LedgerKind>;

export const LedgerEntry = z.object({
  run_id: z.string().min(1),
  seq: z.number().int().positive(),
  ts: z.string().min(1),
  step: z.string().min(1),
  kind: LedgerKind,
  cost_usd: z.number().nonnegative(),
  ms: z.number().int().nonnegative(),
  ref: z.unknown(),
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;

export const Coverage = z.enum(["evidenced", "partial", "none"]);
export type Coverage = z.infer<typeof Coverage>;

/** The hiring-manager brief: one block per question (= must-have), gaps turned into interview questions. */
export const Brief = z.object({
  run_id: z.string().min(1),
  per_question: z.array(
    z.object({
      question_id: z.string().min(1),
      coverage: Coverage,
      claim_ids: z.array(z.string().min(1)),
      summary: z.string(),
    }),
  ),
  interview_questions: z.array(z.string()),
  to_verify: z.array(z.string()),
  not_searched: z.array(z.object({ source: z.string().min(1), reason: z.string().min(1) })),
  /** Count of claims dropped by the protected-category filter (GDPR Art. 9); content never stored in the brief. */
  removed_protected: z.number().int().nonnegative(),
});
export type Brief = z.infer<typeof Brief>;
