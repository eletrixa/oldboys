/**
 * Tests for the GDPR audit record projection of a run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/audit.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Start channel (form / extension / api), legal basis (no "informed" claim) + purpose + notice note, deletion date
 * - Collector status: ok, empty, not searched (budget skip or "not searched:" gap), failed, fallback rows
 * - Reasons are scrubbed (request URLs, e-mails, phone numbers never reach the record)
 * - started_by passes the account name through; processors read Apify / Anthropic / ElevenLabs use from ledger and calls
 * - Lineup answers map to yes / no / not sure; title kept only for "yes"; calls keep status + MOCK flag
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { auditRecord, deletionDate, LEGAL_BASIS, NOTICE_NOTE, RETENTION_DAYS, startChannel, type AuditLedgerRow, type AuditRows } from "@/domain/audit";

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
      organization_name: null,
      started_by_name: null,
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
  it("names the recruiter's organization in the purpose and run when known", () => {
    const a = auditRecord({ ...rows(), run: { ...rows().run, organization_name: "Acme s.r.o." } });
    expect(a.legal.purpose).toBe("Pre-employment screening by Acme s.r.o. for the role: Senior backend engineer");
    expect(a.run.organization).toBe("Acme s.r.o.");
  });

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
      organization: null,
      started_by: null,
    });
    expect(a.legal).toEqual({ basis: LEGAL_BASIS, purpose: "Pre-employment screening for the role: Senior backend engineer", notice: NOTICE_NOTE });
    expect(a.legal.basis).not.toContain("informed");
    expect(a.legal.notice).toContain("Not recorded by this tool");
    expect(a.retention).toEqual({ days: 7, delete_after: "2026-10-15T20:00:00.000Z", note: "Earlier deletion on request (done by hand; no automatic delete on rejection yet)." });
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

  it("maps the last lineup answer to yes / no / not sure and keeps the title only for yes", () => {
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
      { platform: "github", title: null, answer: "no" },
      { platform: "instagram", title: null, answer: "not sure" },
    ]);
  });

  it("scrubs request URLs, e-mails and phone numbers out of every reason", () => {
    const openAlexFailure =
      'not searched: request failed: https://api.openalex.org/authors?search=Jan%20Novak&per-page=5&mailto=robert@soulfire.cz: HTTP 429 {"error":"Too Many Requests"}';
    const failed = auditRecord(
      rows({
        run: { ...rows().run, status: "failed" },
        ledger: [
          row("serp_person", "call", { sources: 0, calls: 1 }),
          row("resolve_lineup", "llm", { calls: 1 }),
          row("run", "decision", { failed: true, reason: "call to +420 777 123 456 failed" }),
        ],
        gaps: [{ question_id: "serp_person", reason: openAlexFailure }],
      }),
    );
    expect(failed.sources.map((s) => [s.step, s.status, s.reason])).toEqual([
      ["serp_person", "not searched", 'request failed: api.openalex.org: HTTP 429 {"error":"Too Many Requests"}'],
      ["github_profile", "failed", "call to (number) failed"],
      ["x_profile", "not searched", "run stopped before this step"],
    ]);
    const skipped = auditRecord(rows({ ledger: [row("x_profile", "decision", { skipped: "see https://x.com/jana?ref=a, ask hr@example.com" })] }));
    expect(skipped.sources.find((s) => s.step === "x_profile")?.reason).toBe("see x.com, ask (email)");
    const json = JSON.stringify([failed, skipped]);
    for (const leak of ["robert@soulfire.cz", "mailto", "search=", "Jan%20Novak", "777 123 456", "hr@example.com"]) expect(json).not.toContain(leak);
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

  it("passes the starter's account name through and keeps null when absent", () => {
    expect(auditRecord({ ...rows(), run: { ...rows().run, started_by_name: "Test Recruiter" } }).run.started_by).toBe("Test Recruiter");
    expect(auditRecord(rows()).run.started_by).toBeNull();
  });
});

describe("processors", () => {
  const used = (r: AuditRows): Record<string, boolean> => Object.fromEntries(auditRecord(r).processors.map((p) => [p.name, p.used]));

  it("always lists the four services in order, Cloudflare always used", () => {
    const a = auditRecord(rows());
    expect(a.processors.map((p) => p.name)).toEqual(["Cloudflare", "Apify", "Anthropic", "ElevenLabs"]);
    expect(used(rows())).toEqual({ Cloudflare: true, Apify: false, Anthropic: false, ElevenLabs: false });
  });

  it("marks Apify used for an apify/ or harvestapi/ actor call, not for rest/ or ares/ only", () => {
    expect(used(rows({ ledger: [row("serp_person", "call", { actor: "apify/google-search-scraper", sources: 1 })] })).Apify).toBe(true);
    expect(used(rows({ ledger: [row("seed_profile", "call", { actor: "harvestapi/linkedin-profile-scraper", calls: 1 })] })).Apify).toBe(true);
    const free = rows({
      ledger: [row("github_profile", "call", { actor: "rest/github", sources: 2 }), row("ares", "call", { actor: "ares/ekonomicke-subjekty-vr", sources: 1 })],
    });
    expect(used(free).Apify).toBe(false);
    expect(used(rows({ ledger: [row("x_profile", "call", { actor: null, sources: 0 })] })).Apify).toBe(false);
  });

  it("marks Anthropic used with the model call count, or notes no successful call", () => {
    const ok = auditRecord(rows({ ledger: [row("synthesize_report", "llm", { calls: 2 }), row("resolve_lineup", "llm", { calls: 1 })] }));
    expect(ok.processors[2]).toEqual({ name: "Anthropic", role: "AI model", used: true, note: "3 model calls" });
    const none = auditRecord(rows({ ledger: [row("synthesize_report", "llm", { calls: 0 })] }));
    expect(none.processors[2]).toMatchObject({ used: true, note: "AI steps ran, no successful model call" });
  });

  it("marks ElevenLabs used only for live calls; mock calls are noted, not used", () => {
    const call = { status: "done", created_at: START, finished_at: null };
    const live = auditRecord(rows({ calls: [{ ...call, provider: "elevenlabs" }, { ...call, provider: "mock" }] }));
    expect(live.processors[3]).toMatchObject({ name: "ElevenLabs", used: true, note: "1 call" });
    const mock = auditRecord(rows({ calls: [{ ...call, provider: "mock" }] }));
    expect(mock.processors[3]).toMatchObject({ used: false, note: "mock calls only" });
  });

  it("never throws on malformed ref_json", () => {
    const bad = rows({ ledger: [{ step: "serp_person", ts: START, kind: "call", cost_usd: 0, ms: 0, ref_json: "{oops" }, { step: "x", ts: START, kind: "llm", cost_usd: 0, ms: 0, ref_json: "[" }] });
    expect(used(bad)).toEqual({ Cloudflare: true, Apify: false, Anthropic: true, ElevenLabs: false });
  });

  it("never carries an e-mail address", () => {
    const a = auditRecord(
      rows({
        run: { ...rows().run, started_by_name: "Test Recruiter", organization_name: "Acme s.r.o." },
        ledger: [row("serp_person", "call", { actor: "apify/google-search-scraper", sources: 1 }), row("synthesize_report", "llm", { calls: 1 })],
        calls: [{ status: "done", provider: "elevenlabs", created_at: START, finished_at: null }],
      }),
    );
    expect(JSON.stringify(a)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
