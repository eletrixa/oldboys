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
 * - Kind markers: FACT / INFERENCE / STATEMENT round trip to FAKT: / ODVOZENÍ: / VÝROK:, a missing or changed
 *   placeholder falls back to English; a translated job title falls back to English
 * - translatePrompt: one identical system prompt for every batch with the glossary, date style and examples;
 *   PROMPT_VERSION is part of the hash
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  KIND_MARKERS_CS,
  PROMPT_VERSION,
  TRANSLATE_BATCH_CHARS,
  TRANSLATE_BATCH_TEXTS,
  TRANSLATE_BUDGET_USD,
  estimateTranslateUsd,
  failedCallCost,
  jobTitleNouns,
  mergeTranslation,
  protectMarkers,
  restoreMarkers,
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
  it("includes the prompt version, so an older prompt's cache is redone", async () => {
    expect(PROMPT_VERSION).not.toBe("");
    expect(await textsHash(TEXTS)).toBe(await textsHash(TEXTS, PROMPT_VERSION));
    expect(await textsHash(TEXTS, "cs-1")).not.toBe(await textsHash(TEXTS));
  });

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

  it("gives every batch the identical system prompt with the glossary, date style and examples", () => {
    const texts = Array.from({ length: 50 }, (_, i) => ({ id: `c:${String(i)}`, text: `Claim number ${String(i)} `.repeat(10) }));
    const batches = translationBatches(texts);
    expect(batches.length).toBeGreaterThan(1);
    const systems = new Set(batches.map((b) => translatePrompt(b).system));
    expect(systems.size).toBe(1);
    const system = translatePrompt(batches[batches.length - 1] ?? []).system;
    expect(system).toBe(translatePrompt(batches[0] ?? []).system);
    for (const term of [
      "evidence → doklad",
      "claim → tvrzení",
      "source → zdroj",
      "role criteria → kritéria pozice",
      "interview → pohovor",
      "to verify → k ověření",
      "self-reported → uvedeno samotnou osobou",
      "mirror site → zrcadlová stránka",
      "říjen 2022 – květen 2026",
      "od října 2022 do května 2026",
      "never \"Vlastnictví X\"",
      "⟦FACT⟧",
      "kandidát či kandidátka",
    ]) {
      expect(system).toContain(term);
    }
    expect(system.match(/^EN: /gm)?.length).toBeGreaterThanOrEqual(3);
    expect(system).toContain("CS: Board Advisor ve společnosti snuggs");
  });
});

describe("kind markers", () => {
  const SUMMARY = { id: "s:work:summary", text: "FACT: Owns acme-ui. INFERENCE: Leads its frontend. STATEMENT: Says 10 years." };

  it("sends placeholders instead of the English markers, only where synthesize writes them", () => {
    expect(protectMarkers(SUMMARY.text)).toBe("⟦FACT⟧ Owns acme-ui. ⟦INFERENCE⟧ Leads its frontend. ⟦STATEMENT⟧ Says 10 years.");
    expect(protectMarkers("Line one\nFACT: two")).toBe("Line one\n⟦FACT⟧ two");
    expect(protectMarkers("The FACT: sheet is mid-sentence")).toBe("The FACT: sheet is mid-sentence");
    const { prompt } = translatePrompt([SUMMARY]);
    expect(prompt).toContain("⟦INFERENCE⟧ Leads");
    expect(prompt).not.toContain("INFERENCE:");
  });

  it("round trips FACT / INFERENCE / STATEMENT to the pill words", () => {
    const merged = mergeTranslation([SUMMARY], {
      texts: [{ id: SUMMARY.id, text: "⟦FACT⟧ Spravuje acme-ui. ⟦INFERENCE⟧: Vede frontend. ⟦STATEMENT⟧ Uvádí 10 let." }],
    });
    expect(merged[SUMMARY.id]).toBe("FAKT: Spravuje acme-ui. ODVOZENÍ: Vede frontend. VÝROK: Uvádí 10 let.");
    expect(restoreMarkers("⟦FACT⟧ a")).toBe("FAKT: a");
  });

  it("falls back to English when a placeholder is missing, changed, added or reordered", () => {
    for (const text of [
      "⟦FACT⟧ Spravuje acme-ui. ÚSUDEK: Vede frontend. ⟦STATEMENT⟧ Uvádí 10 let.",
      "⟦FAKT⟧ Spravuje acme-ui. ⟦INFERENCE⟧ Vede frontend. ⟦STATEMENT⟧ Uvádí 10 let.",
      "⟦STATEMENT⟧ Uvádí 10 let. ⟦FACT⟧ Spravuje acme-ui. ⟦INFERENCE⟧ Vede frontend.",
      "⟦FACT⟧ Spravuje acme-ui. ⟦INFERENCE⟧ Vede frontend. ⟦STATEMENT⟧ Uvádí 10 let. ⟦FACT⟧ Navíc.",
    ]) {
      expect(mergeTranslation([SUMMARY], { texts: [{ id: SUMMARY.id, text }] })).toEqual({});
    }
    expect(mergeTranslation(TEXTS, { texts: [{ id: "c:1", text: "⟦FACT⟧ Spravuje acme-ui." }] })).toEqual({});
  });

  it("uses the same words as the kind pills", () => {
    expect(KIND_MARKERS_CS).toEqual({ FACT: "FAKT", INFERENCE: "ODVOZENÍ", STATEMENT: "VÝROK" });
  });
});

describe("job titles", () => {
  const ROLE = { id: "c:7", text: "Board Advisor at snuggs; Owner of Naveky.cz from Mar 2021 to Nov 2025." };

  it("finds the title nouns before at / @ / of, not plain words", () => {
    expect(jobTitleNouns(ROLE.text)).toEqual(["Advisor", "Owner"]);
    expect(jobTitleNouns("Co-founder & CEO @ Acme")).toEqual(["CEO"]);
    expect(jobTitleNouns("Graduated at CTU. University of Prague. Teamlead at X. the owner of a dog")).toEqual([]);
  });

  it("keeps a translation with the titles in English and drops one that translated them", () => {
    const kept = "Board Advisor ve společnosti snuggs; Owner ve společnosti Naveky.cz od března 2021 do listopadu 2025.";
    expect(mergeTranslation([ROLE], { texts: [{ id: ROLE.id, text: kept }] })).toEqual({ [ROLE.id]: kept });
    for (const text of [
      "Poradce představenstva ve společnosti snuggs; Owner ve společnosti Naveky.cz od března 2021 do listopadu 2025.",
      "Board Advisor ve snuggs; Vlastnictví Naveky.cz od března 2021 do listopadu 2025.",
    ]) {
      expect(mergeTranslation([ROLE], { texts: [{ id: ROLE.id, text }] })).toEqual({});
    }
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
