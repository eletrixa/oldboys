/**
 * Tests for the pure helpers in calls.ts: row mapping, R2 key, source URL, provider selection.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/calls.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Pin the 0/1 <-> boolean mapping and the mock-unless-fully-configured provider rule
 *
 * Design constraints:
 * - No D1, R2 or network: only pure functions
 */
import { describe, expect, it } from "vitest";
import {
  applyCallEvent,
  callResultR2Key,
  callSourceUrl,
  providerFor,
  rowToCall,
  selectCallProvider,
  type CallRow,
} from "@/workflow/calls";

const brief = {
  language: "cs",
  identity_question: "Are you Jan Novak?",
  questions: [{ question_id: "q1", text: "Do you run Acme?", expected: "yes" }],
  script: "Hello",
};

const row: CallRow = {
  id: "c1",
  run_id: "r1",
  status: "done",
  provider: "mock",
  provider_conversation_id: "mock-c1",
  to_number_masked: "+420*****123",
  consent_ack: 1,
  consent_note: null,
  operator: null,
  brief_json: JSON.stringify(brief),
  result_r2_key: null,
  call_successful: 0,
  identity_confirmed: null,
  duration_secs: 12,
  cost_usd: 0,
  failure_reason: null,
  last_error: null,
  created_at: "2026-01-01T00:00:00Z",
  approved_at: null,
  finished_at: null,
};

describe("rowToCall", () => {
  it("maps 0/1 to booleans, keeps null, and parses brief_json", () => {
    const call = rowToCall(row);
    expect(call.consent_ack).toBe(true);
    expect(call.call_successful).toBe(false);
    expect(call.identity_confirmed).toBeNull();
    expect(call.brief.questions[0]?.question_id).toBe("q1");
  });
});

describe("keys and urls", () => {
  it("builds the R2 key", () => {
    expect(callResultR2Key("r1", "c1")).toBe("r1/src-call-c1.json");
  });
  it("builds the source URL per provider", () => {
    expect(callSourceUrl("elevenlabs", "abc")).toBe("https://elevenlabs.io/app/conversational-ai/history/abc");
    expect(callSourceUrl("mock", "abc")).toBe("https://mock.invalid/call/abc");
  });
});

describe("selectCallProvider / providerFor", () => {
  const full = {
    CALL_PROVIDER: "elevenlabs",
    ELEVENLABS_API_KEY: "k",
    ELEVENLABS_AGENT_ID: "a",
    ELEVENLABS_PHONE_NUMBER_ID: "p",
  };
  it("is mock when CALL_PROVIDER is unset", () => {
    expect(selectCallProvider({})).toBe("mock");
  });
  it("is mock when elevenlabs is requested but a field is empty", () => {
    expect(selectCallProvider({ ...full, ELEVENLABS_AGENT_ID: "" })).toBe("mock");
  });
  it("is elevenlabs when fully configured", () => {
    expect(selectCallProvider(full)).toBe("elevenlabs");
  });
  it("providerFor never downgrades a stored elevenlabs call to mock", () => {
    expect(() => providerFor("elevenlabs", {})).toThrow(/ELEVENLABS_API_KEY/);
    expect(typeof providerFor("elevenlabs", full).placeCall).toBe("function");
  });
  it("providerFor mock resolves no result when polled", async () => {
    await expect(providerFor("mock", {}).fetchResult("x")).resolves.toBeNull();
  });
});

describe("applyCallEvent", () => {
  type Prepared = { sql: string; binds: unknown[] };
  const fakeDb = (): { db: D1Database; prepared: Prepared[] } => {
    const prepared: Prepared[] = [];
    const db = {
      prepare(sql: string) {
        const stmt: Prepared = { sql, binds: [] };
        prepared.push(stmt);
        return { bind: (...binds: unknown[]) => ((stmt.binds = binds), stmt) };
      },
    } as unknown as D1Database;
    return { db, prepared };
  };

  it("guards the UPDATE with the allowed from-states of the event", () => {
    const { db, prepared } = fakeDb();
    applyCallEvent(db, "c1", { type: "approve" }, { consent_ack: 1, operator: "robert" });
    const stmt = prepared[0];
    expect(stmt?.sql).toBe(
      "UPDATE calls SET status = ?, consent_ack = ?, operator = ? WHERE id = ? AND status IN (?)",
    );
    expect(stmt?.binds).toEqual(["dialing", 1, "robert", "c1", "drafted"]);
  });

  it("appends an extra WHERE clause and its binds after the status list", () => {
    const { db, prepared } = fakeDb();
    applyCallEvent(db, "c1", { type: "result", outcome: "refused" }, {}, { sql: " AND x = ?", binds: [7] });
    expect(prepared[0]?.sql).toBe("UPDATE calls SET status = ? WHERE id = ? AND status IN (?) AND x = ?");
    expect(prepared[0]?.binds).toEqual(["refused", "c1", "dialing", 7]);
  });
});
