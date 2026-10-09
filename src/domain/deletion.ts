/**
 * Delete a run's data now (on rejection or request): reasons, deletion counts, the receipt and the plain-text note for the ATS.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/deletion.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/deletion.test.ts
 *
 * Key responsibilities:
 * - DeleteReason (rejected / candidate-request / other) and the request body schema of POST /api/runs/:id/delete
 * - DeletionCounts: what deleteRunData (src/workflow/purge.ts) removed, per D1 table plus CV files and R2 objects
 * - DeletionReceipt: { run_id, deleted_at, reason, counts }, the only thing the route returns
 * - countsText / receiptLine / deletionNote: the receipt in plain words for the run page and the ATS
 * - callInProgress: a live phone call blocks the delete (409) until it ends or is stale (CALL_LIVE_MS)
 * - PROVIDER_RETENTION: what this button cannot delete at the phone provider (docs/ops/call-verification.md)
 *
 * Design constraints:
 * - Pure; no personal data in the receipt or the note: no name, no URLs, no CV text, only the run id, date, reason and counts
 * - Wording never judges the candidate: the reason is a hiring step or a request, never a verdict
 */
import { z } from "zod";

export const DeleteReason = z.enum(["rejected", "candidate-request", "other"]);
export type DeleteReason = z.infer<typeof DeleteReason>;
export const DeleteBody = z.object({ reason: DeleteReason });

export const REASON_LABEL: Record<DeleteReason, string> = {
  rejected: "Candidate rejected",
  "candidate-request": "Candidate asked us to delete their data",
  other: "Other",
};

export type DeletionCounts = {
  sources: number;
  claims: number;
  candidates: number;
  gaps: number;
  briefs: number;
  calls: number;
  ledger_entries: number;
  applications: number;
  webhook_events: number;
  /** Intake CV files in R2 (also counted in r2_objects). */
  cv_files: number;
  /** Every R2 object: saved source copies, call results and CV files. */
  r2_objects: number;
};

export type DeletionReceipt = { run_id: string; deleted_at: string; reason: DeleteReason; counts: DeletionCounts };

/** What the phone provider keeps on its side; true to the live setup in docs/ops/call-verification.md. */
export const PROVIDER_RETENTION =
  "Phone calls: the call provider (ElevenLabs) keeps its copy of the call transcript for up to 7 days under its own retention setting, and no audio is stored; deleting here does not delete that copy.";

/** Plain labels in reading order; tables that are an implementation detail (webhook events) are not listed. */
const LABELS: readonly [key: keyof DeletionCounts, one: string, many: string][] = [
  ["sources", "source", "sources"],
  ["claims", "claim", "claims"],
  ["candidates", "profile", "profiles"],
  ["gaps", "open point", "open points"],
  ["briefs", "brief", "briefs"],
  ["calls", "phone call", "phone calls"],
  ["applications", "application", "applications"],
  ["cv_files", "CV file", "CV files"],
  ["r2_objects", "stored file", "stored files"],
  ["ledger_entries", "log entry", "log entries"],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Oct 2026, 01:45 UTC"; the raw value when it does not parse. */
export function deletedAtText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(d.getUTCDate())} ${MONTHS[d.getUTCMonth()] ?? ""} ${String(d.getUTCFullYear())}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "23 sources, 14 claims, 1 CV file, 24 stored files"; only non-zero counts. */
export function countsText(counts: DeletionCounts): string {
  const parts = LABELS.filter(([key]) => counts[key] > 0).map(([key, one, many]) => `${String(counts[key])} ${counts[key] === 1 ? one : many}`);
  return parts.length > 0 ? parts.join(", ") : "no stored records";
}

/** One line for the run page: "Deleted on 9 Oct 2026, 01:45 UTC · Candidate rejected · 23 sources, …". */
export function receiptLine(receipt: DeletionReceipt): string {
  return `Deleted on ${deletedAtText(receipt.deleted_at)} · ${REASON_LABEL[receipt.reason]} · ${countsText(receipt.counts)}`;
}

/** Short plain-text note for the candidate's card in an ATS; one item per line, no personal data. */
export function deletionNote(receipt: DeletionReceipt): string {
  return [
    "Candidate research data deleted",
    `Date: ${deletedAtText(receipt.deleted_at)}`,
    `Reason: ${REASON_LABEL[receipt.reason]}`,
    `Research run: ${receipt.run_id}`,
    `Deleted: ${countsText(receipt.counts)}`,
    "All research data for this candidate was deleted from the research tool at once and cannot be restored.",
    ...(receipt.counts.calls > 0 ? [PROVIDER_RETENTION] : []),
  ].join("\n");
}

/** A dialing call older than this is stale (the result Workflow waits 30 minutes, then polls), so it no longer blocks. */
export const CALL_LIVE_MS = 40 * 60_000;

export type CallRow = { id: string; status: string; provider: string; approved_at: string | null };

/** True when a real (non-mock) call was placed recently and has no result yet: the phone may still be ringing or talking. */
export function callInProgress(calls: readonly CallRow[], now: Date): boolean {
  return calls.some((c) => {
    if (c.status !== "dialing" || c.provider === "mock" || c.approved_at === null) return false;
    const placed = Date.parse(c.approved_at);
    return !Number.isNaN(placed) && now.getTime() - placed < CALL_LIVE_MS;
  });
}

/** Calls that may have a VerificationCallWorkflow instance (id = call id): every call that was approved. */
export function callsWithWorkflow(calls: readonly CallRow[]): string[] {
  return calls.filter((c) => c.status !== "drafted" && c.status !== "skipped").map((c) => c.id);
}
