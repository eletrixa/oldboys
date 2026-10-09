/**
 * Tests for the report dictionary (idea #24): both languages complete, Czech labels in place, translation lookup.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/i18n.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Every key exists in both languages with a non-empty value (quotesNote may be empty in English only)
 * - English labels match the page's existing words; Czech ones are the agreed terms
 * - makeReport: translated text by id, English per missing id, English everywhere for "en"
 * - The kind markers the translation writes into section summaries (KIND_MARKERS_CS) are the cs kind pills, uppercase
 *
 * Design constraints:
 * - The type (ReportDict) already makes a missing key a compile error; this guards empty strings and drift
 */
import { describe, expect, it } from "vitest";
import { KIND_MARKERS_CS } from "@/domain/report-translation";
import { REPORT_DICT, makeReport } from "../i18n";

describe("REPORT_DICT", () => {
  it("writes the same kind words in translated summaries as on the pills", () => {
    for (const [kind, pill] of Object.entries(REPORT_DICT.cs.kind)) {
      expect(KIND_MARKERS_CS[kind as keyof typeof KIND_MARKERS_CS], kind).toBe(pill.toLocaleUpperCase("cs"));
    }
  });

  it("has the same keys in English and Czech, all filled", () => {
    expect(Object.keys(REPORT_DICT.cs).sort()).toEqual(Object.keys(REPORT_DICT.en).sort());
    for (const [key, value] of Object.entries(REPORT_DICT.cs)) {
      if (typeof value === "string") expect(value, key).not.toBe("");
    }
  });

  it("keeps the English labels the page always had", () => {
    const { en } = REPORT_DICT;
    expect(en.band).toEqual({ strong: "Strong evidence", fair: "Some evidence", weak: "Thin evidence" });
    expect(en.kind).toEqual({ FACT: "Fact", INFERENCE: "Inference", STATEMENT: "Statement" });
    expect(en.showEvidence).toBe("Show evidence");
    expect(en.searched(true)).toBe("Searched, nothing confirmed");
    expect(en.challengeTag("fork-or-copy")).toBe("Challenged: may be a fork, not own work — ask at the interview");
    expect(en.retrieved("2026-10-09T23:14:00.000Z")).toBe("Retrieved 9 Oct 2026, 23:14 UTC");
  });

  it("uses the agreed Czech terms and Czech dates; quotes are labelled as original", () => {
    const { cs } = REPORT_DICT;
    expect(cs.band).toEqual({ strong: "Silné doložení", fair: "Částečné doložení", weak: "Slabé doložení" });
    expect(cs.kind).toEqual({ FACT: "Fakt", INFERENCE: "Odvození", STATEMENT: "Výrok" });
    expect(cs.quoteFromSource.toLowerCase()).toContain("citace v originále");
    expect(cs.retrieved("2026-10-09T23:14:00.000Z")).toBe("Načteno 9. 10. 2026, 23:14 UTC");
    expect(cs.retrieved(null)).toBe("Čas načtení nebyl zaznamenán");
    expect(cs.savedCopy("2026-10-16T00:00:00.000Z")).toBe("Uložená kopie z doby načtení (uchováváme do 16. 10. 2026)");
    expect(cs.devilsAdvocate({ checked: 5, held: 4, moved: 1 })).toContain("5");
    expect(cs.devilsAdvocate(null)).toBeNull();
    expect(cs.label("Web search")).toBe("Vyhledávání na webu");
    expect(cs.label("GitHub")).toBe("GitHub");
  });
});

describe("makeReport", () => {
  it("returns the translation per id and English when it is missing", () => {
    const report = makeReport("cs", { "c:1": "Spravuje knihovnu acme-ui." });
    expect(report.text("c:1", "Maintains acme-ui.")).toBe("Spravuje knihovnu acme-ui.");
    expect(report.text("c:2", "Leads a team.")).toBe("Leads a team.");
    expect(report.t.showEvidence).toBe("Zobrazit doklady");
  });

  it("ignores texts for English", () => {
    expect(makeReport("en", { "c:1": "Spravuje" }).text("c:1", "Maintains")).toBe("Maintains");
  });
});
