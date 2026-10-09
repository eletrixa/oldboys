/**
 * Personal website collector: crawls the subject's own site (domain = their name) via apify/website-content-crawler.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/personal-site.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/personal-site.test.ts
 *
 * Key responsibilities:
 * - personalDomains(): hosts among the run's URLs whose registrable label is the subject's name (diacritics stripped,
 *   separators removed, parts in any order: robertvojacek.cz, vojacek-robert.com); www ignored; at most PERSONAL_SITE_MAX
 * - One actor run per domain (each a paid run under RUN_BUDGET_CALLS); one Source per crawled page, identity "merged":
 *   a site named after the person is their own writing (OWN_WRITING in profile-gate reads it by PERSONAL_SITE_ACTOR)
 * - PERSONAL_SITE_ACTOR: the Source.actor label; the request still calls the real actor apify/website-content-crawler
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Employer or product domains (revolt.bi) never match: the label must equal the full name, nothing else
 */
import { z } from "zod";
import type { Collector, StepContext } from "@/recipe/sources/types";
import { acceptedCandidates, clip } from "@/recipe/sources/types";

export const PERSONAL_SITE_ACTOR = "apify/website-content-crawler#personal-site";
/** identity_reason written on the step's sources after the lineup (resolve.ts sourceIdentityUpdates). */
export const PERSONAL_SITE_REASON = "Personal website: the domain is the subject's name";
export const PERSONAL_SITE_MAX = 2;
const MAX_PAGES = 6;

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function permutations(parts: readonly string[]): string[] {
  if (parts.length <= 1) return [...parts];
  return parts.flatMap((p, i) => permutations([...parts.slice(0, i), ...parts.slice(i + 1)]).map((rest) => p + rest));
}

/** Hosts (www stripped, lowercase) whose label left of the TLD equals the subject's name parts in any order; first PERSONAL_SITE_MAX, in input order. */
export function personalDomains(subject: string, urls: readonly string[]): string[] {
  const parts = fold(subject).split(/[\s\-.]+/).filter((p) => p.length > 0);
  if (parts.length < 2) return [];
  const names = new Set(permutations(parts));
  const out: string[] = [];
  for (const u of urls) {
    let host = "";
    try {
      host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    const labels = host.split(".");
    if (labels.length < 2 || out.includes(host)) continue;
    if (labels.slice(0, -1).some((l) => names.has(l.replaceAll("-", "")))) out.push(host);
    if (out.length === PERSONAL_SITE_MAX) break;
  }
  return out;
}

function domains(ctx: StepContext): string[] {
  const fromCandidates = acceptedCandidates(ctx)
    .filter((c) => c.platform === "web")
    .flatMap((c) => c.profile_urls);
  return personalDomains(ctx.subject, [...fromCandidates, ...ctx.sources.map((s) => s.url)]);
}

const Page = z.object({ url: z.string(), text: z.string().default(""), metadata: z.object({ title: z.string().optional() }).default({}) });

export const personalSite: Collector = {
  id: PERSONAL_SITE_ACTOR,
  requests: (ctx) =>
    domains(ctx).map((host) => ({
      via: "actor",
      actor: "apify/website-content-crawler",
      input: { startUrls: [{ url: `https://${host}/` }], maxCrawlPages: MAX_PAGES, maxCrawlDepth: 1, saveMarkdown: false, crawlerType: "cheerio" },
      maxTotalChargeUsd: 0.05,
      timeoutSecs: 45,
    })),
  skipReason: () => "no website whose domain is the subject's name among the hits",
  parse: (payload) => {
    const pages = z.array(Page).safeParse(payload);
    if (!pages.success) return [];
    return pages.data.map((p) => ({ url: p.url, excerpt: clip(`${p.metadata.title ?? ""}\n${p.text.slice(0, 1800)}`.trim()), raw: p, identity: "merged" as const }));
  },
};
