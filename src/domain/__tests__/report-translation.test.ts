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
 * - mergeTranslation: missing, unknown, duplicate and empty ids fall back; a new Art. 9 topic falls back; an Art. 9
 *   topic already in the English source is kept
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  TRANSLATE_BUDGET_USD,
  estimateTranslateUsd,
  mergeTranslation,
  textsHash,
  translatePrompt,
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
