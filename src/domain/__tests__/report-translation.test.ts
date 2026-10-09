/**
 * Tests for the report translation rules (idea #24): hash, cache key, budget estimate, prompt and merge.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/report-translation.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - textsHash is stable and changes with any id or text
 * - translationBatches: char budget, max texts, a text never split, order kept
 * - estimateTranslateUsd: a ~60-text brief fits the cap with the system prompt counted per batch
 * - failedCallCost: reads `cost_usd` off a failed call's error, 0 otherwise
 * - mergeTranslation: missing, unknown, duplicate and empty ids fall back; a new Art. 9 topic falls back; an Art. 9
 *   topic already in the English source is kept
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  TRANSLATE_BATCH_CHARS,
  TRANSLATE_BATCH_TEXTS,
  TRANSLATE_BUDGET_USD,
  estimateTranslateUsd,
  failedCallCost,
  mergeTranslation,
  textsHash,
  translatePrompt,
  translationBatches,
  translationKey,
  translationKeys,
} from "../report-translation";

const TEXTS = [
  { id: "c:1", text: "Maintains the open-source library acme-ui." },
  { id: "iq:0", text: "Ask about the migration to React 19." },
];

describe("textsHash", () => {
  it("is stable for the same texts and changes with a text or an id", async () => {
    const a = await textsHash(TEXTS);
    expect(await textsHash(TEXTS.map((t) => ({ ...t })))).toBe(a);
    expect(await textsHash([TEXTS[0] ?? { id: "", text: "" }, { id: "iq:0", text: "Ask about React 18." }])).not.toBe(a);
    expect(await textsHash([TEXTS[0] ?? { id: "", text: "" }, { id: "iq:1", text: "Ask about the migration to React 19." }])).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("translationKey", () => {
  it("is deterministic per run and language, outside the source keys", () => {
    expect(translationKey("run-1", "cs")).toBe("translations/run-1/brief-cs.json");
    expect(translationKeys("run-1")).toEqual(["translations/run-1/brief-cs.json"]);
  });
});

describe("estimateTranslateUsd", () => {
  it("keeps a typical brief under the budget and refuses a huge one", () => {
    const typical = Array.from({ length: 50 }, (_, i) => ({ id: `c:${String(i)}`, text: "x".repeat(150) }));
    expect(estimateTranslateUsd(typical)).toBeLessThan(TRANSLATE_BUDGET_USD);
    const huge = Array.from({ length: 200 }, (_, i) => ({ id: `c:${String(i)}`, text: "x".repeat(300) }));
    expect(estimateTranslateUsd(huge)).toBeGreaterThan(TRANSLATE_BUDGET_USD);
  });

  it("fits a normal ~60-text brief (system prompt once per batch) under the cap", () => {
    const brief = Array.from({ length: 60 }, (_, i) => ({ id: `c:claim-${String(i)}`, text: "x".repeat(180) }));
    expect(translationBatches(brief).length).toBeGreaterThan(1);
    expect(estimateTranslateUsd(brief)).toBeLessThan(TRANSLATE_BUDGET_USD);
  });
});

const text = (id: string, length: number): { id: string; text: string } => ({ id, text: "x".repeat(length) });

describe("translationBatches", () => {
  it("cuts at the character budget, keeps order and never splits a text", () => {
    const texts = [text("a", 1000), text("b", 1000), text("c", 1000), text("d", 3000), text("e", 10)];
    const batches = translationBatches(texts);
    expect(batches.map((b) => b.map((t) => t.id))).toEqual([["a", "b"], ["c"], ["d"], ["e"]]);
    expect(batches.flat()).toEqual(texts);
    expect(batches[2]?.[0]?.text).toHaveLength(3000);
  });

  it("starts a new batch after the maximum number of texts", () => {
    const texts = Array.from({ length: TRANSLATE_BATCH_TEXTS * 2 + 1 }, (_, i) => text(`t${String(i)}`, 5));
    const batches = translationBatches(texts);
    expect(batches.map((b) => b.length)).toEqual([TRANSLATE_BATCH_TEXTS, TRANSLATE_BATCH_TEXTS, 1]);
    expect(batches.flat().map((t) => t.id)).toEqual(texts.map((t) => t.id));
  });

  it("fills a batch up to the budget exactly and takes custom limits", () => {
    expect(translationBatches([text("a", TRANSLATE_BATCH_CHARS - 1), text("b", 1), text("c", 1)]).map((b) => b.length)).toEqual([2, 1]);
    expect(translationBatches([text("a", 4), text("b", 4), text("c", 4)], 8, 10).map((b) => b.length)).toEqual([2, 1]);
    expect(translationBatches([])).toEqual([]);
  });
});

describe("failedCallCost", () => {
  it("reads a positive cost_usd off the error and is 0 for anything else", () => {
    expect(failedCallCost(Object.assign(new Error("No object generated"), { cost_usd: 0.08 }))).toBe(0.08);
    expect(failedCallCost(new Error("overloaded"))).toBe(0);
    expect(failedCallCost(Object.assign(new Error("x"), { cost_usd: -1 }))).toBe(0);
    expect(failedCallCost(Object.assign(new Error("x"), { cost_usd: "0.1" }))).toBe(0);
    expect(failedCallCost(null)).toBe(0);
  });
});

describe("translatePrompt", () => {
  it("asks for the same ids back and carries every text", () => {
    const { system, prompt } = translatePrompt(TEXTS);
    expect(system).toContain("exactly the ids you were given");
    expect(system).toContain("gender-neutral");
    expect(prompt).toContain('"id":"c:1"');
    expect(prompt).toContain("acme-ui");
  });
});

describe("mergeTranslation", () => {
  it("keeps known ids, ignores unknown and duplicate ones, and leaves missing ids out", () => {
    const merged = mergeTranslation(TEXTS, {
      texts: [
        { id: "c:1", text: " Spravuje open-source knihovnu acme-ui. " },
        { id: "c:1", text: "Druhý překlad" },
        { id: "extra", text: "Navíc" },
      ],
    });
    expect(merged).toEqual({ "c:1": "Spravuje open-source knihovnu acme-ui." });
  });

  it("drops empty and out-of-proportion texts", () => {
    const merged = mergeTranslation(TEXTS, {
      texts: [
        { id: "c:1", text: "  " },
        { id: "iq:0", text: "y".repeat(1000) },
      ],
    });
    expect(merged).toEqual({});
  });

  it("falls back to English when the translation adds a GDPR Art. 9 topic", () => {
    const merged = mergeTranslation(TEXTS, {
      texts: [
        { id: "c:1", text: "Spravuje knihovnu acme-ui, je členem politické strany." },
        { id: "iq:0", text: "Zeptejte se na zdravotní stav." },
      ],
    });
    expect(merged).toEqual({});
  });

  it("keeps a topic that the English source already names (the source decides, not the translation)", () => {
    const source = [{ id: "c:2", text: "Built the health records app at Medix." }];
    const merged = mergeTranslation(source, { texts: [{ id: "c:2", text: "Autorství aplikace health records ve firmě Medix." }] });
    expect(merged).toEqual({ "c:2": "Autorství aplikace health records ve firmě Medix." });
  });
});
