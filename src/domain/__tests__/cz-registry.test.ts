/**
 * Tests for the Czech registry catalog: scope by role title, digest schema, ledger reader.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/cz-registry.test.ts
 * Deps:    vitest, src/domain/cz-registry
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - `everyone` registries apply with and without a role; the chambers only when the title names the profession
 * - "Software architect" never triggers the architects' chamber, "architekt" does
 * - `readRegistryChecks` reads the latest cz_registries digest and ignores malformed rows
 * - A namesake's address never leaves as more than the town: `townOf`, `redactHitLabel`, `redactRegistryExcerpt`, the digest reader
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { readRegistryChecks, redactHitLabel, redactRegistryExcerpt, REGISTRIES, registriesFor, REGISTRY_STEP, townOf } from "@/domain/cz-registry";

const ids = (role: string | null) => registriesFor(role).map((r) => r.id);
const EVERYONE = REGISTRIES.filter((r) => r.scope === "everyone").map((r) => r.id);

describe("registriesFor", () => {
  it("runs the everyone registries for every position, role or not", () => {
    expect(ids(null)).toEqual(EVERYONE);
    expect(ids("Backend Engineer")).toEqual(EVERYONE);
    expect(EVERYONE).toContain("isir");
    expect(EVERYONE).toContain("police");
  });

  it("adds the chamber the role title names, in Czech or English", () => {
    expect(ids("Lékař - internista")).toContain("clk");
    expect(ids("Lékař - internista")).toContain("nrpzs");
    expect(ids("Attorney at law")).toContain("cak");
    expect(ids("Advokátní koncipient")).toContain("cak");
    expect(ids("Daňový poradce")).toContain("kdp");
    expect(ids("Tax Advisor")).toContain("kdp");
    expect(ids("Statutory Auditor")).toContain("kacr");
    expect(ids("Zubní lékař")).toContain("csk");
    expect(ids("Finanční poradce")).toContain("cnb");
    expect(ids("Soudní tlumočník")).toContain("znalci");
    expect(ids("Stavbyvedoucí")).toContain("ckait");
  });

  it("never sends a software architect to the architects' chamber", () => {
    expect(ids("Software Architect")).not.toContain("cka");
    expect(ids("Senior Solutions Architect")).not.toContain("cka");
    expect(ids("Architekt")).toContain("cka");
    expect(ids("Správní ředitel")).not.toContain("cak");
    expect(ids("Právník")).toContain("cak");
    expect(ids("Building architect")).toContain("cka");
  });

  it("every registry has a public page and a meaning line", () => {
    for (const r of REGISTRIES) {
      expect(r.url).toMatch(/^https:\/\//);
      expect(r.means.length).toBeGreaterThan(10);
      if (r.scope === "role") expect(r.role).toBeInstanceOf(RegExp);
      expect(["fetch", "manual"]).toContain(r.access);
    }
  });
});

describe("readRegistryChecks", () => {
  const digest = {
    subject: "Jana Dvořáková",
    role: null,
    checks: [{ registry: "isir", status: "clear", searched: "Jana Dvořáková", source_url: "https://isir.justice.cz/x", hits: [], total: null, note: null }],
  };

  it("reads the latest cz_registries digest and skips malformed rows", () => {
    const rows = [
      { step: REGISTRY_STEP, ref_json: "{not json" },
      { step: "github_deep", ref_json: JSON.stringify({ digest: { handle: "x" } }) },
      { step: REGISTRY_STEP, ref_json: JSON.stringify({ digest }) },
      { step: REGISTRY_STEP, ref_json: JSON.stringify({ digest: { nope: true } }) },
    ];
    expect(readRegistryChecks(rows)?.checks[0]?.registry).toBe("isir");
    expect(readRegistryChecks([])).toBeNull();
  });
});

describe("registry addresses", () => {
  it("townOf keeps the municipality, never street, house number or postcode", () => {
    expect(townOf("Hrachov 77, 262 56  Svatý Jan")).toBe("Svatý Jan");
    expect(townOf("Dlouhá 123/4, Staré Město, 11000 Praha 1")).toBe("Praha 1");
    expect(townOf("Ostrožská Lhota 120")).toBe("Ostrožská Lhota");
    expect(townOf("Brno")).toBe("Brno");
    expect(townOf("Svatý Jan - Hrachov 77, okres Příbram, PSČ 26256")).toBe("Svatý Jan");
    expect(townOf("Dlouhá 5, Brno")).toBe("Brno");
    expect(townOf("č.p. 12")).toBeNull();
    expect(townOf("")).toBeNull();
    expect(townOf(undefined)).toBeNull();
  });

  it("redactHitLabel cuts stored ARES, public register, dental and notary lines to the town", () => {
    const ares = redactHitLabel("ares", "Josef Novák — IČO 12345678, Pobřežní 620/3, Karlín, 18600 Praha 8, since 2001-02-03");
    expect(ares).toBe("Josef Novák — IČO 12345678, Praha 8, since 2001-02-03");
    const or = redactHitLabel("justice-or", "Pavel Hlaváček, Hrachov 77, 262 56  Svatý Jan — člen statutárního orgánu at VLTAVA INVEST a.s. (IČO 27098613), file B 12345 vedená u Městského soudu v Praze, entered 1. ledna 2020");
    expect(or).toBe("Pavel Hlaváček, Svatý Jan — člen statutárního orgánu at VLTAVA INVEST a.s. (IČO 27098613), file B 12345 vedená u Městského soudu v Praze, entered 1. ledna 2020");
    expect(redactHitLabel("csk", "MUDr. Jan Novák — dentist, member of the Czech Dental Chamber, Dental Clinic, Dlouhá 5, 602 00 Brno")).toBe("MUDr. Jan Novák — dentist, member of the Czech Dental Chamber, Brno");
    expect(redactHitLabel("nkcr", "JUDr. Jan Novák — notary, Notářská komora v Brně, 602 00 Brno")).toBe("JUDr. Jan Novák — notary, Notářská komora v Brně, Brno");
    expect(redactHitLabel("ares", "Josef Novák — IČO 12345678, Praha 8, since 2001-02-03")).toBe("Josef Novák — IČO 12345678, Praha, since 2001-02-03");
    expect(redactHitLabel("police", "Jan Novák, born 1980 — wanted")).toBe("Jan Novák, born 1980 — wanted");
  });

  it("redacts the hit lines of a stored registry excerpt and the digest the state route reads", () => {
    const excerpt = "ARES business records (ARES — ekonomické subjekty) lists 1 record under the name Josef Novák; a namesake is possible:\n- Josef Novák — IČO 12345678, Pobřežní 620/3, 18600 Praha 8, since 2001-02-03 [active]";
    expect(redactRegistryExcerpt(excerpt)).not.toContain("Pobřežní");
    expect(redactRegistryExcerpt(excerpt)).toContain("- Josef Novák — IČO 12345678, Praha 8, since 2001-02-03 [active]");
    expect(redactRegistryExcerpt("LinkedIn profile, Pobřežní 620/3")).toBe("LinkedIn profile, Pobřežní 620/3");
    const hit = { label: "Josef Novák — IČO 12345678, Pobřežní 620/3, 18600 Praha 8, since 2001-02-03", url: "https://ares.gov.cz/x", status: "active", born: null, match: null };
    const digest = { subject: "Josef Novák", role: null, checks: [{ registry: "ares", status: "hits", searched: "Josef Novák", source_url: "https://ares.gov.cz/y", hits: [hit], total: 1, note: null }] };
    const read = readRegistryChecks([{ step: REGISTRY_STEP, ref_json: JSON.stringify({ digest }) }]);
    expect(read?.checks[0]?.hits[0]?.label).toBe("Josef Novák — IČO 12345678, Praha 8, since 2001-02-03");
  });
});
