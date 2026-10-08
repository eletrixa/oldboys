/**
 * Tests for the deterministic CallBrief builder.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/call-brief.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Question selection, ordering, cap, dedupe and Art. 9 filtering
 * - Script content per goal and language handling
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { ART9_DENYLIST, buildCallBrief, containsArt9Topic, MAX_CALL_QUESTIONS } from "@/domain/call-brief";
import { CallBrief } from "@/domain/call";
import type { Claim, Gap } from "@/domain/claim";
import type { Question } from "@/recipe/step";

const questions: Question[] = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({
  id,
  text: `What is ${id}?`,
}));

const gap = (question_id: string): Gap => ({ run_id: "r1", question_id, reason: "none found" });

const claim = (question_id: string, over: Partial<Claim> = {}): Claim => ({
  id: `c-${question_id}`,
  run_id: "r1",
  question_id,
  candidate_id: null,
  text: `Claim about ${question_id}`,
  kind: "INFERENCE",
  confidence: 0.9,
  quote: null,
  supports: [],
  contradicts: [],
  rank: 0,
  ...over,
});

const base = { goal: "hiring", subject: "Jane Doe", questions, gaps: [], claims: [] } as const;

describe("buildCallBrief", () => {
  it("puts the identity question first and names the subject", () => {
    const b = buildCallBrief(base);
    expect(b.identity_question).toContain("Jane Doe");
    const lines = b.script.split("\n");
    expect(lines.indexOf(b.identity_question)).toBeGreaterThan(lines.findIndex((l) => l.includes("agree")));
  });

  it("asks one question per gap in gap order", () => {
    const b = buildCallBrief({ ...base, gaps: [gap("c"), gap("a")] });
    expect(b.questions.map((q) => q.question_id)).toEqual(["c", "a"]);
    expect(b.questions[0]).toEqual({ question_id: "c", text: "What is c?", expected: "" });
  });

  it("ignores gaps without a matching recipe question", () => {
    expect(buildCallBrief({ ...base, gaps: [gap("zzz")] }).questions).toEqual([]);
  });

  it("includes low-confidence and contradicted claims, excludes confident ones", () => {
    const b = buildCallBrief({
      ...base,
      claims: [
        claim("a", { confidence: 0.3 }),
        claim("b", { contradicts: ["s1"] }),
        claim("c", { confidence: 0.6 }),
      ],
    });
    expect(b.questions.map((q) => q.question_id)).toEqual(["a", "b"]);
    expect(b.questions[0]).toMatchObject({
      text: "Can you confirm the following: Claim about a",
      expected: "Claim about a",
    });
  });

  it("caps at the maximum with gaps taking precedence", () => {
    const b = buildCallBrief({
      ...base,
      gaps: [gap("a"), gap("b"), gap("c"), gap("d")],
      claims: [claim("e", { confidence: 0.1 }), claim("f", { confidence: 0.1 })],
    });
    expect(b.questions).toHaveLength(MAX_CALL_QUESTIONS);
    expect(b.questions.map((q) => q.question_id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("excludes Art. 9 claim text", () => {
    const b = buildCallBrief({
      ...base,
      claims: [claim("a", { text: "Subject has a religious affiliation", confidence: 0.2 }), claim("b", { confidence: 0.2 })],
    });
    expect(b.questions.map((q) => q.question_id)).toEqual(["b"]);
  });

  it("excludes Art. 9 gap questions", () => {
    const b = buildCallBrief({
      ...base,
      questions: [{ id: "x", text: "What is their political view?" }, ...questions],
      gaps: [gap("x"), gap("a")],
    });
    expect(b.questions.map((q) => q.question_id)).toEqual(["a"]);
  });

  it("dedupes by question_id with the gap winning", () => {
    const b = buildCallBrief({ ...base, gaps: [gap("a")], claims: [claim("a", { confidence: 0.1 }), claim("a", { confidence: 0.2 })] });
    expect(b.questions).toEqual([{ question_id: "a", text: "What is a?", expected: "" }]);
  });

  it("writes disclosure, consent, identity and every question into the script", () => {
    const b = buildCallBrief({ ...base, gaps: [gap("a"), gap("b")] });
    expect(b.script).toContain("automated AI assistant");
    expect(b.script).toContain("Jane Doe");
    expect(b.script).toContain("This call may be recorded and transcribed. Do you agree to continue?");
    expect(b.script).toContain("If you do not agree, I will end the call now.");
    expect(b.script).toContain(b.identity_question);
    expect(b.script).toContain("1. What is a?");
    expect(b.script).toContain("2. What is b?");
    expect(b.script).toContain("Thank you. I will not ask about anything else.");
  });

  it("differs between hiring and due-diligence", () => {
    const h = buildCallBrief(base);
    const d = buildCallBrief({ ...base, goal: "due-diligence" });
    expect(h.script).toContain("for a hiring check");
    expect(d.script).toContain("for a due-diligence check");
    expect(h.identity_question).not.toBe(d.identity_question);
    expect(d.identity_question).toBe("Am I speaking with someone authorised to confirm public facts about Jane Doe?");
  });

  it("defaults language to en and honours an override", () => {
    expect(buildCallBrief(base).language).toBe("en");
    expect(buildCallBrief({ ...base, language: "cs" }).language).toBe("cs");
  });

  it("is deterministic and parses as a CallBrief", () => {
    const input = { ...base, gaps: [gap("a")], claims: [claim("b", { confidence: 0.2 })] };
    const b = buildCallBrief(input);
    expect(buildCallBrief(input)).toEqual(b);
    expect(CallBrief.parse(b)).toEqual(b);
  });
});

describe("containsArt9Topic", () => {
  it("flags English and Czech topics case-insensitively", () => {
    expect(containsArt9Topic("Their Religious beliefs")).toBe(true);
    expect(containsArt9Topic("any medical condition?")).toBe(true);
    expect(containsArt9Topic("zdravotní stav")).toBe(true);
    expect(containsArt9Topic("politické názory")).toBe(true);
    expect(containsArt9Topic("etnický původ")).toBe(true);
    expect(containsArt9Topic("sexuální orientace")).toBe(true);
    expect(containsArt9Topic("náboženství")).toBe(true);
  });

  it("passes neutral text", () => {
    expect(containsArt9Topic("What is the current role and employer?")).toBe(false);
    expect(ART9_DENYLIST.length).toBeGreaterThan(0);
  });
});
