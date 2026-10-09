/**
 * Tests for the Czech registry collector: requests per role, parsers on recorded pages, excerpts and digest.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/cz-registries.test.ts
 * Deps:    vitest, src/recipe/sources/cz-registries, fixtures/cz-registries (recorded answers, birth numbers blanked)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Everyone registries are requested for any role; the bar only for a lawyer; nothing for a one-word subject
 * - ISIR, justice.cz, Police, ČAK and the nine chamber parsers read the recorded pages into hits with status, link and (where listed) birth date
 * - A clear answer becomes a quotable "lists no record" excerpt; hits become one line each; the digest marks unanswered registries unavailable
 *
 * Design constraints:
 * - Fixtures are trimmed real pages; no birth number is kept in them
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aresPerson } from "@/recipe/sources/cz-registries/ares";
import { cak } from "@/recipe/sources/cz-registries/cak";
import { ckait, clnk, ekcr, kacr, kdp, nkcr, nrpzs } from "@/recipe/sources/cz-registries/chambers-html";
import { cka, csk } from "@/recipe/sources/cz-registries/chambers-json";
import { czRegistries, digestOf } from "@/recipe/sources/cz-registries";
import { isir } from "@/recipe/sources/cz-registries/isir";
import { justicePersons } from "@/recipe/sources/cz-registries/justice";
import { police } from "@/recipe/sources/cz-registries/police";
import { labelled, namesMatch, personName } from "@/recipe/sources/cz-registries/shared";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { baseContext } from "./fakes";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/cz-registries/${f}`, import.meta.url), "utf8");
const step = hiringRecipe.steps.find((s) => s.id === "cz_registries");
if (step === undefined) throw new Error("cz_registries step missing");

describe("personName", () => {
  it("strips titles and takes first and last token", () => {
    expect(personName("Ing. Jan Novák, Ph.D.")).toEqual({ full: "Jan Novák", first: "Jan", last: "Novák" });
    expect(personName("Anna Marie Dvořáková")).toMatchObject({ first: "Anna", last: "Dvořáková" });
    expect(personName("Madonna")).toBeNull();
    expect(personName("Ingrid Nováková")).toMatchObject({ first: "Ingrid", last: "Nováková" });
    expect(personName("Drahomíra Dr. Archibald")).toMatchObject({ first: "Drahomíra", last: "Archibald" });
  });
});

describe("requests", () => {
  it("asks the everyone registries for any role and adds the bar for a lawyer", () => {
    const eng = czRegistries.requests(baseContext({ role: "Backend Engineer" }), step);
    const urls = eng.map((r) => (r.via === "fetch" ? r.url : ""));
    expect(urls.some((u) => u.includes("isir.justice.cz"))).toBe(true);
    expect(urls.some((u) => u.includes("ares.gov.cz"))).toBe(true);
    expect(urls.some((u) => u.includes("or.justice.cz"))).toBe(true);
    expect(urls.some((u) => u.includes("policie.gov.cz"))).toBe(true);
    expect(urls.some((u) => u.includes("cak.cz"))).toBe(false);
    const law = czRegistries.requests(baseContext({ role: "Advokát" }), step);
    expect(law.length).toBe(eng.length + 1);
    expect(czRegistries.requests(baseContext({ subject: "Cher" }), step)).toEqual([]);
    expect(czRegistries.skipReason?.(baseContext({ subject: "Cher" }))).toContain("given name and surname");
    expect(czRegistries.skipReason?.(baseContext())).toBeNull();
  });
});

const jana = { full: "Jana Nováková", first: "Jana", last: "Nováková" };
const pavel = { full: "Pavel Hlaváček", first: "Pavel", last: "Hlaváček" };

describe("parsers", () => {
  it("ISIR: one case with court, dates, state and detail link; the birth number is never read", () => {
    const a = isir.parse(fixture("isir.xml"), jana);
    expect(a.total).toBe(1);
    expect(a.hits[0]).toMatchObject({ status: "case closed", born: "1971-10-18" });
    expect(a.hits[0]?.label).toContain("Krajský soud v Ústí nad Labem");
    expect(a.hits[0]?.label).toContain("2016-10-10 to 2022-03-04");
    expect(a.hits[0]?.url).toContain("evidence_upadcu_detail.do");
    expect(JSON.stringify(a)).not.toContain("000000/0000");
    expect(isir.parse(fixture("isir.xml"), { full: "Petr Novák", first: "Petr", last: "Novák" }).hits).toEqual([]);
    expect(isir.parse("<soap:Envelope><soap:Body><soap:Fault><faultstring>down</faultstring></soap:Fault></soap:Body></soap:Envelope>", jana).note).toContain("down");
  });

  it("justice.cz: statutory-body rows with role, company, IČO and birth date", () => {
    const a = justicePersons.parse(fixture("justice.html"), pavel);
    expect(a.hits.length).toBeGreaterThanOrEqual(2);
    expect(a.hits[0]).toMatchObject({ status: "člen statutárního orgánu", born: "19. října 1970" });
    expect(a.hits[0]?.label).toContain("Pavel Hlaváček");
    expect(a.hits[1]?.label).toContain("VLTAVA INVEST a.s.");
    expect(a.hits[1]?.url).toBe("https://or.justice.cz/ias/ui/rejstrik-$firma?ico=27098613");
    expect(a.hits[1]?.label).not.toContain("Výpis platných");
    expect(justicePersons.parse("<html>maintenance</html>", pavel).note).not.toBeNull();
  });

  it("Police: only cards naming both tokens; status wanted or missing", () => {
    const a = police.parse(fixture("police.html"), { full: "Marek Novák", first: "Marek", last: "Novák" });
    expect(a.hits).toHaveLength(1);
    expect(a.hits[0]).toMatchObject({ status: "wanted", born: "13. 01. 1972" });
    expect(a.hits[0]?.url).toMatch(/patrani-osoby\?id=\d+$/);
    expect(police.parse(fixture("police.html"), { full: "Zdeněk Novák", first: "Zdeněk", last: "Novák" }).hits[0]?.label).toContain("Zdeněk Novák");
    expect(police.parse(fixture("police.html"), jana).hits).toEqual([]);
  });

  it("ČAK: attorneys and trainees with evidence number, status and firm", () => {
    const a = cak.parse(fixture("cak.html"), { full: "Jan Novák", first: "Jan", last: "Novák" });
    expect(a.total).toBe(6);
    expect(a.hits).toHaveLength(6);
    expect(a.hits[0]).toMatchObject({ status: "active", url: "https://vyhledavac.cak.cz/Contact/Details/397c99f4-6023-e711-80d5-00155d040b0c" });
    expect(a.hits[0]?.label).toContain("attorney, evidence no. 17244");
    expect(a.hits[1]?.label).toContain("trainee attorney");
    expect(a.hits.find((h) => h.status === "suspended")).toBeDefined();
  });

  it("ARES: only business names carrying both tokens, legal form 101, active unless dissolved", () => {
    const payload = {
      pocetCelkem: 428,
      ekonomickeSubjekty: [
        { ico: "00719331", obchodniJmeno: "Jan Novák", pravniForma: "101", datumVzniku: "2001-02-03", sidlo: { textovaAdresa: "Ostrožská Lhota 120" } },
        { ico: "12345678", obchodniJmeno: "Jana Nováková", pravniForma: "101", datumVzniku: "2010-01-01", datumZaniku: "2020-01-01" },
      ],
    };
    const a = aresPerson.parse(payload, { full: "Jan Novák", first: "Jan", last: "Novák" });
    expect(a.total).toBe(1);
    expect(a.hits).toHaveLength(1);
    expect(a.hits[0]).toMatchObject({ status: "active", url: "https://ares.gov.cz/ekonomicke-subjekty?ico=00719331" });
    const req = aresPerson.request(jana);
    expect(req.via === "fetch" ? req.init?.body : "").toContain('"pravniForma":["101"]');
  });

  it("namesMatch takes hyphenated surnames and ignores diacritics", () => {
    expect(namesMatch("JANA NOVÁKOVÁ-SVOBODOVÁ", { full: "Jana Nováková-Svobodová", first: "Jana", last: "Nováková-Svobodová" })).toBe(true);
    expect(namesMatch("Jana Novakova", { full: "Jana Nováková", first: "Jana", last: "Nováková" })).toBe(true);
    expect(namesMatch("Jana Nováková", { full: "Jan Novák", first: "Jan", last: "Novák" })).toBe(false);
  });

  it("labelled pairs label lines with the values that follow", () => {
    expect(labelled("Jméno:\nPAVEL\nAdresa:\nHrachov 77\nSvatý Jan").get("Adresa")).toBe("Hrachov 77 Svatý Jan");
  });
});

describe("collector", () => {
  it("writes a quotable excerpt per registry and marks unanswered ones unavailable in the digest", () => {
    const ctx = baseContext({ subject: "Pavel Hlaváček", role: "Advokát" });
    const reqs = czRegistries.requests(ctx, step);
    const justiceReq = reqs.find((r) => r.via === "fetch" && r.url.includes("or.justice.cz"));
    const isirReq = reqs.find((r) => r.via === "fetch" && r.url.includes("isir"));
    const clear = czRegistries.parse('<?xml version="1.0"?><soap:Envelope><soap:Body><ns2:getIsirWsCuzkDataResponse><stav><pocetVysledku>0</pocetVysledku></stav></ns2:getIsirWsCuzkDataResponse></soap:Body></soap:Envelope>', ctx, step, isirReq);
    expect(clear[0]?.excerpt).toBe("Insolvency register (Insolvenční rejstřík (ISIR)) lists no record under the name Pavel Hlaváček.");
    expect(clear[0]?.identity).toBe("unverified");
    const hits = czRegistries.parse(fixture("justice.html"), ctx, step, justiceReq);
    expect(hits[0]?.excerpt).toContain("a namesake is possible");
    expect(hits[0]?.excerpt).toContain("- Pavel Hlaváček");
    const digest = digestOf([{ req: justiceReq as never, payload: fixture("justice.html") }], ctx);
    expect(digest?.checks.map((c) => `${c.registry}:${c.status}`)).toEqual(["isir:unavailable", "ares:unavailable", "justice-or:hits", "police:unavailable", "cak:unavailable"]);
    expect(digest?.checks[2]?.hits.length).toBeGreaterThan(0);
    expect(digest?.role).toBe("Advokát");
  });
});

describe("chamber parsers (recorded pages)", () => {
  const jan = { full: "Jan Novák", first: "Jan", last: "Novák" };
  it("KDP: tax advisers whose name carries both tokens, deduplicated", () => {
    const a = kdp.parse(fixture("kdp.html"), { full: "Karel Novák", first: "Karel", last: "Novák" });
    expect(a.hits).toHaveLength(1);
    expect(a.hits[0]).toMatchObject({ status: "registered", url: "https://www.kdpcr.cz/danovy-poradce/ing-karel-novak-danovy-poradce" });
    expect(kdp.parse("<html>Fyzické osoby</html>", jan)).toEqual({ hits: [], total: 0, note: null });
  });
  it("KAČR: licence number, town and status from the entity-encoded table", () => {
    const a = kacr.parse(fixture("kacr.html"), { full: "Jiří Novák", first: "Jiří", last: "Novák" });
    expect(a.hits).toHaveLength(1);
    expect(a.hits[0]).toMatchObject({ status: "A-OSVČ", url: "https://www.kacr.cz/detail-auditora?nGoodsID=378" });
    expect(a.hits[0]?.label).toContain("licence no. 1460");
  });
  it("ČKAIT: member number, field and status", () => {
    const a = ckait.parse(fixture("ckait.html"), jan);
    expect(a.hits.length).toBeGreaterThanOrEqual(1);
    expect(a.hits[0]).toMatchObject({ status: "Aktivní", url: "https://www.ckait.cz/autorizovana-osoba/0001145/" });
    expect(a.hits[0]?.label).toContain("field IP00");
  });
  it("notaries, bailiffs, pharmacists and health-care providers", () => {
    expect(nkcr.parse(fixture("nkcr.html"), { full: "Miroslav Novák", first: "Miroslav", last: "Novák" }).hits[0]?.label).toContain("JUDr. Miroslav Novák — notary, Notářská komora");
    expect(ekcr.parse(fixture("ekcr.html"), { full: "Martin Svoboda", first: "Martin", last: "Svoboda" }).hits[0]?.label).toContain("č. soud. exek.: 110");
    const ph = clnk.parse(fixture("clnk.html"), { full: "Filip Novák", first: "Filip", last: "Novák" });
    expect(ph.hits.map((h) => h.label)).toEqual(["Novák Filip PharmDr. — pharmacist, member no. 7915", "Novák Filip PharmDr. — pharmacist, member no. 12613"]);
    const pr = nrpzs.parse(fixture("nrpzs.html"), jan);
    expect(pr.total).toBe(36);
    expect(pr.hits[0]).toMatchObject({ status: "registered provider", url: "https://nrpzs.uzis.cz/detail-94445-mddr-jan-novak.html" });
    expect(pr.hits[0]?.label).toContain("zubní lékařství");
  });
  it("ČKA and ČSK JSON: architects post-filtered to the name, dentists without the padding rows", () => {
    const ar = cka.parse(JSON.parse(fixture("cka.json")), { full: "Petr Dobrovolný", first: "Petr", last: "Dobrovolný" });
    expect(ar.hits).toHaveLength(1);
    expect(ar.hits[0]).toMatchObject({ status: "listed" });
    expect(ar.hits[0]?.label).toContain("authorised architect no. 3611");
    expect(cka.parse(JSON.parse(fixture("cka.json")), jan).hits).toEqual([]);
    const de = csk.parse(JSON.parse(fixture("csk.json")), jan);
    expect(de.hits.length).toBeGreaterThanOrEqual(1);
    expect(de.hits.every((h) => h.label.startsWith("Novák Jan"))).toBe(true);
    expect(csk.parse({ nope: 1 }, jan).note).not.toBeNull();
  });
});
