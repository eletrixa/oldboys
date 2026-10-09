/**
 * Tests for the Czech exports (idea #24 follow-up): interview kit, calendar invite and kit review in the report language
 * with the brief's translated texts; ATS note and reference questions before the translation arrives.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/export-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - EXPORT_DICT: same keys in both languages, Czech strings filled; file names get "-cs"; Czech dates
 * - Kit and invite in Czech: Czech fixed lines, translated texts by id, English per missing text, quotes / URLs / names /
 *   headline unchanged, "(citace v originále)" once in the kit
 * - Czech fixed lines with no translation loaded (makeReport("cs", null)) never block an export, ATS note and reference
 *   questions included (their translated output is tested in ats-note / reference-check tests)
 * - A filled Czech kit parses like the English one (idea #23); the .ics stays valid with Czech diacritics
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only; English output is covered by the existing export tests
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate, Claim } from "@/domain/claim";
import { atsNote } from "../ats-note";
import { EXPORT_DICT, dayCs, exportFileName } from "../export-text";
import { makeReport } from "../i18n";
import { interviewInvite, inviteFileName } from "../interview-invite";
import { interviewKit, kitFileName } from "../interview-kit";
import { openPointsText, parseFilledKit, reviewSummary } from "../kit-review";
import { referenceQuestions } from "../reference-check";
import type { RunState } from "../state";

const AT = "2026-10-08T21:30:00.000Z";
const BRIEF_URL = "https://oldboys.example/runs/0123456789abcdef";
const QUOTE = "Built the Acme billing pipeline in Spark";

const claim = (id: string, text: string, kind: Claim["kind"] = "FACT", quote: string | null = QUOTE): Claim => ({
  id, run_id: "r", question_id: "mh-spark", candidate_id: null, text, kind, confidence: 0.9, quote, supports: ["s1"], contradicts: [], rank: 0,
});

const cand = (platform: string, url: string): Candidate => ({
  id: platform, run_id: "r", name: "Jan Novak", profile_urls: [url], anchor_match: null, score: 0.9, decision: "merge", platform, handle: null, snippet: "", reasons: [],
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  profile: null,
  run_id: "r",
  per_question: [
    { question_id: "mh-spark", coverage: "evidenced", claim_ids: ["c1"], summary: "Spark at Acme." },
    { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "" },
  ],
  interview_questions: ["Walk me through the billing pipeline.", "How did you test it?"],
  to_verify: ["Dates at Acme", "Talk at DataConf 2024"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [{ source: "personal_site_crawl", reason: "no personal site" }],
  removed_protected: 1,
  degraded: null,
  evidence: [],
  also_found: [{ step: "apify/google-search-scraper", url: "https://namesake.example/jan", excerpt: "Another Jan Novak, dentist" }],
  headline: "Senior Data Engineer at Acme",
  location_note: "Based in Prague",
  sections: [
    { id: "skills", title: "Data engineering", confidence: 0.85, confidence_reason: "two independent sources", claim_ids: ["c1"], source_ids: ["s1"], summary: "Spark work at Acme." },
  ],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "0123456789abcdef",
  subject: "Jan Novak",
  headline: null,
  role: "Senior Data Engineer",
  position: null,
  organization_name: "Acme s.r.o.",
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [cand("linkedin", "https://www.linkedin.com/in/jnovak")],
  claims: [claim("c1", "Builds Spark pipelines at Acme")],
  sources: [{ id: "s1", url: "https://www.linkedin.com/in/jnovak", fetched_at: "2026-10-08T21:10:00.000Z" }],
  questions: [
    { id: "mh-spark", text: "Has built Spark pipelines" },
    { id: "mh-lead", text: "Has led a team" },
  ],
  brief: brief(),
  failure: null,
  intake: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0.234, source_calls: 7, llm_calls: 4, duration_ms: 192_000 },
  challenges: [],
  challenge_summary: null,
  ...over,
});

/** What the translate route returns for this brief: every text but "How did you test it?" (iq:1) and tv:1. */
const TEXTS: Record<string, string> = {
  "s:skills:title": "Datové inženýrství",
  "s:skills:reason": "dva nezávislé zdroje",
  "s:skills:summary": "Práce se Sparkem v Acme.",
  "c:c1": "Staví pipeline ve Sparku v Acme",
  "iq:0": "Popište prosím billingovou pipeline.",
  "tv:0": "Data působení v Acme",
  "se:0": "žádný osobní web",
  "ns:0": "žádný potvrzený účet",
  loc: "Sídlo v Praze",
  "q:mh-lead": "Vedl/a tým",
};

/** What KitActions gets from useReportLanguage().exports: CZ with the translation, and CZ before it has arrived. */
const CS = makeReport("cs", TEXTS);
const CS_NO_TEXTS = makeReport("cs", null);

describe("EXPORT_DICT", () => {
  it("has the same keys in English and Czech, Czech strings filled", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v !== null ? keys(v as object).map((s) => `${k}.${s}`) : [k])).sort();
    expect(keys(EXPORT_DICT.cs)).toEqual(keys(EXPORT_DICT.en));
    const strings = (o: object): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : typeof v === "object" && v !== null ? strings(v as object) : []));
    for (const [key, value] of strings(EXPORT_DICT.cs)) expect(value, key).not.toBe("");
  });

  it("Czech dates without leading zeros, file names with -cs", () => {
    expect(dayCs("2026-10-09")).toBe("9. 10. 2026");
    expect(exportFileName("interview-kit-01234567.md", "cs")).toBe("interview-kit-01234567-cs.md");
    expect(exportFileName("interview-kit-01234567.md", "en")).toBe("interview-kit-01234567.md");
    expect(kitFileName(run(), "cs")).toBe("interview-kit-01234567-cs.md");
    expect(inviteFileName(run(), "cs")).toBe("interview-01234567-cs.ics");
    expect(kitFileName(run())).toBe("interview-kit-01234567.md");
  });
});

describe("interviewKit in Czech", () => {
  const md = interviewKit(run(), AT, [], CS) ?? "";

  it("uses the Czech fixed lines and Czech dates", () => {
    for (const line of [
      "# Podklady k pohovoru",
      "Obsazovaná pozice: Senior Data Engineer",
      "Vytvořeno: 8. 10. 2026",
      "Náklady průzkumu: 0,23 USD · volání zdrojů: 7 · volání AI: 4 · 3 min 12 s",
      "## Co průzkum zjistil",
      "Spolehlivost průzkumu: 85 % (silné doložení), dva nezávislé zdroje",
      "## Otázky k pohovoru",
      "  Poznámky:",
      "## K ověření",
      "## Prohledáno, nic nenalezeno",
      "## Neprohledáno, a proč",
      "_Tyto podklady hodnotí výzkum, ne kandidáta. Jen veřejné zdroje; data z průzkumu smažeme po 7 dnech._",
      "_Odstraněné položky (chráněné kategorie): 1_",
      "Načteno 8. 10. 2026, 21:10 UTC",
    ]) {
      expect(md, line).toContain(line);
    }
    expect(md).not.toContain("Interview kit");
    expect(md).not.toContain("Notes:");
  });

  it("puts translated texts in by id and keeps English per missing text", () => {
    expect(md).toContain("### Datové inženýrství");
    expect(md).toContain("Práce se Sparkem v Acme.");
    expect(md).toContain("- FAKT: Staví pipeline ve Sparku v Acme (<https://www.linkedin.com/in/jnovak>)");
    expect(md).toContain("- [ ] Popište prosím billingovou pipeline.\n  Poznámky:");
    expect(md).toContain("- [ ] How did you test it?\n  Poznámky:");
    expect(md).toContain("- [ ] Data působení v Acme");
    expect(md).toContain("- [ ] Talk at DataConf 2024");
    expect(md).toContain("- Osobní web: žádný osobní web");
    expect(md).toContain("- X: žádný potvrzený účet");
    expect(md).toContain("Sídlo v Praze");
  });

  it("keeps the quote, URL, names and headline original and marks quotes once", () => {
    expect(md).toContain(`  - Citace: "${QUOTE}"`);
    expect(md).toContain("Potvrzený profil: Senior Data Engineer at Acme");
    expect(md.split("(citace v originále)")).toHaveLength(2);
    expect(md).not.toContain("namesake.example");
  });

  it("has no quote note when the kit shows no quote", () => {
    const noQuote = interviewKit(run({ claims: [claim("c1", "Builds Spark pipelines at Acme", "INFERENCE", null)] }), AT, [], CS) ?? "";
    expect(noQuote).toContain("- ODVOZENÍ: Staví pipeline ve Sparku v Acme");
    expect(noQuote).not.toContain("citace v originále");
  });

  it("translates the devil's advocate reason and line", () => {
    const challenged = interviewKit(
      run({
        challenges: [{ claim_id: "c1", ground: "fork-or-copy", why: "The repository is a fork." }],
        challenge_summary: { checked: 3, held: 2, moved: 1 },
      }),
      AT,
      [],
      makeReport("cs", { ...TEXTS, "ch:c1": "Repozitář je fork." }),
    ) ?? "";
    expect(challenged).toContain("  - Zpochybněno: může jít o fork, ne o vlastní práci (Repozitář je fork)");
    expect(challenged).toContain("_Ďáblův advokát: prověřená zjištění 3, obstála 2, přesunuta k pohovoru 1_");
  });

  it("uses the Czech templates with English texts while no translation is loaded", () => {
    const fallback = interviewKit(run(), AT, [], CS_NO_TEXTS) ?? "";
    expect(fallback).toContain("# Podklady k pohovoru");
    expect(fallback).toContain("### Data engineering");
    expect(fallback).toContain("- [ ] Walk me through the billing pipeline.\n  Poznámky:");
    expect(fallback).toContain("- FAKT: Builds Spark pipelines at Acme");
  });

  it("is identical to the default call in English", () => {
    expect(interviewKit(run(), AT, [], makeReport("en", TEXTS))).toBe(interviewKit(run(), AT));
  });
});

describe("kit review with a Czech kit (idea #23)", () => {
  const fill = (md: string, notes: string): string =>
    md
      .replace("- [ ] Walk me through the billing pipeline.", "- [x] Walk me through the billing pipeline.")
      .replace("- [ ] Popište prosím billingovou pipeline.", "- [x] Popište prosím billingovou pipeline.")
      .replace(`- [ ] How did you test it?\n  ${notes}`, `- [ ] How did you test it?\n  ${notes} unit tests on staging`)
      .replace("- [ ] Dates at Acme", "- [x] Dates at Acme")
      .replace("- [ ] Data působení v Acme", "- [x] Data působení v Acme");

  it("parses a filled Czech kit the same as the English one", () => {
    const en = reviewSummary(parseFilledKit(fill(interviewKit(run(), AT) ?? "", "Notes:")));
    const cs = reviewSummary(parseFilledKit(fill(interviewKit(run(), AT, [], CS_NO_TEXTS) ?? "", "Poznámky:")));
    expect(en).toEqual({ answered: 2, questions: 2, verified: 1, checks: 2, open: ["Talk at DataConf 2024"] });
    expect(cs).toEqual(en);
  });

  it("lists the open points of a translated kit in Czech", () => {
    const review = parseFilledKit(interviewKit(run(), AT, [], CS) ?? "");
    expect(reviewSummary(review).open).toEqual(["Popište prosím billingovou pipeline.", "How did you test it?", "Data působení v Acme", "Talk at DataConf 2024"]);
    expect(openPointsText(review, "cs").split("\n")[0]).toBe("Po pohovoru zůstává otevřené:");
    expect(openPointsText(parseFilledKit("## K ověření\n\n- [x] hotovo\n"), "cs")).toBe("Všechny body z podkladů k pohovoru byly na pohovoru probrány.");
  });
});

describe("ATS note and reference questions before the translation arrives", () => {
  it("ATS note: Czech fixed lines and summary, English criterion and question texts", () => {
    const lines = (atsNote(run(), BRIEF_URL, CS_NO_TEXTS) ?? "").split("\n");
    expect(lines[0]).toBe("Podklady z průzkumu: Jan Novak, pozice Senior Data Engineer");
    expect(lines[1]).toBe("Potvrzeno: profil LinkedIn. Doložená kritéria pozice: 1 ze 2.");
    expect(lines[2]).toBe("Chybí doklad k: „Has led a team“. Dále: Osobní web (prohledáno, nic nepotvrzeno).");
    expect(lines[3]).toBe("Zeptejte se: Walk me through the billing pipeline.");
    expect(lines.at(-1)).toBe("Tato poznámka hodnotí průzkum, ne kandidáta. Data z průzkumu smažeme po 15. 10. 2026.");
  });

  it("reference questions: Czech fixed lines, English criteria and to-verify texts", () => {
    const text = referenceQuestions(run(), CS_NO_TEXTS) ?? "";
    expect(text.split("\n")[0]).toBe("Reference: Jan Novak, pozice Senior Data Engineer");
    expect(text).toContain("Pro „Has led a team“ jsme ve veřejných zdrojích nenašli žádný doklad.");
    expect(text).toContain("Můžete potvrdit: Dates at Acme?");
    expect(text).not.toMatch(/Did you|Can you/);
  });
});

describe("interviewInvite in Czech", () => {
  const opts = { start: new Date("2026-10-12T08:00:00.000Z"), minutes: 60, briefUrl: BRIEF_URL, now: new Date("2026-10-09T10:00:00.000Z") };
  const ics = interviewInvite(run(), opts, CS) ?? "";
  const unfolded = ics.replace(/\r\n /g, "");

  it("stays valid iCalendar: CRLF, lines of at most 75 octets, no split UTF-8 character", () => {
    const lines = ics.split("\r\n");
    expect(lines.at(-1)).toBe("");
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toContain("�");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
  });

  it("has a Czech summary and description with LANGUAGE=cs and translated items", () => {
    expect(unfolded).toContain("SUMMARY;LANGUAGE=cs:Pohovor: Jan Novak\\, pozice Senior Data Engineer");
    expect(unfolded).toContain("DESCRIPTION;LANGUAGE=cs:Potvrzeno: profil LinkedIn. Doložená kritéria pozice: 1 ze 2.\\nChybí doklad k: „Vedl/a tým“.");
    expect(unfolded).toContain("\\n\\nOtázky k pohovoru:\\n1. Popište prosím billingovou pipeline.\\n2. How did you test it?");
    expect(unfolded).toContain("\\n\\nK ověření:\\n- Data působení v Acme\\n- Talk at DataConf 2024");
    expect(unfolded).toContain(`Celý podklad se zdroji: ${BRIEF_URL}`);
    expect(unfolded).toContain("Tato pozvánka hodnotí výzkum\\, ne kandidáta. Data z průzkumu smažeme po 15. 10. 2026.");
    expect(unfolded).toContain(`URL:${BRIEF_URL}`);
  });

  it("English has no LANGUAGE parameter, as before", () => {
    const en = interviewInvite(run(), opts) ?? "";
    expect(en).toContain("SUMMARY:Interview: Jan Novak for Senior Data Engineer");
    expect(en).not.toContain("LANGUAGE=");
  });
});
