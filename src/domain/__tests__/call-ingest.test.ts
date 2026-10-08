/**
 * Tests for call-ingest: excerpt rendering, quote matching and transcript-to-claims gating.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/call-ingest.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Pin the excerpt format, normalization and the STATEMENT / INFERENCE / gap decisions
 * - Per-question answers: answered with the time in the call, unclear, declined, no_answer, not_asked
 *
 * Design constraints:
 * - The fake llm is inline and asserts model, question ids and excerpt in the prompt
 */
import { describe, expect, it } from "vitest";
import type { CallBrief, CallResult } from "@/domain/call";
import {
  callResultToClaims,
  transcriptToExcerpt,
  type CallExtraction,
} from "@/domain/call-ingest";
import { normalizeText, quoteInExcerpt } from "@/domain/quote";
import { Claim } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";

const brief: CallBrief = {
  language: "cs",
  identity_question: "Mluvím s Janem Novákem?",
  questions: [
    { question_id: "role", text: "Jaká je vaše role?", expected: "vedoucí vývoje" },
    { question_id: "tenure", text: "Jak dlouho tam jste?", expected: "5 let" },
  ],
  script: "Dobrý den, jsem automatický asistent.",
};

const result: CallResult = {
  provider_conversation_id: "conv-1",
  outcome: "done",
  transcript: [
    { role: "agent", message: "Mluvím s Janem Novákem?", time_in_call_secs: 0.4 },
    { role: "user", message: "Ano, to jsem já.", time_in_call_secs: 3.6 },
    { role: "user", message: "Jsem vedoucí vývoje, už pět let.", time_in_call_secs: 9 },
  ],
  call_successful: true,
  identity_confirmed: null,
  duration_secs: 30,
  cost_usd: 0.1,
  failure_reason: null,
};

const excerpt = transcriptToExcerpt(result.transcript);

function extraction(over: Partial<CallExtraction> = {}): CallExtraction {
  return {
    identity_confirmed: true,
    refused: false,
    answers: [
      { question_id: "role", text: "Je vedoucí vývoje.", quote: "Jsem vedoucí vývoje", confidence: 0.9 },
    ],
    declined_question_ids: [],
    ...over,
  };
}

function fakeLlm(canned: CallExtraction): { llm: LlmCall; calls: () => number } {
  let n = 0;
  const llm: LlmCall = (input) => {
    n += 1;
    expect(input.model).toBe("primary");
    expect(input.prompt).toContain("role");
    expect(input.prompt).toContain("tenure");
    expect(input.prompt).toContain(excerpt);
    return Promise.resolve({ value: canned as never, cost_usd: 0 });
  };
  return { llm, calls: () => n };
}

const base = { brief, runId: "run-1", callId: "call-1", sourceId: "src-1" };

describe("transcriptToExcerpt", () => {
  it("renders one rounded-seconds line per turn", () => {
    expect(excerpt).toBe(
      "[0s] agent: Mluvím s Janem Novákem?\n[4s] user: Ano, to jsem já.\n[9s] user: Jsem vedoucí vývoje, už pět let.",
    );
  });
});

describe("normalizeText / quoteInExcerpt", () => {
  it("lowercases, strips punctuation, collapses whitespace, keeps diacritics", () => {
    expect(normalizeText("  Jsem   VEDOUCÍ, vývoje! ")).toBe("jsem vedoucí vývoje");
  });
  it("matches regardless of case, punctuation and whitespace", () => {
    expect(quoteInExcerpt("jsem  vedoucí vývoje", excerpt)).toBe(true);
  });
  it("does not conflate diacritics", () => {
    expect(quoteInExcerpt("jsem vedouci vyvoje", excerpt)).toBe(false);
  });
  it("rejects empty and absent quotes", () => {
    expect(quoteInExcerpt("...", excerpt)).toBe(false);
    expect(quoteInExcerpt("jsem ředitel", excerpt)).toBe(false);
  });
});

describe("callResultToClaims", () => {
  it("gaps without calling llm when the call did not complete", async () => {
    const { llm, calls } = fakeLlm(extraction());
    const out = await callResultToClaims({
      ...base,
      llm,
      result: { ...result, outcome: "no_answer" },
    });
    const notAsked = { status: "not_asked", summary: null, quote: null, at_secs: null };
    expect(out).toEqual({
      claims: [],
      gapReason: "call not completed: no_answer",
      answers: [
        { question_id: "role", question: "Jaká je vaše role?", ...notAsked },
        { question_id: "tenure", question: "Jak dlouho tam jste?", ...notAsked },
      ],
    });
    expect(calls()).toBe(0);
  });

  it("prefers failure_reason in the gap", async () => {
    const { llm } = fakeLlm(extraction());
    const out = await callResultToClaims({
      ...base,
      llm,
      result: { ...result, outcome: "failed", failure_reason: "busy" },
    });
    expect(out.gapReason).toBe("call not completed: busy");
  });

  it("gaps without calling llm when the callee never spoke", async () => {
    const { llm, calls } = fakeLlm(extraction());
    const out = await callResultToClaims({
      ...base,
      llm,
      result: { ...result, transcript: result.transcript.slice(0, 1) },
    });
    expect(out.gapReason).toBe("callee said nothing");
    expect(calls()).toBe(0);
  });

  it("gaps when the callee declined", async () => {
    const { llm } = fakeLlm(extraction({ refused: true }));
    const out = await callResultToClaims({ ...base, llm, result });
    expect(out.claims).toEqual([]);
    expect(out.gapReason).toBe("callee declined");
  });

  it("gaps when the provider says identity is not confirmed", async () => {
    const { llm } = fakeLlm(extraction());
    const out = await callResultToClaims({
      ...base,
      llm,
      result: { ...result, identity_confirmed: false },
    });
    expect(out.claims).toEqual([]);
    expect(out.gapReason).toBe("callee could not confirm identity");
  });

  it("falls back to the extractor identity when the provider has none", async () => {
    const { llm } = fakeLlm(extraction());
    const out = await callResultToClaims({ ...base, llm, result });
    expect(out.gapReason).toBeNull();
    expect(out.claims).toHaveLength(1);
  });

  it("makes a STATEMENT with quote and support when the quote is verbatim", async () => {
    const { llm } = fakeLlm(extraction());
    const [claim] = (await callResultToClaims({ ...base, llm, result })).claims;
    expect(claim).toMatchObject({
      id: "call-1:role",
      run_id: "run-1",
      kind: "STATEMENT",
      quote: "Jsem vedoucí vývoje",
      supports: ["src-1"],
      candidate_id: null,
      rank: 0,
    });
  });

  it("downgrades a paraphrase to INFERENCE with no quote and no support", async () => {
    const { llm } = fakeLlm(
      extraction({
        answers: [{ question_id: "role", text: "Vede vývoj.", quote: "vede tým vývojářů", confidence: 0.8 }],
      }),
    );
    const [claim] = (await callResultToClaims({ ...base, llm, result })).claims;
    expect(claim).toMatchObject({ kind: "INFERENCE", quote: null, supports: [] });
  });

  it("caps confidence at 0.6", async () => {
    const { llm } = fakeLlm(extraction());
    const [claim] = (await callResultToClaims({ ...base, llm, result })).claims;
    expect(claim?.confidence).toBe(0.6);
  });

  it("drops answers for unknown question ids", async () => {
    const { llm } = fakeLlm(
      extraction({
        answers: [{ question_id: "salary", text: "Hodně.", quote: "vedoucí vývoje", confidence: 0.5 }],
      }),
    );
    const out = await callResultToClaims({ ...base, llm, result });
    expect(out.claims).toEqual([]);
    expect(out.gapReason).toBe("callee gave no usable answers");
  });

  it("only emits claims that parse and are never FACT", async () => {
    const { llm } = fakeLlm(
      extraction({
        answers: [
          { question_id: "role", text: "Vedoucí.", quote: "vedoucí vývoje", confidence: 1 },
          { question_id: "tenure", text: "Pět let.", quote: "dvacet let", confidence: 0.2 },
        ],
      }),
    );
    const { claims } = await callResultToClaims({ ...base, llm, result });
    expect(claims).toHaveLength(2);
    for (const c of claims) {
      expect(Claim.safeParse(c).success).toBe(true);
      expect(c.kind).not.toBe("FACT");
    }
  });
});

describe("callResultToClaims answers", () => {
  const statuses = (answers: { status: string }[]): string[] => answers.map((a) => a.status);

  it("marks a verbatim answer answered with its quote and the time of the callee turn", async () => {
    const { llm } = fakeLlm(extraction());
    const { answers } = await callResultToClaims({ ...base, llm, result });
    expect(answers[0]).toEqual({
      question_id: "role",
      question: "Jaká je vaše role?",
      status: "answered",
      summary: "Je vedoucí vývoje.",
      quote: "Jsem vedoucí vývoje",
      at_secs: 9,
    });
    expect(answers[1]).toMatchObject({ question_id: "tenure", status: "no_answer", summary: null, quote: null, at_secs: null });
  });

  it("marks a paraphrase unclear, without a quote", async () => {
    const { llm } = fakeLlm(
      extraction({ answers: [{ question_id: "role", text: "Vede vývoj.", quote: "vede tým vývojářů", confidence: 0.8 }] }),
    );
    const { answers } = await callResultToClaims({ ...base, llm, result });
    expect(answers[0]).toMatchObject({ status: "unclear", summary: "Vede vývoj.", quote: null, at_secs: null });
  });

  it("marks a declined question declined", async () => {
    const { llm } = fakeLlm(extraction({ declined_question_ids: ["tenure"] }));
    const { answers } = await callResultToClaims({ ...base, llm, result });
    expect(statuses(answers)).toEqual(["answered", "declined"]);
  });

  it("keeps per-question answers when no answer was usable", async () => {
    const { llm } = fakeLlm(extraction({ answers: [], declined_question_ids: ["role"] }));
    const out = await callResultToClaims({ ...base, llm, result });
    expect(out.gapReason).toBe("callee gave no usable answers");
    expect(statuses(out.answers)).toEqual(["declined", "no_answer"]);
  });

  it("marks every question not asked when the callee refused or identity is not confirmed", async () => {
    const refused = await callResultToClaims({ ...base, llm: fakeLlm(extraction({ refused: true })).llm, result });
    expect(statuses(refused.answers)).toEqual(["not_asked", "not_asked"]);
    const stranger = await callResultToClaims({ ...base, llm: fakeLlm(extraction()).llm, result: { ...result, identity_confirmed: false } });
    expect(statuses(stranger.answers)).toEqual(["not_asked", "not_asked"]);
  });

  it("marks every question not asked when the call did not complete", async () => {
    const { llm } = fakeLlm(extraction());
    const out = await callResultToClaims({ ...base, llm, result: { ...result, outcome: "no_answer" } });
    expect(out.answers.map((a) => a.question_id)).toEqual(["role", "tenure"]);
    expect(statuses(out.answers)).toEqual(["not_asked", "not_asked"]);
  });
});
