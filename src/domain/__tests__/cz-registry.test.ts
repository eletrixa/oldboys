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
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { readRegistryChecks, REGISTRIES, registriesFor, REGISTRY_STEP } from "@/domain/cz-registry";

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
