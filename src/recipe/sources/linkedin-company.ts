/**
 * LinkedIn company collector via harvestapi/linkedin-company (apify/linkedin-company-scraper does not exist).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/linkedin-company.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-web.test.ts
 *
 * Key responsibilities:
 * - Due-diligence: company URLs from known sources, else a name search; one Source per company
 * - Hiring (`employer_company`): only the current employer's company page that a merged LinkedIn profile links
 *   ("Employer page:" line); that page is "merged" because the confirmed profile names it, never by name search
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Input fields verified against https://apify.com/harvestapi/linkedin-company.md (apify/linkedin-company-scraper returned 404)
 */
import { z } from "zod";
import { canonicalUrl } from "@/domain/url";
import { employerPages } from "@/recipe/sources/linkedin";
import { lines, txt } from "@/recipe/sources/text";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Loose = z.unknown().optional();

const Company = z.object({
  linkedinUrl: z.string(),
  name: z.string().optional(),
  industries: Loose,
  employeeCount: Loose,
  employeeCountRange: Loose,
  foundedOn: Loose,
  description: z.string().optional(),
  website: z.string().optional(),
  locations: z.array(z.object({ parsed: Loose, headquarter: z.boolean().optional() })).default([]),
});

export const linkedinCompany: Collector = {
  id: "harvestapi/linkedin-company",
  requests: (ctx) => {
    if (ctx.goal === "hiring") {
      const pages = employerPages(ctx.sources).slice(0, 2);
      return pages.length === 0 ? [] : [{ via: "actor", actor: "harvestapi/linkedin-company", input: { companies: pages }, maxTotalChargeUsd: 0.05, timeoutSecs: 45 }];
    }
    const urls = [...new Set(ctx.sources.map((s) => s.url).filter((u) => u.includes("linkedin.com/company/")))].slice(0, 3);
    const input = urls.length > 0 ? { companies: urls } : { searches: [ctx.subject] };
    return [{ via: "actor", actor: "harvestapi/linkedin-company", input, maxTotalChargeUsd: 0.05, timeoutSecs: 45 }];
  },
  parse: (payload, ctx) => {
    const items = z.array(Company).safeParse(payload);
    if (!items.success) return [];
    const linked = new Set(employerPages(ctx.sources).map(canonicalUrl));
    return items.data.map((c) => {
      const hq = c.locations.find((l) => l.headquarter === true);
      const size = txt(c.employeeCountRange) || txt(c.employeeCount);
      return {
        url: c.linkedinUrl,
        excerpt: clip(
          lines([
            c.name ?? "",
            `Industry: ${txt(c.industries)}`,
            `Size: ${size}`,
            `HQ: ${txt(hq?.parsed)}`,
            `Founded: ${txt(c.foundedOn)}`,
            c.website !== undefined && c.website !== "" ? `Website: ${c.website}` : "",
            (c.description ?? "").slice(0, 600),
          ]),
        ),
        raw: c,
        identity: linked.has(canonicalUrl(c.linkedinUrl)) ? ("merged" as const) : identityFor(ctx, c.linkedinUrl),
      };
    });
  },
};
