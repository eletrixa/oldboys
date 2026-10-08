/**
 * Tests for the on-demand deletion domain: request body, receipt text, ATS note and the live-call rule.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/deletion.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - DeleteBody accepts only the three reasons; receipt line and note read in plain words with non-zero counts only
 * - The note carries no personal data (built from a receipt, it has no field for any) and names the provider retention only after a call
 * - callInProgress: only a recent, real, dialing call blocks; callsWithWorkflow skips drafted and skipped calls
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  callInProgress,
  callsWithWorkflow,
  countsText,
  DeleteBody,
  deletedAtText,
  deletionNote,
  PROVIDER_RETENTION,
  receiptLine,
  type CallRow,
  type DeletionCounts,
  type DeletionReceipt,
} from "@/domain/deletion";

const ZERO: DeletionCounts = {
  sources: 0, claims: 0, candidates: 0, gaps: 0, briefs: 0, calls: 0, ledger_entries: 0, applications: 0, webhook_events: 0, cv_files: 0, r2_objects: 0,
};
const RECEIPT: DeletionReceipt = {
  run_id: "8f0c2a52-6a7e-4c55-9d1b-2f3c4d5e6f70",
  deleted_at: "2026-10-09T01:45:12.000Z",
  reason: "rejected",
  counts: { ...ZERO, sources: 23, claims: 14, briefs: 1, applications: 1, cv_files: 1, r2_objects: 24, webhook_events: 2 },
};

describe("DeleteBody", () => {
  it("accepts the three reasons and nothing else", () => {
    for (const reason of ["rejected", "candidate-request", "other"]) expect(DeleteBody.safeParse({ reason }).success).toBe(true);
    expect(DeleteBody.safeParse({ reason: "not a fit" }).success).toBe(false);
    expect(DeleteBody.safeParse({}).success).toBe(false);
  });
});

describe("receipt text", () => {
  it("formats the time in UTC with a short month", () => {
    expect(deletedAtText("2026-10-09T01:45:12.000Z")).toBe("9 Oct 2026, 01:45 UTC");
    expect(deletedAtText("garbage")).toBe("garbage");
  });

  it("lists only non-zero counts with singular and plural labels, never webhook events", () => {
    expect(countsText(RECEIPT.counts)).toBe("23 sources, 14 claims, 1 brief, 1 application, 1 CV file, 24 stored files");
    expect(countsText({ ...ZERO, webhook_events: 3 })).toBe("no stored records");
  });

  it("reads as date · reason · counts", () => {
    expect(receiptLine(RECEIPT)).toBe("Deleted on 9 Oct 2026, 01:45 UTC · Candidate rejected · 23 sources, 14 claims, 1 brief, 1 application, 1 CV file, 24 stored files");
    expect(receiptLine({ ...RECEIPT, reason: "candidate-request" })).toContain("· Candidate asked us to delete their data ·");
  });
});

describe("deletionNote", () => {
  it("is plain text with date, reason, run id and counts", () => {
    expect(deletionNote(RECEIPT).split("\n")).toEqual([
      "Candidate research data deleted",
      "Date: 9 Oct 2026, 01:45 UTC",
      "Reason: Candidate rejected",
      "Research run: 8f0c2a52-6a7e-4c55-9d1b-2f3c4d5e6f70",
      "Deleted: 23 sources, 14 claims, 1 brief, 1 application, 1 CV file, 24 stored files",
      "All research data for this candidate was deleted from the research tool at once and cannot be restored.",
    ]);
  });

  it("has no URL, e-mail, Markdown or judging words", () => {
    const note = deletionNote({ ...RECEIPT, counts: { ...RECEIPT.counts, calls: 1 } });
    expect(note).not.toMatch(/https?:|@|\*|#|\[/);
    expect(note.toLowerCase()).not.toMatch(/\b(score|fit|weak|strong|poor|good|bad)\b/);
  });

  it("names the call provider's own retention only when the run had a call", () => {
    expect(deletionNote(RECEIPT)).not.toContain(PROVIDER_RETENTION);
    expect(deletionNote({ ...RECEIPT, counts: { ...RECEIPT.counts, calls: 1 } })).toContain(PROVIDER_RETENTION);
  });
});

describe("calls", () => {
  const NOW = new Date("2026-10-09T02:00:00.000Z");
  const call = (over: Partial<CallRow>): CallRow => ({ id: "c1", status: "dialing", provider: "elevenlabs", approved_at: "2026-10-09T01:55:00.000Z", ...over });

  it("counts a recent real dialing call as in progress", () => {
    expect(callInProgress([call({})], NOW)).toBe(true);
  });

  it("ignores finished, mock, stale and never-approved calls", () => {
    expect(callInProgress([call({ status: "done" })], NOW)).toBe(false);
    expect(callInProgress([call({ provider: "mock" })], NOW)).toBe(false);
    expect(callInProgress([call({ approved_at: "2026-10-09T01:15:00.000Z" })], NOW)).toBe(false);
    expect(callInProgress([call({ approved_at: null })], NOW)).toBe(false);
    expect(callInProgress([], NOW)).toBe(false);
  });

  it("lists the calls that may have a Workflow instance", () => {
    const calls = ["drafted", "skipped", "dialing", "done", "failed", "no_answer", "refused"].map((status) => call({ id: status, status }));
    expect(callsWithWorkflow(calls)).toEqual(["dialing", "done", "failed", "no_answer", "refused"]);
  });
});
