/**
 * Zod schemas for the core aggregates: Investigation, Candidate, Source, Claim, Gap, LedgerEntry, Brief (+ BriefSection).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/claim.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/claim.test.ts
 *
 * Key responsibilities:
 * - Single source of truth for the domain shapes (plans/001 domain map); every track imports from here
 * - Enforce the FACT invariant: a FACT must carry a quote; quote ⊂ excerpt is checked in src/recipe/seams/verify.ts
 * - STATEMENT (plans/005): a consented callee said it on a verification call; same quote + support
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
  questions: z.array(z.object({ id: z.string().min(1), text: z.string().min(1), title: z.string().min(1).optional() })),
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

export const SourceIdentity = z.enum(["merged", "unverified"]);
export type SourceIdentity = z.infer<typeof SourceIdentity>;

export const Source = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  url: z.url(),
  actor: z.string().min(1),
  fetched_at: z.string().min(1),
  excerpt: z.string(),
  r2_key: z.string().min(1),
  expires_at: z.string().min(1),
  /** "merged" = fetched for a confirmed identity (merged candidate or IČO anchor); "unverified" = discovery or name search, may be a namesake. */
  identity: SourceIdentity,
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

/**
 * One block of the finished brief, cut by what the run actually found (a question with claims, social presence,
 * or a platform with confirmed sources but no claim). `confidence` is deterministic (src/domain/confidence.ts).
 */
export const BriefSection = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  confidence: z.number().min(0).max(1),
  confidence_reason: z.string(),
  claim_ids: z.array(z.string().min(1)),
  source_ids: z.array(z.string().min(1)),
  summary: z.string(),
});
export type BriefSection = z.infer<typeof BriefSection>;

/** One evidence line of the enriched profile: a verbatim sentence by or about the person, and whether it supports or weakens the point. */
export const ProfileEvidence = z.object({
  quote: z.string().min(1),
  source_id: z.string().min(1),
  kind: z.enum(["FACT", "INFERENCE"]),
  supports: z.boolean(),
  /** Finer direction than `supports`: context lines neither prove nor weaken. Optional for briefs stored before it existed. */
  direction: z.enum(["supports", "contradicts", "context"]).optional(),
  /** Where the line comes from, as a recruiter would say it: "LinkedIn experience, self-reported", "Meta farewell post, 2022-03-28". */
  note: z.string().default(""),
});
export type ProfileEvidence = z.infer<typeof ProfileEvidence>;

export const ProfileItem = z.object({
  text: z.string().min(1),
  /** One or two sentences under the heading; empty when the heading says it all. */
  detail: z.string().default(""),
  evidence: z.array(ProfileEvidence),
});
export type ProfileItem = z.infer<typeof ProfileItem>;

export const HistoryEntry = z.object({
  organization: z.string().min(1),
  title: z.string().min(1),
  from: z.string().nullable(),
  to: z.string().nullable(),
  /** "job" or a relevant non-job part: education, project, volunteering. */
  kind: z.enum(["job", "education", "project", "volunteering", "other"]),
  location: z.string().default(""),
  /** As the source writes it, e.g. "1 yr 9 mos". */
  duration: z.string().default(""),
  summary: z.string(),
  evidence: z.array(ProfileEvidence),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const TraitFit = z.object({
  trait: z.string().min(1),
  status: z.enum(["has", "partial", "none"]),
  /** Role weight 0..3; fit = sum(weight x status) / sum(weight), status has 1, partial 0.5, none 0. Weight 1 everywhere is the plain share. */
  weight: z.number().int().min(0).max(3).default(1),
  evidence: z.array(ProfileEvidence),
});

export const PositionFit = z.object({
  role: z.string().min(1),
  /** Share of required traits with supporting evidence, partial counts half; 0..100. */
  fit_pct: z.number().int().min(0).max(100),
  traits: z.array(TraitFit),
  rationale: z.string(),
});
export type PositionFit = z.infer<typeof PositionFit>;

/**
 * Enriched hiring profile (Robert, 2026-10-09): achievements, risks, history, personality read, position fit and
 * questions, every item with its evidence lines. Personality and fit are inferences from public writing, labelled so
 * in the UI; never a score of the person as such.
 */
export const Profile = z.object({
  achievements: z.array(ProfileItem),
  risks: z.array(ProfileItem),
  history: z.array(HistoryEntry),
  personality: z.object({
    disc: z.object({ type: z.string().min(1), confidence: z.enum(["low", "medium", "high"]) }).nullable(),
    mbti: z.object({ type: z.string().min(1), confidence: z.enum(["low", "medium", "high"]) }).nullable(),
    read: z.string(),
    /** Working-style trait rows, each backed by the person's own quotes. */
    traits: z.array(ProfileItem).default([]),
    evidence: z.array(ProfileEvidence),
    /** Lines dropped: quote not in the excerpt, or the source is not the person's own writing. Defaulted for older briefs. */
    evidence_dropped: z.number().int().min(0).default(0),
  }),
  position_fit: z.array(PositionFit),
  questions: z.array(z.object({ text: z.string().min(1), closes: z.string() })),
  /** Why the profile could not be built (model failure); null when it ran. */
  degraded: z.string().nullable(),
  /** Evidence lines per section dropped by the quote-in-excerpt check, for "N lines dropped" footers. Defaulted for older briefs. */
  achievements_dropped: z.number().int().min(0).default(0),
  risks_dropped: z.number().int().min(0).default(0),
  history_dropped: z.number().int().min(0).default(0),
  fit_dropped: z.number().int().min(0).default(0),
});
export type Profile = z.infer<typeof Profile>;

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
  /** Steps that made no request (budget, nothing to look up); `source` = step id, reason without the "not searched:" prefix. */
  not_searched: z.array(z.object({ source: z.string().min(1), reason: z.string().min(1) })),
  /** Steps that searched and found nothing; `source` = step id. Defaulted for briefs stored before the field existed. */
  searched_empty: z.array(z.object({ source: z.string().min(1), reason: z.string().min(1) })).default([]),
  /** Count of claims dropped by the protected-category filter (GDPR Art. 9); content never stored in the brief. */
  removed_protected: z.number().int().nonnegative(),
  /** Why the model layer was unavailable (evidence-only brief); null when the AI summary ran. Defaulted for briefs stored before the field existed. */
  degraded: z.string().nullable().default(null),
  /** Confirmed sources (identity merged, cap 40) so a degraded brief still links its evidence. */
  evidence: z.array(z.object({ step: z.string(), url: z.string(), excerpt: z.string().max(300) })).default([]),
  /** SERP and name-search hits whose identity was never confirmed: shown as "also found, not confirmed", never claimed. */
  also_found: z.array(z.object({ step: z.string(), url: z.string(), excerpt: z.string().max(300) })).default([]),
  /** Title line of the best confirmed profile (LinkedIn first), max 160 chars: a quote, never an inference. Defaulted for older briefs. */
  headline: z.string().max(160).nullable().default(null),
  /** "Confirmed profile mentions <place>, you entered <anchor>": deterministic anchor contradiction, null when none. Defaulted for older briefs. */
  location_note: z.string().nullable().default(null),
  /** Findings by section, built deterministically in the synthesize seam. Defaulted for older briefs. */
  sections: z.array(BriefSection).default([]),
  /** Enriched profile built by the profile seam after synthesize; null for older briefs or when the step did not run. */
  profile: Profile.nullable().default(null),
});
export type Brief = z.infer<typeof Brief>;
