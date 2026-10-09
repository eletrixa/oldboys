/**
 * Tests for the report dictionary (idea #24): both languages complete, Czech labels in place, translation lookup.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/i18n.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Every key exists in both languages with a non-empty value (quotesNote may be empty in English only); the nested
 *   phone panel (call) and kit sidebar (kit) labels have the same shape in both languages and no empty Czech string
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

  it("has the same layout labels (ui) in English and Czech, and no verdict words in them", () => {
    expect(Object.keys(REPORT_DICT.cs.ui).sort()).toEqual(Object.keys(REPORT_DICT.en.ui).sort());
    for (const lang of ["en", "cs"] as const) {
      const ui = REPORT_DICT[lang].ui;
      const words = [ui.noEvidenceTitle(4, 4), ui.gapNotPerson, ui.saidByCandidate, ui.compare, ui.sourcesDisagree, ui.decisionByPerson, ...Object.values(ui.gapGroup)].join(" ");
      expect(words).not.toMatch(/good fit|bad fit|recommend|score|red flag|suitable|unsuitable|vhodn|doporuč|skóre/i);
    }
    expect(REPORT_DICT.en.ui.saidByCandidate).toBe("Said by the candidate. Not public evidence.");
    expect(REPORT_DICT.cs.ui.noEvidenceTitle(0, 4)).toBe("Bez veřejného dokladu: 0 ze 4 kritérií pozice");
  });

  it("translates the header intake line, the CACHED detail and the research numbers of the Czech brief", () => {
    const intake = { source: "manual" as const, tag: null, receivedAt: "2026-10-09T02:46:39Z" };
    expect(REPORT_DICT.en.ui.intakeLine(intake)).toBe("Added by hand · 2026-10-09");
    expect(REPORT_DICT.cs.ui.intakeLine(intake)).toBe("Přidáno ručně · 9. 10. 2026");
    expect(REPORT_DICT.cs.ui.intakeLine({ source: "email", tag: "cmo", receivedAt: "2026-10-09T02:46:39Z" })).toBe("Z e-mailu · cmo · 9. 10. 2026");
    expect(REPORT_DICT.en.ui.costValue(0.784)).toBe("$0.78");
    expect(REPORT_DICT.cs.ui.costValue(0.784)).toBe("0,78 USD");
    expect(REPORT_DICT.cs.ui.cachedFrom("2026-10-09 02:46")).toBe("běh z 2026-10-09 02:46 UTC");
    expect(Object.keys(REPORT_DICT.cs.ui.aboutRows)).toEqual(Object.keys(REPORT_DICT.en.ui.aboutRows));
    expect(REPORT_DICT.en.ui.day("2026-10-09T02:46:39Z")).toBe("9 Oct");
    expect(REPORT_DICT.cs.ui.day("2026-10-09T02:46:39Z")).toBe("9. 10.");
    expect(REPORT_DICT.cs.ui.day("nope")).toBe("");
  });

  it("has the same phone panel (call) and kit sidebar (kit) labels in English and Czech, all filled", () => {
    const shape = (o: unknown): unknown =>
      typeof o === "object" && o !== null ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)]).sort(([x], [y]) => String(x).localeCompare(String(y)))) : typeof o;
    for (const part of ["call", "kit"] as const) {
      expect(shape(REPORT_DICT.cs[part]), part).toEqual(shape(REPORT_DICT.en[part]));
      const walk = (o: unknown, path: string): void => {
        if (typeof o === "string") expect(o, path).not.toBe("");
        else if (typeof o === "object" && o !== null) for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
      };
      walk(REPORT_DICT.cs[part], part);
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
