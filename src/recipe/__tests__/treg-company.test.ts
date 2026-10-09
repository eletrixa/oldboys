/**
 * Tests for the treg company collector (The Companies API enrichment).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/treg-company.test.ts
 * Deps:    vitest
 * Tested:  src/recipe/sources/treg/company-enrich.ts
 *
 * Key responsibilities:
 * - Request shape (endpoint, method, params, cost cap) and the skip when the anchor is a place
 * - Parse of a payload shaped like the thecompaniesapi.companies.enrich catalog example, digest, malformed payloads
 *
 * Design constraints:
 * - No network: the fixture follows the catalog example response
 */
import { describe, expect, it } from "vitest";
import { tregCompanyEnrich } from "@/recipe/sources/treg/company-enrich";
import { baseContext } from "./fakes";

const step = { id: "x", kind: "actor" as const };
const ctx = baseContext({ goal: "due-diligence", role: null, roleFamily: null, subject: "Stripe", anchor: "https://www.stripe.com/en-cz" });

const record = {
  about: { name: "Stripe", nameLegal: "Stripe, Inc.", industry: "financial-services", totalEmployees: "1k-5k", totalEmployeesExact: 8000, yearFounded: 2010 },
  locations: { headquarters: { city: { name: "San Francisco" }, country: { name: "United States" } } },
  socials: { twitter: { url: "https://twitter.com/stripe" }, github: { url: "https://github.com/stripe" }, wellfound: { id: "x" } },
  domain: { domain: "stripe.com" },
  secondaries: { emailPatterns: [{ pattern: "[F]" }] },
};

describe("tregCompanyEnrich", () => {
  it("looks up the host of the anchor URL without www", () => {
    expect(tregCompanyEnrich.requests(ctx, step)).toEqual([
      { via: "treg", endpoint: "thecompaniesapi.companies.enrich", method: "GET", params: { domain: "stripe.com" }, maxCostUsd: 0.005 },
    ]);
  });

  it("skips when the anchor is a place, with a reason", () => {
    const place = baseContext({ goal: "due-diligence", anchor: "Brno" });
    expect(tregCompanyEnrich.requests(place, step)).toEqual([]);
    expect(tregCompanyEnrich.skipReason?.(place)).toBe("the anchor is not the company's website (no domain to look up)");
  });

  it("states the numbers in plain sentences on the company website", () => {
    const [s] = tregCompanyEnrich.parse(record, ctx, step);
    expect(s?.url).toBe("https://stripe.com/");
    expect(s?.excerpt).toBe(
      "Stripe (legal name Stripe, Inc.) is a financial services company, founded in 2010, with about 8000 employees, headquartered in San Francisco, United States. Read by The Companies API via treg.",
    );
    expect(JSON.stringify(s?.raw)).not.toContain("emailPatterns");
  });

  it("returns nothing for an empty or malformed payload", () => {
    expect(tregCompanyEnrich.parse({}, ctx, step)).toEqual([]);
    expect(tregCompanyEnrich.parse(null, ctx, step)).toEqual([]);
    expect(tregCompanyEnrich.parse("nope", ctx, step)).toEqual([]);
    expect(tregCompanyEnrich.parse({ about: { name: 5 } }, ctx, step)).toEqual([]);
  });

  it("digests employees, founding year, headquarters and social URLs", () => {
    const req = tregCompanyEnrich.requests(ctx, step)[0];
    if (req === undefined) throw new Error("no request");
    expect(tregCompanyEnrich.digest?.([{ req, payload: record }], ctx)).toEqual({
      provider: "thecompaniesapi",
      domain: "stripe.com",
      employees: 8000,
      founded: 2010,
      hq: "San Francisco, United States",
      socials: ["https://twitter.com/stripe", "https://github.com/stripe"],
    });
    expect(tregCompanyEnrich.digest?.([{ req, payload: {} }], ctx)).toBeNull();
  });
});
