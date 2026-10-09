/**
 * Public ledger ref: the whitelist of process facts the open GET /api/runs/:id/events stream may send for one ledger row.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/events/public-ref.ts
 * Deps:    zod, src/domain/claim (CandidateDecision), src/domain/scrub (scrubReason)
 * Tested:  src/app/api/runs/[id]/events/__tests__/public-ref.test.ts
 *
 * Key responsibilities:
 * - publicRef(step, ref): keeps only whitelisted keys of a stored ledger ref; null when the ref is not an object
 * - Labels (actor, provider, waitingFor, onEmpty, fallbackStep, outcome, event, callId, type, template, translate) as
 *   strings; counts as numbers >= 0 (an array, e.g. the resolve lineup or call answers, becomes its length); flags as
 *   booleans
 * - Free text (reason, skipped, degraded, gap) through scrubReason; on `call:*` steps that text is dropped and only
 *   flags stay (`skipped: true`; a gap text becomes `gap: true`), because provider bodies can echo phone numbers
 * - decisions → counts per decision value (never candidate ids); spent → { usd, calls }; challenge → { checked, held }
 *
 * Design constraints:
 * - Pure; never throws, never casts: a malformed ref becomes null
 * - Whitelist, not blacklist: notes, the seed's subject / anchor / headline / employer, lineup candidates (url,
 *   snippet, reasons), question texts and any new key stay on the server until added here on purpose
 */
import { z } from "zod";
import { CandidateDecision } from "@/domain/claim";
import { scrubReason } from "@/domain/scrub";

const Ref = z.record(z.string(), z.unknown());
const Decisions = z.array(z.object({ decision: CandidateDecision }).loose());

const LABELS = ["actor", "provider", "waitingFor", "onEmpty", "fallbackStep", "outcome", "event", "callId", "type", "template", "translate"];
const COUNTS = ["sources", "claims", "questions", "calls", "candidates", "answers", "texts", "translated"];
const FLAGS = ["empty", "brief", "ask", "mock", "failed"];
/** Free text that may carry a request URL, an e-mail or a provider body. */
const TEXTS = ["reason", "skipped", "degraded", "gap"];
/** Numeric-only objects and the numeric fields kept from each. */
const NUMERIC_OBJECTS: Record<string, readonly string[]> = { spent: ["usd", "calls"], challenge: ["checked", "held"] };

function count(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function numericFields(value: unknown, keys: readonly string[]): Record<string, number> | null {
  const parsed = Ref.safeParse(value);
  if (!parsed.success) return null;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const n = parsed.data[key];
    if (typeof n === "number" && Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function decisionCounts(value: unknown): Record<string, number> | null {
  const parsed = Decisions.safeParse(value);
  if (!parsed.success) return null;
  const out: Record<string, number> = {};
  for (const d of parsed.data) out[d.decision] = (out[d.decision] ?? 0) + 1;
  return out;
}

/** Text field: its boolean flag, or the scrubbed string; on call steps no text (a gap text becomes `gap: true`). */
function text(key: string, value: unknown, isCall: boolean): string | boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  if (isCall) return key === "gap" ? true : undefined;
  return scrubReason(value);
}

/** The ledger ref with only process facts left; null for a ref that is not a plain object. */
export function publicRef(step: string, ref: unknown): Record<string, unknown> | null {
  const parsed = Ref.safeParse(ref);
  if (!parsed.success) return null;
  const src = parsed.data;
  const isCall = step.startsWith("call:");
  const out: Record<string, unknown> = {};
  for (const key of LABELS) {
    const v = src[key];
    if (typeof v === "string") out[key] = v;
  }
  for (const key of COUNTS) {
    const n = count(src[key]);
    if (n !== null) out[key] = n;
  }
  for (const key of FLAGS) {
    const v = src[key];
    if (typeof v === "boolean") out[key] = v;
  }
  for (const key of TEXTS) {
    const v = text(key, src[key], isCall);
    if (v !== undefined) out[key] = v;
  }
  for (const [key, fields] of Object.entries(NUMERIC_OBJECTS)) {
    const v = numericFields(src[key], fields);
    if (v !== null) out[key] = v;
  }
  const decisions = decisionCounts(src.decisions);
  if (decisions !== null) out.decisions = decisions;
  return out;
}
