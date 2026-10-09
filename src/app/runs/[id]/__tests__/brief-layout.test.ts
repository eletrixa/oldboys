/**
 * Tests for the finished brief layout helpers: plan item mapping, phone numbers, hiring steps, gap groups, timeline dates, tab counts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/brief-layout.test.ts
 * Deps:    vitest, ../brief-layout
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Phone answers attach to plan items only by question_id (mh-…, tv-<n>); interview questions never get a phone row
 * - The steps strip marks only what the state proves; the interview is never done
 * - History dates "Mon YYYY" / "YYYY" / open end parse onto a year axis; undated entries stay listed
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { CallAnswer } from "@/domain/call";
import type { Brief, Candidate, Claim, HistoryEntry } from "@/domain/claim";
import { backgroundCounts, gapGroup, gapGroups, hiringSteps, historyDate, latestAnswered, phoneNumbers, planItems, tabCounts, timelineRows } from "../brief-layout";
import type { CallView } from "../call-panel";

const claim = (over: Partial<Claim>): Claim => ({
  id: "c1", run_id: "r", question_id: "career-history", candidate_id: null, text: "Led the BI team at Acme", kind: "INFERENCE", confidence: 0.6,
  quote: null, supports: ["s1"], contradicts: [], rank: 0, ...over,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  profile: null,
  run_id: "r",
  per_question: [
    { question_id: "mh-clean", coverage: "none", claim_ids: [], summary: "" },
    { question_id: "mh-sql", coverage: "evidenced", claim_ids: ["c2"], summary: "" },
    { question_id: "mh-ref", coverage: "partial", claim_ids: [], summary: "" },
    { question_id: "career-history", coverage: "evidenced", claim_ids: ["c1", "c2"], summary: "" },
  ],
  interview_questions: ["Have you cleaned offices?"],
  to_verify: ["Led the BI team at Acme"],
  not_searched: [
    { source: "x_profile", reason: "no confirmed handle or id to look up" },
    { source: "openalex_author", reason: "request failed: api.openalex.org: HTTP 429 {\"error\":\"Rate limit exceeded\"}" },
    { source: "youtube_channel", reason: "request failed: apify streamers/youtube-scraper: run abc TIMED-OUT" },
  ],
  searched_empty: [{ source: "orcid_search", reason: "no ORCID record found" }],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
  headline: null,
  location_note: null,
  sections: [{ id: "career-history", title: "Career", summary: "", confidence: 0.8, confidence_reason: "", claim_ids: ["c1", "c2"], source_ids: ["s1"] }],
  ...over,
});

const state = {
  questions: [
    { id: "mh-clean", text: "Has done cleaning work", title: "Cleaning experience" },
    { id: "mh-sql", text: "Writes SQL" },
    { id: "mh-ref", text: "Has references" },
  ],
  claims: [claim({}), claim({ id: "c2", kind: "FACT", text: "Works at Acme", quote: "Acme" })],
  sources: [{ id: "s1", url: "https://www.linkedin.com/in/x" }],
};
const noChallenges = { challengeOf: new Map() };

const answer = (question_id: string, status: CallAnswer["status"], over: Partial<CallAnswer> = {}): CallAnswer => ({
  question_id, question: `Spoken ${question_id}?`, status, summary: null, quote: null, at_secs: null, ...over,
});

const call = (over: Partial<CallView>): CallView =>
  ({ id: "k1", status: "done", answers: [], approved_at: "2026-10-09T00:23:09Z", created_at: "2026-10-09T00:20:00Z", ...over }) as CallView;

describe("planItems", () => {
  it("lists open criteria (none first), then to-verify, then the interview questions, numbered once", () => {
    const items = planItems(state, brief(), noChallenges, null);
    expect(items.map((i) => [i.n, i.group, i.id])).toEqual([
      [1, "criteria", "mh-clean"],
      [2, "criteria", "mh-ref"],
      [3, "verify", "tv-1"],
      [4, "suggested", null],
    ]);
    expect(items[0]?.topic).toBe("Cleaning experience");
    expect(items[0]?.textId).toBe("q:mh-clean");
    expect(items[2]).toMatchObject({ topicKind: "INFERENCE", sourceHost: "linkedin.com", textId: "tv:0" });
    expect(items[3]?.textId).toBe("iq:0");
  });

  it("without a call no item has a phone row", () => {
    expect(planItems(state, brief(), noChallenges, null).every((i) => i.answer === undefined)).toBe(true);
  });

  it("attaches answers by question_id only; unmatched ids read as not asked; interview questions never get one", () => {
    const answers = [answer("mh-clean", "no_answer"), answer("tv-1", "answered", { quote: "No, I'm just a cleaner.", at_secs: 85 })];
    const items = planItems(state, brief(), noChallenges, answers);
    expect(items[0]?.answer?.status).toBe("no_answer");
    expect(items[0]?.text).toBe("Spoken mh-clean?");
    expect(items[0]?.textId).toBeNull();
    expect(items[1]?.answer).toBeNull();
    expect(items[2]?.answer?.quote).toBe("No, I'm just a cleaner.");
    expect(items[3]?.answer).toBeUndefined();
  });

  it("uses the call proposal's question text for a criterion when there is no answer", () => {
    const items = planItems(state, brief(), noChallenges, null, new Map([["mh-ref", "Can you name a reference?"]]));
    expect(items[1]?.text).toBe("Can you name a reference?");
  });
});

describe("phone and background numbers", () => {
  it("counts asked, answered and no answer; not asked never counts", () => {
    expect(phoneNumbers([answer("a", "answered"), answer("b", "no_answer"), answer("c", "not_asked"), answer("d", "unclear")])).toEqual({ asked: 3, answered: 1, noAnswer: 1, open: 2 });
    expect(phoneNumbers(null)).toBeNull();
  });

  it("latestAnswered skips drafted, failed and unread calls", () => {
    const calls = [call({ id: "new", status: "failed", answers: null }), call({ id: "read", answers: [answer("a", "answered")] }), call({ id: "old", answers: [answer("a", "answered")] })];
    expect(latestAnswered(calls)?.id).toBe("read");
    expect(latestAnswered([call({ status: "drafted" })])).toBeNull();
  });

  it("background counts shown facts and inferences and both gap lists", () => {
    expect(backgroundCounts(state.claims, brief())).toEqual({ facts: 1, inferences: 1, gaps: 4 });
  });

  it("tab counts: plan items, shown claims, asked questions (open flags unsure), gaps", () => {
    const plan = planItems(state, brief(), noChallenges, null);
    const counts = tabCounts(plan, backgroundCounts(state.claims, brief()), phoneNumbers([answer("a", "answered"), answer("b", "no_answer")]));
    expect(counts).toEqual({ plan: 4, evidence: 2, call: 2, callOpen: true, sources: 4 });
    expect(tabCounts(plan, { facts: 0, inferences: 0, gaps: 0 }, null)).toMatchObject({ call: 0, callOpen: false });
  });
});

describe("hiringSteps", () => {
  const cand = (decision: Candidate["decision"]): Candidate => ({ id: decision, run_id: "r", name: "X", profile_urls: [], anchor_match: null, score: 1, decision, platform: "linkedin", handle: null, snippet: "", reasons: [] });

  it("marks research and identity done, phone next before a call, never the interview or the decision", () => {
    const steps = hiringSteps({ created_at: "2026-10-08T21:00:00Z", candidates: [cand("merge"), cand("rejected")] }, "1 h 16 min", null);
    expect(steps.map((s) => [s.key, s.state])).toEqual([["research", "done"], ["identity", "done"], ["phone", "next"], ["interview", "todo"], ["decision", "todo"]]);
    expect(steps[0]?.detail).toBe("8 Oct · 1 h 16 min");
    expect(steps[1]?.detail).toBe("1");
  });

  it("a read call marks the phone screen done and the interview next", () => {
    const steps = hiringSteps({ created_at: "2026-10-08T21:00:00Z", candidates: [] }, "", call({}));
    expect(steps.map((s) => s.state)).toEqual(["done", "todo", "done", "next", "todo"]);
    expect(steps[2]?.detail).toBe("9 Oct");
  });
});

describe("gap groups", () => {
  it("groups by reason in plain words", () => {
    expect(gapGroup("no confirmed handle or id to look up", false)).toBe("no-handle");
    expect(gapGroup("request failed: api.stackexchange.com: HTTP 400 too many requests", false)).toBe("busy");
    expect(gapGroup("run x TIMED-OUT", false)).toBe("timeout");
    expect(gapGroup("hits found, none confirmed (same name, identity not verified)", true)).toBe("namesake");
    expect(gapGroup("no ORCID record found", true)).toBe("nothing-found");
    expect(gapGroups(brief()).map((g) => [g.group, g.rows.map((r) => r.source)])).toEqual([
      ["nothing-found", ["orcid_search"]],
      ["no-handle", ["x_profile"]],
      ["busy", ["openalex_author"]],
      ["timeout", ["youtube_channel"]],
    ]);
  });
});

describe("career timeline dates", () => {
  const entry = (from: string | null, to: string | null, title = "Role"): HistoryEntry => ({ organization: "Acme", title, from, to, kind: "job", location: "", duration: "", summary: "", evidence: [] });

  it("parses Mon YYYY, full month names and bare years", () => {
    expect(historyDate("Mar 2021")).toBeCloseTo(2021 + 2 / 12);
    expect(historyDate("December 2023")).toBeCloseTo(2023 + 11 / 12);
    expect(historyDate("2016")).toBe(2016);
    expect(historyDate("spring 2020")).toBeNull();
    expect(historyDate(null)).toBeNull();
  });

  it("puts open ends at present, sorts newest first and keeps undated entries", () => {
    const t = timelineRows([entry("2016", "2019", "Old"), entry("Dec 2023", null, "Now"), entry(null, null, "Undated"), entry("Jan 2020", "Present", "Also now")], 2026.8);
    expect(t?.rows.map((r) => r.entry.title)).toEqual(["Now", "Also now", "Old"]);
    expect(t?.rows[0]?.open).toBe(true);
    expect(t?.rows[2]?.to).toBe(2020);
    expect(t?.undated.map((e) => e.title)).toEqual(["Undated"]);
    expect(t?.start).toBe(2016);
    expect(t?.end).toBe(2027);
  });

  it("is null when no entry has dates", () => {
    expect(timelineRows([entry(null, null), entry("soon", null)], 2026)).toBeNull();
  });
});
