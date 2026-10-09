/**
 * Company record via treg: The Companies API enrichment of the due-diligence anchor website.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/company-enrich.ts
 * Deps:    zod, src/recipe/sources/types
 * Tested:  src/recipe/__tests__/treg-company.test.ts
 *
 * Key responsibilities:
 * - One `thecompaniesapi.companies.enrich` GET by `domain` (host of the anchor URL, `www.` stripped; $0.0019, capped at $0.005)
 * - One Source (the company website) whose excerpt states name, legal name, industry, founding year, employees and HQ in plain sentences
 * - Digest `{ provider, domain, employees, founded, hq, socials }` for the state route
 *
 * Design constraints:
 * - Pure: no fetch; identity from identityFor (the anchor site is not a candidate profile, so usually "unverified")
 * - Allow-list parse: about, headquarters city and country, social URLs, domain; nothing else of the 80+ datapoints
 * - Source URL is always https://<anchor host>/; the provider's domain.domain only feeds the digest (anchor host when absent)
 * - Documented fallbacks: employee range string when the exact count is missing, industries[0] when industry is missing
 * - A domain with no company behind it answers an empty object, parsed to no source
 */
import { z } from "zod";
import type { Collector, Fetched, ParsedSource, StepContext } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Named = z.object({ name: z.string().nullish() });
const Social = z.object({ url: z.string().nullish() });
const Company = z.object({
  about: z
    .object({
      name: z.string().nullish(),
      nameLegal: z.string().nullish(),
      industry: z.string().nullish(),
      industries: z.array(z.string()).nullish(),
      totalEmployees: z.string().nullish(),
      totalEmployeesExact: z.number().nullish(),
      yearFounded: z.number().nullish(),
    })
    .nullish(),
  locations: z.object({ headquarters: z.object({ city: Named.nullish(), country: Named.nullish() }).nullish() }).nullish(),
  socials: z.record(z.string(), Social.nullish()).nullish(),
  domain: z.object({ domain: z.string().nullish() }).nullish(),
});

function anchorDomain(anchor: string): string | null {
  try {
    const u = new URL(anchor);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

function read(payload: unknown, ctx: StepContext) {
  const r = Company.safeParse(payload);
  const name = r.success ? r.data.about?.name : undefined;
  if (!r.success || name === undefined || name === null || name === "") return null;
  const a = r.data.about;
  const hq = r.data.locations?.headquarters;
  const host = anchorDomain(ctx.anchor);
  if (host === null) return null;
  const place = [hq?.city?.name, hq?.country?.name].filter((x): x is string => x !== undefined && x !== null && x !== "");
  const socials = Object.values(r.data.socials ?? {})
    .map((s) => s?.url)
    .filter((u): u is string => u !== undefined && u !== null && /^https?:\/\//.test(u));
  return {
    name,
    legal: a?.nameLegal ?? null,
    industry: a?.industry ?? a?.industries?.[0] ?? null,
    founded: a?.yearFounded ?? null,
    employees: a?.totalEmployeesExact ?? null,
    range: a?.totalEmployees ?? null,
    hq: place.length > 0 ? place.join(", ") : null,
    socials,
    host,
    domain: r.data.domain?.domain ?? host,
  };
}

export const tregCompanyEnrich: Collector = {
  id: "treg/company-enrich",
  requests: (ctx) => {
    const domain = anchorDomain(ctx.anchor);
    if (domain === null) return [];
    return [{ via: "treg", endpoint: "thecompaniesapi.companies.enrich", method: "GET", params: { domain }, maxCostUsd: 0.005 }];
  },
  skipReason: () => "the anchor is not the company's website (no domain to look up)",
  parse: (payload, ctx): ParsedSource[] => {
    const c = read(payload, ctx);
    if (c === null) return [];
    const url = `https://${c.host}/`;
    const size = c.employees !== null ? `about ${String(c.employees)} employees` : c.range !== null ? `${c.range} employees` : null;
    const parts = [
      `${c.name}${c.legal !== null && c.legal !== c.name ? ` (legal name ${c.legal})` : ""} is ${c.industry !== null ? `a ${c.industry.replaceAll("-", " ")} company` : "a company"}`,
      c.founded !== null ? `founded in ${String(c.founded)}` : null,
      size !== null ? `with ${size}` : null,
      c.hq !== null ? `headquartered in ${c.hq}` : null,
    ].filter((p): p is string => p !== null);
    const [head = "", ...rest] = parts;
    const sentence = `${head}${rest.length > 0 ? `, ${rest.join(", ")}` : ""}. Read by The Companies API via treg.`;
    return [{ url, excerpt: clip(sentence), raw: c, identity: identityFor(ctx, url) }];
  },
  digest: (fetched: readonly Fetched[], ctx: StepContext) => {
    for (const f of fetched) {
      const c = read(f.payload, ctx);
      if (c !== null) return { provider: "thecompaniesapi", domain: c.domain, employees: c.employees, founded: c.founded, hq: c.hq, socials: c.socials };
    }
    return null;
  },
};
