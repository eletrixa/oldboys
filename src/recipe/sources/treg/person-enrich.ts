/**
 * Apollo people enrichment via treg: the other social accounts Apollo links to the confirmed LinkedIn profile.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/person-enrich.ts
 * Deps:    zod, src/domain/url (httpUrl), src/recipe/seams/resolve (canonicalProfile), src/recipe/sources/text (txt), src/recipe/sources/types
 * Tested:  src/recipe/__tests__/treg-search.test.ts
 *
 * Key responsibilities:
 * - Runs before the lineup, only when a LinkedIn profile is merged (the given profile): one `apollo.people.enrich`
 *   call with that URL (cost $0.026, capped at $0.03)
 * - One Source per twitter / github / facebook URL Apollo lists: canonical profile URL (`canonicalProfile`; group, share and root links without a handle are dropped), excerpt line 1 `<Name> – <headline>`,
 *   then a line carrying the confirmed LinkedIn URL literally, so the lineup's cross-link rule corroborates the hit
 * - Digest: provider, LinkedIn URL, accounts found, employer and title
 *
 * Design constraints:
 * - Pure: no fetch; identity stays "unverified" (a provider's link alone never merges)
 * - Allow-list parse: no emails, phones, personal_* or demographic fields reach `raw`; reveal_* flags are never sent
 */
import { z } from "zod";
import { httpUrl } from "@/domain/url";
import { canonicalProfile } from "@/recipe/seams/resolve";
import { txt } from "@/recipe/sources/text";
import type { Collector, Fetched, ParsedSource, StepContext } from "@/recipe/sources/types";
import { acceptedCandidates, clip, identityFor, platformOf } from "@/recipe/sources/types";

const Job = z.object({
  title: z.string().nullish(),
  organization_name: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});
const Person = z.object({
  name: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  headline: z.string().nullish(),
  title: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  twitter_url: z.string().nullish(),
  github_url: z.string().nullish(),
  facebook_url: z.string().nullish(),
  photo_url: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  organization: z.object({ name: z.string().nullish() }).nullish(),
  employment_history: z.array(Job).nullish(),
});
const Payload = z.object({ person: Person.nullish() });
type PersonRecord = z.infer<typeof Person>;

/** The first linkedin.com/in/ profile URL of a merged LinkedIn candidate, or null. */
function confirmedLinkedin(ctx: StepContext): string | null {
  for (const c of acceptedCandidates(ctx)) {
    if (c.platform !== "linkedin") continue;
    const url = c.profile_urls.find((u) => /linkedin\.com\/in\//i.test(u));
    if (url !== undefined) return url;
  }
  return null;
}

/** Canonical profile URL: social hosts via `canonicalProfile` (null without a handle: groups, shares, root); other hosts as given minus query, fragment and trailing slash; null when not http(s). */
function socialUrl(raw: string): string | null {
  const url = httpUrl(raw.trim());
  if (url === null) return null;
  if (platformOf(url) !== "web") {
    const c = canonicalProfile(url);
    return c.handle === null ? null : c.url;
  }
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

function personOf(payload: unknown): PersonRecord | null {
  const r = Payload.safeParse(payload);
  return r.success ? (r.data.person ?? null) : null;
}

function socialUrls(p: PersonRecord): string[] {
  const urls = [p.twitter_url, p.github_url, p.facebook_url].map((u) => socialUrl(txt(u))).filter((u): u is string => u !== null);
  return [...new Set(urls)];
}

function fullName(p: PersonRecord, ctx: StepContext): string {
  const joined = `${txt(p.first_name)} ${txt(p.last_name)}`.trim();
  return txt(p.name) || joined || ctx.subject.trim();
}

/** `<title> @ <org>` or whichever part exists; "" when neither. */
function titleAtOrg(title: string, org: string): string {
  return [title, org].filter((s) => s !== "").join(" @ ");
}

/** Excerpt lines: name – headline, the literal confirmed LinkedIn URL (cross-link rule), current job, place, up to 5 history entries. */
function excerptLines(p: PersonRecord, linkedin: string, ctx: StepContext): string[] {
  const org = txt(p.organization?.name);
  const title = txt(p.title);
  const headline = txt(p.headline) || (title === "" ? "" : titleAtOrg(title, org)); // an org alone is no headline
  const place = [txt(p.city), txt(p.country)].filter((s) => s !== "").join(", ");
  const history = (p.employment_history ?? [])
    .filter((j) => txt(j.title) !== "" || txt(j.organization_name) !== "")
    .slice(0, 5)
    .map((j) => `${txt(j.title)} @ ${txt(j.organization_name)} (${txt(j.start_date)}–${txt(j.end_date) || "now"})`);
  const lines = [
    headline === "" ? fullName(p, ctx) : `${fullName(p, ctx)} – ${headline}`,
    `Linked from the confirmed LinkedIn profile ${linkedin} by Apollo people enrichment via treg`,
    title === "" ? "" : `Current: ${title}${org === "" ? "" : ` at ${org}`}`,
    place === "" ? "" : `Location: ${place}`,
    ...history,
  ];
  return lines.filter((l) => l !== "");
}

export const tregPersonEnrich: Collector = {
  id: "treg/person-enrich",
  requests: (ctx) => {
    const url = confirmedLinkedin(ctx);
    if (url === null) return [];
    return [{ via: "treg", endpoint: "apollo.people.enrich", method: "POST", params: { linkedin_url: url }, maxCostUsd: 0.03 }];
  },
  skipReason: () => "no confirmed LinkedIn profile to enrich",
  parse: (payload, ctx) => {
    const p = personOf(payload);
    const linkedin = confirmedLinkedin(ctx);
    if (p === null || linkedin === null) return [];
    const excerpt = clip(excerptLines(p, linkedin, ctx).join("\n"));
    return socialUrls(p).map((url): ParsedSource => ({ url, excerpt, raw: p, identity: identityFor(ctx, url) }));
  },
  digest: (fetched: readonly Fetched[], ctx) => {
    const linkedin = confirmedLinkedin(ctx);
    for (const { payload } of fetched) {
      const p = personOf(payload);
      if (p === null) continue;
      const found = socialUrls(p).map((url) => ({ platform: platformOf(url), url }));
      if (found.length === 0) continue;
      return { provider: "apollo", linkedin_url: linkedin, found, employer: txt(p.organization?.name) || null, title: txt(p.title) || null };
    }
    return null;
  },
};
