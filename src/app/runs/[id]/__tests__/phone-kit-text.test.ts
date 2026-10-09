/**
 * Tests for the phone panel and interview-kit sidebar labels in English and Czech.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/phone-kit-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - English: the words the page always showed, byte for byte (call-panel.ts English helpers delegate to them)
 * - Czech: SAID_NOTE keeps "said on the phone, not public evidence, coverage unchanged"; STATEMENT is VÝROK; consent
 *   keeps "agreed to this call and to the recording"; plurals for "N of M calls" (1, 2, 5); Czech dates and money
 * - No verdict words or scores in either language; the proposal's `why` chips are mapped, unknown ones pass through
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import { callPhase, formProblems } from "../call-panel";
import { REPORT_DICT } from "../i18n";
import { CALL_CS, CALL_EN, KIT_CS, KIT_EN } from "../phone-kit-text";

const strings = (o: unknown): string[] =>
  typeof o === "string" ? [o] : typeof o === "object" && o !== null ? Object.values(o).flatMap(strings) : [];

describe("English phone panel and kit labels", () => {
  it("keeps the panel's words", () => {
    expect(CALL_EN.title).toBe("Verify with the candidate by phone");
    expect(CALL_EN.saidNote).toBe("Said by the candidate on the phone. This is not public evidence and does not change the research coverage.");
    expect(CALL_EN.statementTag).toBe("STATEMENT");
    expect(CALL_EN.consent).toBe("The candidate agreed to this call and to the recording.");
    expect(CALL_EN.callAgain(1, 2)).toBe("Call again · 1 of 2 calls left");
    expect(CALL_EN.usage(0, 1)).toBe("0 of 1 call used for this run");
    expect(CALL_EN.earlier(3)).toBe("Earlier calls (3)");
    expect(CALL_EN.earlierAt("2026-10-09T04:12:33.000Z")).toBe("2026-10-09 04:12");
    expect(CALL_EN.meta.duration("1:23")).toBe("Duration 1:23");
    expect(CALL_EN.meta.cost(0.1)).toBe("Cost $0.10");
    expect(CALL_EN.meta.identity(null)).toBe("Identity confirmed: unknown");
    expect(CALL_EN.why("No public evidence: Go")).toBe("No public evidence: Go");
    expect(CALL_EN.englishNote).toBe("");
  });

  it("keeps the kit sidebar's words", () => {
    expect(KIT_EN.heading).toBe("Interview kit");
    expect(KIT_EN.copyKit).toBe("Copy interview kit");
    expect(KIT_EN.reviewCounts(1, 1, 2, 3)).toBe("Answered 1 of 1 interview question · verified 2 of 3 checks");
    expect(KIT_EN.allBriefs).toBe("My briefs");
  });
});

describe("Czech phone panel", () => {
  it("keeps the guardrail meaning of the note, the tag and the consent", () => {
    expect(CALL_CS.saidNote).toBe("Zaznělo v telefonu od kandidáta či kandidátky. Nejde o veřejný doklad a nemění to pokrytí výzkumu.");
    expect(CALL_CS.statementTag).toBe(REPORT_DICT.cs.kind.STATEMENT.toLocaleUpperCase("cs"));
    expect(CALL_CS.consent).toBe("Kandidát či kandidátka souhlasí s tímto hovorem i s jeho nahráváním.");
    expect(CALL_CS.problem.consent).toContain("nahráváním");
  });

  it("uses the dictionary's answer badges", () => {
    expect(Object.values(REPORT_DICT.cs.ui.answerStatus)).toEqual(["Zodpovězeno", "Nejasné", "Odmítnuto", "Bez odpovědi", "Nepoloženo"]);
  });

  it("writes Czech plurals for N of M calls", () => {
    expect(CALL_CS.usage(1, 1)).toBe("Využito 1 z 1 hovoru pro tento průzkum");
    expect(CALL_CS.usage(1, 2)).toBe("Využito 1 ze 2 hovorů pro tento průzkum");
    expect(CALL_CS.usage(2, 5)).toBe("Využito 2 z 5 hovorů pro tento průzkum");
    expect(CALL_CS.callAgain(1, 2)).toBe("Zavolat znovu · zbývá 1 ze 2 hovorů");
    expect(CALL_CS.callAgain(2, 5)).toBe("Zavolat znovu · zbývají 2 z 5 hovorů");
    expect(CALL_CS.callAgain(5, 5)).toBe("Zavolat znovu · zbývá 5 z 5 hovorů");
    expect(CALL_CS.problem.atMost(5)).toBe("Nejvýše 5 otázek.");
    expect(CALL_CS.problem.atMost(2)).toBe("Nejvýše 2 otázky.");
  });

  it("writes Czech dates and money", () => {
    expect(CALL_CS.earlierAt("2026-10-09T04:12:33.000Z")).toBe("9. 10. 2026 04:12");
    expect(CALL_CS.meta.cost(0.1)).toBe("Cena 0,10 USD");
    expect(CALL_CS.meta.identity(true)).toBe("Totožnost potvrzena: ano");
  });

  it("maps the proposal's why chips and passes unknown ones through", () => {
    expect(CALL_CS.why("No public evidence: Go")).toBe("Bez veřejného dokladu: Go");
    expect(CALL_CS.why("Partial evidence: SQL")).toBe("Částečný doklad: SQL");
    expect(CALL_CS.why("To verify")).toBe("K ověření");
    expect(CALL_CS.why("Own reason")).toBe("Own reason");
  });

  it("builds Czech status lines and validation through the shared helpers", () => {
    const view = { status: "dialing", answers: null, to_number_masked: "+420*****456", failure_reason: null, last_error: null } as const;
    expect(callPhase(view, CALL_CS.phase).text).toBe("Volám na číslo +420*****456…");
    expect(callPhase({ ...view, status: "failed", failure_reason: "busy" }, CALL_CS.phase).text).toBe("Hovor se nezdařil: busy");
    expect(callPhase({ ...view, status: "done", answers: [] }, CALL_CS.phase).text).toBe("Hovor skončil.");
    const problems = formProblems({ number: "123", consent: false, note: "", operator: "", questions: [] }, 2, 2, CALL_CS.problem);
    expect(problems).toEqual([
      "Tento průzkum už využil všechny hovory (2).",
      "Přidejte alespoň jednu otázku.",
      "Zadejte telefonní číslo v mezinárodním formátu, např. +420 777 123 456.",
      "Potvrďte, že kandidát či kandidátka souhlasí s hovorem i s nahráváním.",
      "Uveďte, jak byl souhlas udělen.",
      "Zadejte své jméno.",
    ]);
  });
});

describe("Czech kit sidebar", () => {
  it("names the kit like the Czech export and counts without plurals", () => {
    expect(KIT_CS.heading).toBe("Podklady k pohovoru");
    expect(KIT_CS.reviewCounts(1, 2, 0, 5)).toBe("Zodpovězené otázky k pohovoru: 1 ze 2 · ověřené body: 0 z 5");
  });
});

describe("both languages", () => {
  it("have no verdict words or scores", () => {
    for (const lang of ["en", "cs"] as const) {
      const { call, kit } = REPORT_DICT[lang];
      const words = [...strings(call), ...strings(kit), call.usage(1, 2), call.callAgain(1, 2)].join(" ");
      expect(words).not.toMatch(/good fit|bad fit|recommend|red flag|suitable|unsuitable|vhodn|doporuč|skóre/i);
    }
  });
});
