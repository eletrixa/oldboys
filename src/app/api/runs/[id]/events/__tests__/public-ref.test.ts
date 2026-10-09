/**
 * Tests for publicRef: the open ledger stream sends only whitelisted, scrubbed process facts of each ledger ref.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/events/__tests__/public-ref.test.ts
 * Deps:    vitest, src/app/api/runs/[id]/events/public-ref
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Refs shaped like the real writers (research-run, verification-call, call routes, webhook, translate) keep their
 *   counts, labels and flags and lose notes, seed profile fields, lineup candidate details and decision ids
 * - Gap and failure reasons are scrubbed; on call steps provider failure text is dropped entirely
 * - Malformed refs give null or {} without throwing; no seeded e-mail, phone number or snippet survives
 *
 * Design constraints:
 * - Pure function under test, no fakes
 */
import { describe, expect, it } from "vitest";
import { publicRef } from "../public-ref";

const OPENALEX_URL = "https://api.openalex.org/authors?search=Jan%20Novak&per-page=5&mailto=robert@soulfire.cz";
const OPENALEX = `request failed: ${OPENALEX_URL}: HTTP 429 {"error":"rate limited"}`;
const CLAIM_FRAGMENT = "Jan Novak led the Kafka migration at Acme";
const SNIPPET = "Jan Novak, the pastry chef from Brno, wins the regional cake award.";
const PHONE = "+420 777 123 456";
const EMAIL = "jan.novak@example.cz";

/** Whatever publicRef returns must not carry any of these, at any depth. */
const SEEDED = [EMAIL, "robert@soulfire.cz", "mailto", "search=", "Jan%20Novak", "Jan Novak", "Novak", PHONE, "777 123 456", SNIPPET, "pastry", CLAIM_FRAGMENT, "Kafka", "cand-", "Acme"];

function expectClean(result: unknown): void {
  const json = JSON.stringify(result);
  for (const seeded of SEEDED) expect(json).not.toContain(seeded);
}

describe("publicRef", () => {
  it("collector row: notes gone, counts, actor and flags kept", () => {
    const ref = {
      actor: "apify/google-search-scraper",
      sources: 3,
      candidates: 0,
      claims: 2,
      brief: false,
      calls: 1,
      empty: false,
      notes: [`kept: "${CLAIM_FRAGMENT}"`, `request failed: ${OPENALEX_URL}: HTTP 429`],
    };
    const out = publicRef("openalex_works", ref);
    expect(out).toEqual({ actor: "apify/google-search-scraper", sources: 3, candidates: 0, claims: 2, brief: false, calls: 1, empty: false });
    expectClean(out);
  });

  it("collector row without an actor (null) and with the devil's advocate record keeps only the challenge counts", () => {
    const ref = {
      actor: null, sources: 0, candidates: 0, claims: 9, brief: false, calls: 1, empty: false, notes: [],
      challenge: { checked: 4, held: 3, challenges: [{ claim_id: "c-1", ground: "someone-else", why: `${SNIPPET} is another person` }] },
    };
    const out = publicRef("verify", ref);
    expect(out).toEqual({ sources: 0, candidates: 0, claims: 9, brief: false, calls: 1, empty: false, challenge: { checked: 4, held: 3 } });
    expectClean(out);
  });

  it("seed row: subject, anchor, headline, employer and notes gone", () => {
    const ref = {
      subject: "Jan Novak", anchor: "Brno", headline: "Data engineer at Acme, ex-Meta", employer: "Acme",
      sources: 1, candidates: 1, notes: [`profile ${EMAIL}`], actor: "harvestapi/linkedin-profile-scraper", calls: 1,
    };
    const out = publicRef("seed_profile", ref);
    expect(out).toEqual({ sources: 1, candidates: 1, actor: "harvestapi/linkedin-profile-scraper", calls: 1 });
    expectClean(out);
  });

  it("resolve row with namesake candidates: only the number of candidates", () => {
    const ref = {
      candidates: [
        { id: "cand-1", platform: "linkedin", url: "https://www.linkedin.com/in/jan-novak-acme", score: 0.92, decision: "merge", snippet: "Jan Novak · Data engineer at Acme", reasons: ["same employer"] },
        { id: "cand-2", platform: "web", url: "https://brno-cakes.cz/jan-novak", score: 0.1, decision: "rejected", snippet: SNIPPET, reasons: ["different city trade"] },
      ],
      calls: 1,
      notes: ["2 hits"],
      ask: true,
    };
    const out = publicRef("resolve", ref);
    expect(out).toEqual({ candidates: 2, calls: 1, ask: true });
    expectClean(out);
  });

  it("lineup decision row: counts per decision, never candidate ids", () => {
    const ref = { decisions: [{ id: "cand-1", decision: "merge" }, { id: "cand-2", decision: "rejected" }, { id: "cand-3", decision: "rejected" }] };
    const out = publicRef("resolve", ref);
    expect(out).toEqual({ decisions: { merge: 1, rejected: 2 } });
    expectClean(out);
  });

  it("decisions with an unknown value are dropped as a whole", () => {
    expect(publicRef("resolve", { decisions: [{ id: "cand-1", decision: "maybe" }] })).toEqual({});
  });

  it("gap row with the OpenAlex reason: host only, no mailto, e-mail or query", () => {
    const out = publicRef("openalex_works", { gap: true, reason: `not searched: ${OPENALEX}` });
    expect(out).toEqual({ gap: true, reason: "not searched: request failed: api.openalex.org: HTTP 429 {\"error\":\"rate limited\"}" });
    const reason = JSON.stringify(out?.reason);
    expect(reason).not.toContain("mailto");
    expect(reason).not.toContain("@");
    expect(reason).not.toContain("search=");
    expectClean(out);
  });

  it("budget skip row keeps the scrubbed reason and the spent numbers", () => {
    const out = publicRef("github_repos", { skipped: "run budget reached", spent: { usd: 0.41, calls: 16, note: EMAIL } });
    expect(out).toEqual({ skipped: "run budget reached", spent: { usd: 0.41, calls: 16 } });
  });

  it("fallback, pause and degraded rows keep their labels", () => {
    expect(publicRef("linkedin", { onEmpty: "fallback", fallbackStep: "serp_people" })).toEqual({ onEmpty: "fallback", fallbackStep: "serp_people" });
    expect(publicRef("resolve", { waitingFor: "lineup-answer" })).toEqual({ waitingFor: "lineup-answer" });
    expect(publicRef("synthesize", { degraded: `model failed for ${EMAIL}` })).toEqual({ degraded: "model failed for (email)" });
  });

  it("run failure row: scrubbed reason", () => {
    const out = publicRef("run", { failed: true, reason: `fetch ${OPENALEX_URL} failed, call ${PHONE}` });
    expect(out).toEqual({ failed: true, reason: "fetch api.openalex.org failed, call (number)" });
    expectClean(out);
  });

  it("role questions row: count, calls and template id; notes gone", () => {
    const out = publicRef("role_questions", { questions: 6, calls: 1, notes: [`role for ${EMAIL}`], template: "data-engineer" });
    expect(out).toEqual({ questions: 6, calls: 1, template: "data-engineer" });
    expectClean(out);
  });

  it("call failure rows: no reason text at all, flags kept", () => {
    const dial = publicRef("call:dial", { type: "phone", callId: "call-1", failed: true, reason: `ElevenLabs 422: invalid number ${PHONE} for ${EMAIL}` });
    expect(dial).toEqual({ type: "phone", callId: "call-1", failed: true });
    const fail = publicRef("call:fail", { type: "phone", callId: "call-1", failed: true, reason: `provider said ${PHONE}` });
    expect(fail).toEqual({ type: "phone", callId: "call-1", failed: true });
    expectClean([dial, fail]);
  });

  it("call finish and extract rows: gap text becomes a flag, answers become a count", () => {
    const finish = publicRef("call:finish", {
      type: "phone", callId: "call-1", provider: "elevenlabs", mock: false, claims: 2, gap: `callee gave ${PHONE} instead`,
      answers: [{ question_id: "q-1", status: "answered", text: CLAIM_FRAGMENT }],
    });
    expect(finish).toEqual({ type: "phone", callId: "call-1", provider: "elevenlabs", mock: false, claims: 2, gap: true, answers: 1 });
    const extract = publicRef("call:extract", { type: "phone", callId: "call-1", claims: 0, gap: null, calls: 1 });
    expect(extract).toEqual({ type: "phone", callId: "call-1", claims: 0, calls: 1 });
    expectClean([finish, extract]);
  });

  it("call dial, skip and webhook rows keep their process facts", () => {
    expect(publicRef("call:dial", { type: "phone", callId: "call-1", provider: "mock", mock: true, questions: 3 }))
      .toEqual({ type: "phone", callId: "call-1", provider: "mock", mock: true, questions: 3 });
    expect(publicRef("call:skip", { type: "phone", callId: "call-1", skipped: true })).toEqual({ type: "phone", callId: "call-1", skipped: true });
    expect(publicRef("call:webhook", { type: "phone", callId: "call-1", event: "post_call_transcription", outcome: "completed" }))
      .toEqual({ type: "phone", callId: "call-1", event: "post_call_transcription", outcome: "completed" });
  });

  it("translate row keeps its counts", () => {
    expect(publicRef("translate", { translate: "cs", texts: 40, translated: 38, calls: 1 })).toEqual({ translate: "cs", texts: 40, translated: 38, calls: 1 });
  });

  it("unknown keys and wrong types are dropped", () => {
    const out = publicRef("verify", { url: OPENALEX_URL, email: EMAIL, snippet: SNIPPET, sources: -1, calls: "3", empty: "yes", actor: 7, spent: "lots" });
    expect(out).toEqual({});
  });

  it("malformed refs give null or {} without throwing", () => {
    expect(publicRef("verify", null)).toBeNull();
    expect(publicRef("verify", undefined)).toBeNull();
    expect(publicRef("verify", [1, 2])).toBeNull();
    expect(publicRef("verify", "notes")).toBeNull();
    expect(publicRef("verify", 42)).toBeNull();
    expect(publicRef("verify", {})).toEqual({});
    expect(publicRef("resolve", { decisions: "merge", challenge: [1], spent: null })).toEqual({});
  });
});
