/**
 * GDPR audit record: one projection of a run that says who started it, why, what was queried and when it is deleted.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/audit.ts
 * Deps:    zod, src/domain/run-cost, src/domain/scrub
 * Tested:  src/domain/__tests__/audit.test.ts
 *
 * Key responsibilities:
 * - auditRecord(rows): start channel (form / extension / api), legal basis + purpose + candidate notice note, every
 *   collector step with status (ok / empty / failed / not searched + reason), items and cost, model call count,
 *   lineup answers, verification call statuses (MOCK flagged) and the scheduled deletion date
 * - LEGAL_BASIS states only what the hiring team declares; NOTICE_NOTE says the tool records no candidate notice
 * - RETENTION_DAYS / deletionDate: single source of the 7-day retention, also used by src/workflow/purge.ts
 *
 * Design constraints:
 * - Pure: no I/O; rows come from D1 via the caller, recipe steps are passed as plain data
 * - Never carries traits, claims, excerpts, profile URLs or phone numbers; lineup rows keep platform + answer, and
 *   the title only for "yes" (the subject's confirmed profile), null for namesakes and "not sure"
 * - Every source reason passes scrubReason once, in auditRecord (no URLs with queries, e-mails or phone numbers)
 * - Never claims the candidate was informed: no code records a notice
 * - Unreadable ref_json never throws; the step then reads as "no record"
 */
import { z } from "zod";
import { runCost } from "@/domain/run-cost";
import { scrubReason } from "@/domain/scrub";

export const RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const LEGAL_BASIS =
  "Legitimate interest, Art. 6(1)(f) GDPR, as declared by the hiring team: pre-employment screening of public professional data.";
export const NOTICE_NOTE =
  "Not recorded by this tool. The hiring team informs the candidate (GDPR Art. 14), for example with the candidate notice from the run page.";
export const RETENTION_NOTE = "Earlier deletion on request (done by hand; no automatic delete on rejection yet).";

/** Recipe step kinds that query an outside source; the others are model seams or the lineup. */
const COLLECTOR_KINDS: ReadonlySet<string> = new Set(["serp", "actor", "ares"]);
const NOT_SEARCHED = "not searched: ";

export type StartChannel = "form" | "extension" | "api";
export type SourceStatus = "ok" | "empty" | "failed" | "not searched";
export type LineupAnswer = "yes" | "no" | "not sure";

export type AuditRun = {
  id: string;
  subject: string;
  anchor: string;
  goal: string;
  role: string | null;
  status: string;
  via: string;
  source_url: string | null;
  created_at: string;
};
export type AuditStep = { id: string; kind: string; actor?: string };
export type AuditLedgerRow = { step: string; ts: string; kind: string; cost_usd: number; ms: number; ref_json: string | null };
export type AuditGap = { question_id: string; reason: string };
export type AuditCandidate = { id: string; platform: string; name: string };
export type AuditCall = { status: string; provider: string; created_at: string; finished_at: string | null };

export type AuditRows = {
  run: AuditRun;
  steps: readonly AuditStep[];
  ledger: readonly AuditLedgerRow[];
  gaps: readonly AuditGap[];
  candidates: readonly AuditCandidate[];
  calls: readonly AuditCall[];
  now: string;
};

export type AuditSource = {
  step: string;
  source: string;
  time: string | null;
  status: SourceStatus;
  reason: string | null;
  items: number;
  cost_usd: number;
};

export type AuditRecord = {
  record: "oldboys.audit-record";
  generated_at: string;
  run: {
    id: string;
    started_via: StartChannel;
    started_at: string;
    status: string;
    goal: string;
    subject: string;
    anchor: string;
    role: string | null;
  };
  legal: { basis: string; purpose: string; notice: string };
  sources: AuditSource[];
  model_calls: number;
  total_cost_usd: number;
  lineup: { platform: string; title: string | null; answer: LineupAnswer }[];
  verification_calls: { status: string; mock: boolean; created_at: string; finished_at: string | null }[];
  retention: { days: number; delete_after: string; note: string };
};

const CallRef = z.object({ sources: z.number().optional() });
const SkipRef = z.object({ skipped: z.string() });
const FailRef = z.object({ failed: z.literal(true), reason: z.string() });
const DecisionsRef = z.object({ decisions: z.array(z.object({ id: z.string(), decision: z.string() })) });

function ref<T>(schema: z.ZodType<T>, json: string | null): T | null {
  if (json === null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** created_at + RETENTION_DAYS as ISO; an unreadable date yields "" rather than a wrong date. */
export function deletionDate(createdAt: string): string {
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? "" : new Date(t + RETENTION_DAYS * DAY_MS).toISOString();
}

export function startChannel(via: string, sourceUrl: string | null): StartChannel {
  if (via === "start") return "form";
  return sourceUrl !== null && sourceUrl !== "" ? "extension" : "api";
}

function lineupAnswer(decision: string): LineupAnswer {
  if (decision === "merge") return "yes";
  if (decision === "rejected") return "no";
  return "not sure";
}

function purpose(run: AuditRun): string {
  if (run.role !== null && run.role !== "") return `Pre-employment screening for the role: ${run.role}`;
  return `Research goal: ${run.goal} (no role entered)`;
}

/** Why a step without any ledger row has none: the run broke there, broke earlier, or has not reached it. */
function missingReason(run: AuditRun, failedStep: string | undefined, stepId: string, failure: string | null): { status: SourceStatus; reason: string } {
  if (run.status === "failed") {
    if (failedStep === stepId) return { status: "failed", reason: failure ?? "step failed" };
    return { status: "not searched", reason: "run stopped before this step" };
  }
  if (run.status === "done") return { status: "not searched", reason: "no record of this step" };
  return { status: "not searched", reason: "not reached yet" };
}

function sourceRow(
  stepId: string,
  source: string,
  rows: readonly AuditLedgerRow[],
  gap: string | undefined,
  missing: () => { status: SourceStatus; reason: string },
): AuditSource {
  const cost_usd = round2(rows.reduce((sum, r) => sum + (r.cost_usd > 0 ? r.cost_usd : 0), 0));
  const call = rows.find((r) => r.kind === "call");
  const skip = rows.map((r) => ref(SkipRef, r.ref_json)).find((r) => r !== null);
  const base = { step: stepId, source, cost_usd };
  if (skip) return { ...base, time: rows[0]?.ts ?? null, status: "not searched", reason: skip.skipped, items: 0 };
  if (gap?.startsWith(NOT_SEARCHED) === true) return { ...base, time: call?.ts ?? null, status: "not searched", reason: gap.slice(NOT_SEARCHED.length), items: 0 };
  if (call) {
    const items = ref(CallRef, call.ref_json)?.sources ?? 0;
    return { ...base, time: call.ts, status: items > 0 ? "ok" : "empty", reason: gap ?? null, items };
  }
  if (gap !== undefined) return { ...base, time: null, status: "empty", reason: gap, items: 0 };
  return { ...base, time: null, items: 0, ...missing() };
}

/** Builds the audit record of one run from its D1 rows (ledger in seq order) and its recipe steps. */
export function auditRecord(rows: AuditRows): AuditRecord {
  const { run, steps, ledger, gaps, candidates, calls } = rows;
  const byStep = new Map<string, AuditLedgerRow[]>();
  for (const r of ledger) byStep.set(r.step, [...(byStep.get(r.step) ?? []), r]);
  const gapOf = new Map(gaps.map((g) => [g.question_id, g.reason]));
  const failure = ledger.map((r) => ref(FailRef, r.ref_json)).find((r) => r !== null)?.reason ?? null;
  const failedStep = steps.find((s) => !byStep.has(s.id))?.id;

  const sources: AuditSource[] = [];
  for (const s of steps) {
    if (!COLLECTOR_KINDS.has(s.kind)) continue;
    const name = s.actor ?? s.id;
    sources.push(sourceRow(s.id, name, byStep.get(s.id) ?? [], gapOf.get(s.id), () => missingReason(run, failedStep, s.id, failure)));
    const fallbackId = `${s.id}:fallback`;
    const fallback = byStep.get(fallbackId);
    if (fallback) sources.push(sourceRow(fallbackId, `${name} (fallback)`, fallback, undefined, () => missingReason(run, undefined, fallbackId, failure)));
  }

  const names = new Map(candidates.map((c) => [c.id, c]));
  const answered = ledger.map((r) => ref(DecisionsRef, r.ref_json)).findLast((r) => r !== null);
  const lineup = (answered?.decisions ?? []).flatMap((d) => {
    const c = names.get(d.id);
    if (!c) return [];
    const answer = lineupAnswer(d.decision);
    return [{ platform: c.platform, title: answer === "yes" ? c.name : null, answer }];
  });

  const cost = runCost(ledger, run.created_at);
  return {
    record: "oldboys.audit-record",
    generated_at: rows.now,
    run: {
      id: run.id,
      started_via: startChannel(run.via, run.source_url),
      started_at: run.created_at,
      status: run.status,
      goal: run.goal,
      subject: run.subject,
      anchor: run.anchor,
      role: run.role,
    },
    legal: { basis: LEGAL_BASIS, purpose: purpose(run), notice: NOTICE_NOTE },
    sources: sources.map((s) => ({ ...s, reason: s.reason === null ? null : scrubReason(s.reason) })),
    model_calls: cost.llm_calls,
    total_cost_usd: cost.usd,
    lineup,
    verification_calls: calls.map((c) => ({ status: c.status, mock: c.provider === "mock", created_at: c.created_at, finished_at: c.finished_at })),
    retention: { days: RETENTION_DAYS, delete_after: deletionDate(run.created_at), note: RETENTION_NOTE },
  };
}
