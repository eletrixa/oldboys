/**
 * Tests for the GDPR audit record projection of a run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/audit.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Start channel (form / extension / api), legal basis + purpose, deletion date = created_at + 7 days
 * - Collector status: ok, empty, not searched (budget skip or "not searched:" gap), failed, fallback rows
 * - Lineup answers map to yes / no / not sure with platform + title only; calls keep status + MOCK flag
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { auditRecord, deletionDate, LEGAL_BASIS, RETENTION_DAYS, startChannel, type AuditLedgerRow, type AuditRows } from "@/domain/audit";

const START = "2026-10-08T20:00:00.000Z";

const STEPS = [
  { id: "serp_person", kind: "serp", actor: "apify/google-search-scraper" },
  { id: "resolve_lineup", kind: "resolve" },
  { id: "github_profile", kind: "actor", actor: "rest/github" },
  { id: "x_profile", kind: "actor", actor: "apidojo/tweet-scraper" },
  { id: "synthesize_report", kind: "synthesize" },
];

function row(step: string, kind: string, ref: unknown, cost_usd = 0, ts = "20:00:10"): AuditLedgerRow {
  return { step, ts: `2026-10-08T${ts}.000Z`, kind, cost_usd, ms: 0, ref_json: ref === null ? null : JSON.stringify(ref) };
}

function rows(over: Partial<AuditRows> = {}): AuditRows {
  return {
    run: {
      id: "run-1",
      subject: "Jana Dvořáková",
      anchor: "Brno",
      goal: "hiring",
      role: "Senior backend engineer",
      status: "done",
      via: "start",
      source_url: null,
      created_at: START,
    },
    steps: STEPS,
    ledger: [],
    gaps: [],
    candidates: [],
    calls: [],
    now: "2026-10-08T21:00:00.000Z",
    ...over,
  };
}

describe("startChannel", () => {
  it("reads the form, the extension (api with a page url) and plain api", () => {
    expect(startChannel("start", null)).toBe("form");
    expect(startChannel("api", "https://www.linkedin.com/in/jana")).toBe("extension");
    expect(startChannel("api", null)).toBe("api");
  });
});

describe("deletionDate", () => {
  it("is created_at plus the retention days, empty for an unreadable date", () => {
    expect(RETENTION_DAYS).toBe(7);
    expect(deletionDate(START)).toBe("2026-10-15T20:00:00.000Z");
    expect(deletionDate("nope")).toBe("");
  });
});

describe("auditRecord", () => {
  it("carries the run head, legal basis, purpose and retention", () => {
    const a = auditRecord(rows());
    expect(a.run).toEqual({
      id: "run-1",
      started_via: "form",
      started_at: START,
      status: "done",
      goal: "hiring",
      subject: "Jana Dvořáková",
      anchor: "Brno",
      role: "Senior backend engineer",
    });
    expect(a.legal).toEqual({ basis: LEGAL_BASIS, purpose: "Pre-employment screening for the role: Senior backend engineer" });
    expect(a.retention).toEqual({ days: 7, delete_after: "2026-10-15T20:00:00.000Z", note: "Deleted earlier on rejection." });
    expect(a.generated_at).toBe("2026-10-08T21:00:00.000Z");
  });

  it("lists only collector steps with status, items, time and cost", () => {
    const a = auditRecord(
      rows({
        ledger: [
          row("serp_person", "call", { sources: 8, calls: 1 }, 0.004, "20:00:05"),
          row("resolve_lineup", "llm", { calls: 1 }, 0.02),
          row("github_profile", "call", { sources: 0, calls: 0, empty: true }, 0, "20:01:00"),
          row("x_profile", "decision", { skipped: "run budget reached" }, 0, "20:01:02"),
          row("synthesize_report", "llm", { calls: 2 }, 0.05),
        ],
        gaps: [{ question_id: "github_profile", reason: "no public GitHub profile found" }],
      }),
    );
    expect(a.sources).toEqual([
      { step: "serp_person", source: "apify/google-search-scraper", time: "2026-10-08T20:00:05.000Z", status: "ok", reason: null, items: 8, cost_usd: 0 },
      { step: "github_profile", source: "rest/github", time: "2026-10-08T20:01:00.000Z", status: "empty", reason: "no public GitHub profile found", items: 0, cost_usd: 0 },
      { step: "x_profile", source: "apidojo/tweet-scraper", time: "2026-10-08T20:01:02.000Z", status: "not searched", reason: "run budget reached", items: 0, cost_usd: 0 },
    ]);
    expect(a.model_calls).toBe(3);
    expect(a.total_cost_usd).toBe(0.07);
  });

  it("rounds a step cost to cents", () => {
    const a = auditRecord(rows({ ledger: [row("serp_person", "call", { sources: 1 }, 0.0349)] }));
    expect(a.sources[0]?.cost_usd).toBe(0.03);
  });

  it("reads a 'not searched:' gap as not searched with the reason", () => {
    const a = auditRecord(
      rows({
        ledger: [row("x_profile", "call", { sources: 0, calls: 0 })],
        gaps: [{ question_id: "x_profile", reason: "not searched: no confirmed X handle" }],
      }),
    );
    expect(a.sources.find((s) => s.step === "x_profile")).toMatchObject({ status: "not searched", reason: "no confirmed X handle" });
  });

  it("adds a fallback row when the fallback step ran", () => {
    const a = auditRecord(rows({ ledger: [row("serp_person", "call", { sources: 0 }), row("github_profile:fallback", "call", { sources: 2 })] }));
    expect(a.sources.find((s) => s.step === "github_profile:fallback")).toMatchObject({ source: "rest/github (fallback)", status: "ok", items: 2 });
  });

  it("marks the step where a failed run broke and the later ones as not searched", () => {
    const a = auditRecord(
      rows({
        run: { ...rows().run, status: "failed" },
        ledger: [row("serp_person", "call", { sources: 3 }), row("resolve_lineup", "llm", { calls: 1 }), row("run", "decision", { failed: true, reason: "actor timeout" })],
      }),
    );
    expect(a.sources.map((s) => [s.step, s.status, s.reason])).toEqual([
      ["serp_person", "ok", null],
      ["github_profile", "failed", "actor timeout"],
      ["x_profile", "not searched", "run stopped before this step"],
    ]);
  });

  it("says a running run has not reached a step yet", () => {
    const a = auditRecord(rows({ run: { ...rows().run, status: "running" } }));
    expect(a.sources[0]).toMatchObject({ status: "not searched", reason: "not reached yet" });
  });

  it("maps the last lineup answer to yes / no / not sure with platform and title only", () => {
    const a = auditRecord(
      rows({
        candidates: [
          { id: "c1", platform: "linkedin", name: "Jana Dvořáková – Backend engineer" },
          { id: "c2", platform: "github", name: "jdvorakova" },
          { id: "c3", platform: "instagram", name: "jana.d" },
        ],
        ledger: [
          row("resolve_lineup", "decision", { decisions: [{ id: "c1", decision: "rejected" }] }),
          row("resolve_lineup", "decision", {
            decisions: [
              { id: "c1", decision: "merge" },
              { id: "c2", decision: "rejected" },
              { id: "c3", decision: "possibly-same-as" },
              { id: "gone", decision: "merge" },
            ],
          }),
        ],
      }),
    );
    expect(a.lineup).toEqual([
      { platform: "linkedin", title: "Jana Dvořáková – Backend engineer", answer: "yes" },
      { platform: "github", title: "jdvorakova", answer: "no" },
      { platform: "instagram", title: "jana.d", answer: "not sure" },
    ]);
  });

  it("keeps call status and flags the mock provider", () => {
    const a = auditRecord(
      rows({
        calls: [
          { status: "done", provider: "mock", created_at: START, finished_at: "2026-10-08T20:10:00.000Z" },
          { status: "skipped", provider: "elevenlabs", created_at: START, finished_at: null },
        ],
      }),
    );
    expect(a.verification_calls).toEqual([
      { status: "done", mock: true, created_at: START, finished_at: "2026-10-08T20:10:00.000Z" },
      { status: "skipped", mock: false, created_at: START, finished_at: null },
    ]);
  });

  it("states the goal as purpose when no role was entered and never throws on bad ref_json", () => {
    const a = auditRecord(
      rows({
        run: { ...rows().run, role: null, goal: "due-diligence", via: "api" },
        ledger: [{ step: "serp_person", ts: START, kind: "call", cost_usd: 0, ms: 0, ref_json: "{oops" }],
      }),
    );
    expect(a.legal.purpose).toBe("Research goal: due-diligence (no role entered)");
    expect(a.run.started_via).toBe("api");
    expect(a.sources[0]).toMatchObject({ status: "empty", items: 0 });
  });
});
