/**
 * Tests for ARES parsing, the company draft and OrganizationInput.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/organization.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Real-shaped ARES payload, address assembly, name fallback, input normalisation and rejection
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { AresSubjekt, OrganizationInput, legalFormLabel, organizationFromAres } from "@/domain/organization";

const payload = {
  ico: "27074358",
  obchodniJmeno: "Asseco Central Europe, a.s.",
  dic: "CZ27074358",
  pravniForma: "112",
  datumVzniku: "2002-01-01",
  sidlo: {
    kodStatu: "CZ",
    nazevObce: "Praha",
    nazevUlice: "Budějovická",
    cisloDomovni: 778,
    cisloOrientacni: 3,
    psc: 14000,
    textovaAdresa: "Budějovická 778/3, Michle, 14000 Praha 4",
  },
};

describe("AresSubjekt / organizationFromAres", () => {
  it("parses a real-shaped payload and maps it", () => {
    const s = AresSubjekt.parse(payload);
    expect(organizationFromAres(s)).toEqual({
      name: "Asseco Central Europe, a.s.",
      ico: "27074358",
      dic: "CZ27074358",
      legal_form: "112",
      legal_form_label: "s.r.o.",
      address: "Budějovická 778/3, Michle, 14000 Praha 4",
      country: "CZ",
    });
  });
  it("assembles the address from parts when textovaAdresa is missing", () => {
    const { textovaAdresa: _t, ...sidlo } = payload.sidlo;
    const d = organizationFromAres(AresSubjekt.parse({ ...payload, sidlo }));
    expect(d.address).toBe("Budějovická 778/3, 14000 Praha");
  });
  it("falls back to the IČO as name and null address", () => {
    const d = organizationFromAres(AresSubjekt.parse({ ico: "27074358" }));
    expect(d.name).toBe("IČO 27074358");
    expect(d.address).toBeNull();
    expect(d.legal_form_label).toBeNull();
  });
  it("labels unknown legal forms with the raw code", () => {
    expect(legalFormLabel("999")).toBe("999");
    expect(legalFormLabel(null)).toBeNull();
  });
});

describe("OrganizationInput", () => {
  it("pads the ico, uppercases country and applies defaults", () => {
    const o = OrganizationInput.parse({ name: "Acme", ico: "6947", source: "manual", country: "de" });
    expect(o).toMatchObject({ ico: "00006947", country: "DE", dic: null, legal_form: null, address: null });
    expect(OrganizationInput.parse({ name: "Acme", source: "manual" })).toMatchObject({ ico: null, country: "CZ" });
  });
  it("rejects a bad checksum", () => {
    expect(OrganizationInput.safeParse({ name: "Acme", ico: "12345678", source: "manual" }).success).toBe(false);
  });
  it("rejects source ares without an ico", () => {
    expect(OrganizationInput.safeParse({ name: "Acme", source: "ares" }).success).toBe(false);
    expect(OrganizationInput.safeParse({ name: "Acme", ico: "27074358", source: "ares" }).success).toBe(true);
  });
});
