/**
 * Tests for the confidence composer: the verified share from the brief's claims, the identity line from the lineup, one
 * row per check, every degraded and empty state, and the wording guard.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/trust-box.test.ts
 * Deps:    vitest, src/domain/challenge (JUDGEMENT)
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - null without a brief; pct null with AI off or no claims, with a reason
 * - Evidence: FACT share over the claims the brief shows, kinds counted, sources by origin, the devil's advocate line
 * - Identity: confirmed / open / none with counts, the supplied flag and the distinct confirmation reasons
 * - Checks: registries (records, namesakes, unavailable, name-only ask), CV (differences ask), accounts (first ask), empty, not searched;
 *   rows absent when the run has no such check
 * - Every sentence passes the JUDGEMENT guard
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import { JUDGEMENT } from "@/domain/challenge";
import type { Brief, Candidate, Claim } from "@/domain/claim";
import type { RunState } from "../state";
import { evidenceLabel, matchReasons, sourcesLabel, type TrustBox, trustBox } from "../trust-box";

/** The box of a run with a brief (every fixture here has one). */
const boxOf = (s: RunState): TrustBox => trustBox(s) ?? { evidence: { pct: null, facts: -1, inferences: -1, statements: -1, sources: { total: -1, independent: -1, own: -1, mirror: -1 }, challenge: null, unavailable: "missing" }, identity: { status: "none", label: "", counts: "", theirs: -1, awaiting: -1, others: -1, supplied: false, reasons: [] }, checks: [] };

const claim = (id: string, kind: Claim["kind"], over: Partial<Claim> = {}): Claim => ({
  id,
  run_id: "r",
  question_id: "q1",
  candidate_id: null,
  text: `Finding ${id}`,
  kind,
  confidence: 0.8,
  quote: kind === "INFERENCE" ? null : "quote",
  supports: ["s-li"],
  contradicts: [],
  rank: 0,
  ...over,
});

const candidate = (id: string, decision: Candidate["decision"], over: Partial<Candidate> = {}): Candidate => ({
  id,
  run_id: "r",
  name: "Jan Novák",
  profile_urls: [`https://www.linkedin.com/in/${id}`],
  anchor_match: null,
  score: 0.8,
  decision,
  platform: "linkedin",
  handle: id,
  snippet: "",
  reasons: ["Same name, mentions Brno"],
  ...over,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [
    { question_id: "q1", coverage: "evidenced", claim_ids: ["f1", "f2", "f3", "i1", "st1"], summary: "" },
    { question_id: "cv-consistency", coverage: "evidenced", claim_ids: ["cv1", "cv2"], summary: "" },
  ],
  interview_questions: [],
  to_verify: [],
  not_searched: [{ source: "x_profile", reason: "no handle" }],
  searched_empty: [{ source: "github_profile", reason: "none" }, { source: "cv-consistency", reason: "n/a" }],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [{ step: "serp", url: "https://www.instagram.com/someone", excerpt: "Another Jan Novak, fake account" }],
  headline: null,
  location_note: null,
  sections: [],
  profile: null,
  ...over,
});

const state = (over: Partial<RunState> = {}): RunState => ({
  id: "r",
  subject: "Jan Novák",
  headline: null,
  role: "Data Engineer",
  organization_name: null,
  created_at: "2026-10-09T00:00:00Z",
  status: "done",
  step: null,
  mentions: 3,
  candidates: [candidate("jnovak", "merge", { reasons: ["Profile link you supplied"] }), candidate("jnovak2", "possibly-same-as"), candidate("other", "rejected")],
  claims: [
    claim("f1", "FACT"),
    claim("f2", "FACT", { supports: ["s-press"] }),
    claim("f3", "FACT"),
    claim("i1", "INFERENCE"),
    claim("st1", "STATEMENT"),
    claim("cv1", "FACT", { question_id: "cv-consistency", supports: ["cv:r", "s-li"] }),
    claim("cv2", "INFERENCE", { question_id: "cv-consistency", supports: ["cv:r", "s-li"] }),
    claim("hidden", "INFERENCE"),
  ],
  sources: [
    { id: "s-li", url: "https://www.linkedin.com/in/jnovak", identity_reason: "name and employer match (Snuggs)" },
    { id: "s-press", url: "https://www.forbes.cz/jan-novak", identity_reason: "name and employer match (Snuggs)" },
    { id: "s-mirror", url: "https://rocketreach.co/jan-novak" },
    { id: "cv:r", url: "cv:r" },
  ],
  challenge_summary: { checked: 3, held: 2, moved: 1 },
  registry_checks: {
    subject: "Jan Novák",
    role: "Data Engineer",
    checks: [
      { registry: "isir", status: "clear", searched: "Jan Novák", source_url: "https://isir.justice.cz", hits: [], namesakes: 0, total: null, note: null },
      { registry: "ares", status: "hits", searched: "Jan Novák", source_url: "https://ares.gov.cz", hits: [{ label: "Jan Novák, Brno", url: "https://ares.gov.cz/r/1", status: null, born: null, match: "city: Brno" }], namesakes: 2, total: null, note: null },
      { registry: "police", status: "unavailable", searched: "Jan Novák", source_url: "https://policie.cz", hits: [], namesakes: 0, total: null, note: "timeout" },
    ],
  },
  profile_signals: {
    signals: [
      { id: "forks-only", platform: "github", profile_url: "https://github.com/jnovak", text: "All 4 public repositories are forks.", source_url: "https://github.com/jnovak", ask: "Which of these did you build yourself?" },
      { id: "linkedin-verified", platform: "linkedin", profile_url: "https://www.linkedin.com/in/jnovak", text: "LinkedIn shows a verification badge.", source_url: "https://www.linkedin.com/in/jnovak", ask: null },
    ],
    not_checked: [],
    checked: ["github", "linkedin"],
  },
  questions: [],
  brief: brief(),
  failure: null,
  failed_step: null,
  step_index: 9,
  step_count: 9,
  cost: { usd: 0.1, source_calls: 3, llm_calls: 2, duration_ms: 1000 },
  intake: null,
  ...over,
});

describe("trustBox", () => {
  it("is null without a brief", () => {
    expect(trustBox(state({ brief: null }))).toBeNull();
  });

  it("measures the verified share over the claims the brief shows, counts kinds and sources by origin", () => {
    const e = boxOf(state()).evidence;
    // 7 shown claims (the hidden one is not in the brief): 4 FACT, 2 INFERENCE, 1 STATEMENT.
    expect(e.facts).toBe(4);
    expect(e.inferences).toBe(2);
    expect(e.statements).toBe(1);
    expect(e.pct).toBe(57);
    expect(e.sources).toEqual({ total: 4, independent: 1, own: 2, mirror: 1 });
    expect(e.challenge).toBe("Devil's advocate: checked 3 findings, 2 held, 1 moved to the interview");
    expect(e.unavailable).toBeNull();
    expect(evidenceLabel(e)).toBe("4 facts, 2 inferences, 1 statement");
    expect(sourcesLabel(e.sources)).toBe("4 sources: 1 independent, 2 own profiles, 1 directory copy");
  });

  it("shows no figure when AI was off or there are no findings, and says why", () => {
    const off = trustBox(state({ brief: brief({ degraded: "model unavailable" }) }));
    expect(off?.evidence.pct).toBeNull();
    expect(off?.evidence.unavailable).toContain("AI was off");
    const none = boxOf(state({ claims: [] })).evidence;
    expect(none.pct).toBeNull();
    expect(none.unavailable).toBe("The brief has no findings to measure.");
    expect(evidenceLabel(none)).toBe("0 facts, 0 inferences");
    expect(sourcesLabel({ total: 0, independent: 0, own: 0, mirror: 0 })).toBe("No source was kept.");
    expect(trustBox(state({ challenge_summary: null }))?.evidence.challenge).toBeNull();
  });

  it("counts every claim of a brief stored without claim ids", () => {
    const old = brief({ per_question: [{ question_id: "q1", coverage: "evidenced", claim_ids: [], summary: "" }], sections: [] });
    expect(trustBox(state({ brief: old }))?.evidence.facts).toBe(4);
  });

  it("reads the identity line from the lineup", () => {
    const i = trustBox(state())?.identity;
    expect(i?.status).toBe("confirmed");
    expect(i?.label).toBe("Identity matched");
    expect(i?.counts).toBe("1 account matched · 1 waiting for your answer · 1 ruled out");
    expect(i?.supplied).toBe(true);
    expect(i?.reasons).toEqual(["name and employer (Snuggs)"]);

    const open = trustBox(state({ candidates: [candidate("a", "possibly-same-as"), candidate("b", "possibly-same-as")], sources: [] }))?.identity;
    expect(open?.status).toBe("open");
    expect(open?.label).toBe("Identity not yet confirmed");
    expect(open?.counts).toBe("2 waiting for your answer");
    expect(open?.supplied).toBe(false);
    expect(open?.reasons).toEqual([]);

    const none = trustBox(state({ candidates: [], sources: [] }))?.identity;
    expect(none?.status).toBe("none");
    expect(none?.counts).toBe("No public account was found under this name.");
    expect(trustBox(state({ candidates: [candidate("x", "rejected")] }))?.identity.counts).toBe("1 ruled out");
    // The seed step's wording for the given profile counts as supplied too.
    expect(trustBox(state({ candidates: [candidate("g", "merge", { reasons: ["profile given by the manager"] })] }))?.identity.supplied).toBe(true);
  });

  it("folds match reasons by basis", () => {
    const reasons = matchReasons([
      { identity_reason: "name and employer match (Revolt)" },
      { identity_reason: "name and employer match (Naveky)" },
      { identity_reason: "name and employer match (Revolt)" },
      { identity_reason: "cross-link from the given profile" },
      { identity_reason: null },
      {},
    ]);
    expect(reasons).toEqual(["name and employer (Revolt, Naveky)", "cross-link from the given profile"]);
  });

  it("lists one row per check with counts, the open point and links", () => {
    const rows = trustBox(state())?.checks ?? [];
    expect(rows.map((r) => r.id)).toEqual(["registries", "cv", "accounts", "empty", "not-searched"]);
    const [reg, cv, acc, empty, missing] = rows;
    expect(reg?.text).toBe("3 registries searched by name: 1 no record, 1 record under the name, 2 namesakes left out, 1 not available.");
    expect(reg?.ask).toBe("Check: ARES business records, matched by city or company; confirm at the interview.");
    expect(reg?.open).toBe(1);
    expect(reg?.urls).toEqual(["https://ares.gov.cz/r/1"]);
    expect(cv?.text).toBe("1 statement matches the public record, 1 differs.");
    expect(cv?.ask).toContain("Ask: about the 1 difference");
    expect(cv?.open).toBe(1);
    expect(acc?.text).toBe("2 accounts read (GitHub, LinkedIn): 2 account signals, 1 question for the interview.");
    expect(acc?.ask).toBe("Ask: Which of these did you build yourself?");
    expect(acc?.urls).toEqual(["https://github.com/jnovak"]);
    // The CV row of searched_empty is the CV check itself, not a source.
    expect(empty?.text).toBe("1 source answered with nothing for this person: GitHub.");
    expect(empty?.open).toBe(0);
    expect(missing?.text).toBe("1 source not searched: X.");
    expect(missing?.open).toBe(0);
  });

  it("asks for a hand check when a registry record matched by name only", () => {
    const s = state();
    const checks = s.registry_checks?.checks.map((c) => (c.status === "hits" ? { ...c, hits: c.hits.map((h) => ({ ...h, match: null })) } : c)) ?? [];
    const reg = trustBox({ ...s, registry_checks: { subject: "Jan Novák", role: null, checks } })?.checks[0];
    expect(reg?.ask).toContain("matched by name only, a namesake is possible");
  });

  it("leaves out rows the run did not make", () => {
    const bare = trustBox(
      state({
        registry_checks: null,
        profile_signals: null,
        claims: [claim("f1", "FACT")],
        brief: brief({ per_question: [{ question_id: "q1", coverage: "evidenced", claim_ids: ["f1"], summary: "" }], not_searched: [], searched_empty: [] }),
      }),
    );
    expect(bare?.checks).toEqual([]);
    expect(bare?.evidence.pct).toBe(100);
    // Signals computed but no account read and nothing found: no row either.
    expect(trustBox(state({ profile_signals: { signals: [], not_checked: ["x"], checked: [] } }))?.checks.some((r) => r.id === "accounts")).toBe(false);
    // A clear registry sweep still gets its row, with nothing open.
    const clear = trustBox(state({ registry_checks: { subject: "J", role: null, checks: [{ registry: "isir", status: "clear", searched: "J", source_url: "https://isir.justice.cz", hits: [], namesakes: 0, total: null, note: null }] } }))?.checks[0];
    expect(clear?.text).toBe("1 registry searched by name: 1 no record.");
    expect(clear?.ask).toBeNull();
  });

  it("never judges the person and never repeats also_found", () => {
    const box = trustBox(state());
    const texts = [box?.identity.label, box?.identity.counts, ...(box?.identity.reasons ?? []), ...(box?.checks ?? []).flatMap((c) => [c.text, c.ask ?? ""])];
    for (const t of texts) expect(t ?? "").not.toMatch(JUDGEMENT);
    expect(JSON.stringify(box)).not.toContain("instagram.com/someone");
  });
});
