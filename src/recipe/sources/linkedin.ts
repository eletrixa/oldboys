/**
 * LinkedIn profile collectors: harvestapi/linkedin-profile-scraper (primary) and apimaestro/linkedin-profile-detail (fallback).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/linkedin.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-web.test.ts, src/recipe/__tests__/identity-corroboration.test.ts (experienceCompanies)
 *
 * Key responsibilities:
 * - Request all candidate LinkedIn URLs in one actor run; parse each profile into one Source
 * - `harvestRequest` / `harvestProfiles`: shared with the seed seam (plans/006), which scrapes the manager's profile URL first
 * - Never scrape a URL twice: profiles already fetched at seed are skipped and reported via `alreadyFetched`
 * - `experienceCompanies`: company names back out of a profile excerpt's experience lines (employer corroboration)
 * - `employerPages`: the current employer's LinkedIn company URL, written as an "Employer page:" excerpt line by the
 *   harvest parse and read back by the hiring `employer_company` step
 * - `digest`: the merged profiles' ProfileFacts (`harvestFacts`: followers, connections, verified, premium, open-to-work, photo, earliest experience year)
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Input fields verified against https://apify.com/harvestapi/linkedin-profile-scraper/input-schema and https://apify.com/apimaestro/linkedin-profile-detail.md
 */
import { z } from "zod";
import type { Source } from "@/domain/claim";
import { clipBio, emptyFacts, experienceYear, type ProfileFacts } from "@/domain/profile-facts";
import { normalizeLinkedinProfile } from "@/domain/profile-url";
import { count, digestOf } from "@/recipe/sources/facts";
import { lines, txt } from "@/recipe/sources/text";
import type { Collector, CollectorRequest, StepContext } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const MODE = "Profile details no email ($4 per 1k)";
export const HARVEST_ACTOR = "harvestapi/linkedin-profile-scraper";

/** Merged LinkedIn profile sources already in the run (the seed step scraped the manager's profile URL). */
function fetchedSources(ctx: StepContext): Source[] {
  return ctx.sources.filter((s) => s.identity === "merged" && s.actor === HARVEST_ACTOR);
}

function linkedinUrls(ctx: StepContext): string[] {
  const fetched = new Set(fetchedSources(ctx).map((s) => normalizeLinkedinProfile(s.url)));
  const urls = ctx.candidates
    .filter((c) => c.platform === "linkedin" && (c.decision === "merge" || c.decision === "possibly-same-as"))
    .flatMap((c) => c.profile_urls.filter((u) => u.includes("linkedin.com/in/") && !fetched.has(normalizeLinkedinProfile(u))));
  return [...new Set(urls)];
}

export function harvestRequest(urls: string[]): Extract<CollectorRequest, { via: "actor" }> {
  return { via: "actor", actor: HARVEST_ACTOR, input: { urls, profileScraperMode: MODE }, maxTotalChargeUsd: 0.05, timeoutSecs: 45 };
}

const Loose = z.unknown().optional();

const HarvestProfile = z.object({
  linkedinUrl: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  headline: z.string().optional(),
  location: Loose,
  experience: z
    .array(z.object({ position: Loose, title: Loose, companyName: Loose, companyLinkedinUrl: Loose, startDate: Loose, endDate: Loose, duration: Loose }))
    .default([]),
  education: z.array(z.object({ schoolName: Loose, school: Loose, degree: Loose, fieldOfStudy: Loose, field: Loose })).default([]),
  skills: z.array(z.unknown()).default([]),
  photo: z.string().nullish(),
  verified: z.boolean().nullish(),
  premium: z.boolean().nullish(),
  openToWork: z.boolean().nullish(),
  connectionsCount: z.number().nullish(),
  followerCount: z.number().nullish(),
  about: z.string().nullish(),
});
export type HarvestProfile = z.infer<typeof HarvestProfile>;

/** The public numbers and flags of one harvestapi profile (the seed seam and the linkedin_profile digest share it). */
export function harvestFacts(p: HarvestProfile): ProfileFacts {
  const f = emptyFacts("linkedin", p.linkedinUrl, p.linkedinUrl);
  f.handle = /\/in\/([^/?#]+)/.exec(p.linkedinUrl)?.[1] ?? null;
  f.display_name = [p.firstName, p.lastName].filter(Boolean).join(" ") || null;
  f.bio = clipBio(p.headline);
  f.connections = count(p.connectionsCount);
  f.followers = count(p.followerCount);
  f.verified = p.verified ?? null;
  f.premium = p.premium ?? null;
  f.open_to_work = p.openToWork ?? null;
  f.photo_url = p.photo ?? null;
  f.earliest_experience_year = experienceYear(p.experience.map((e) => e.startDate));
  return f;
}

function expLine(title: unknown, company: unknown, start: unknown, end: unknown): string {
  const s = txt(start);
  const e = txt(end);
  const span = s || e ? ` (${s}–${e})` : "";
  return `${txt(title)} @ ${txt(company)}${span}`;
}

/** Actors whose excerpt is a parsed LinkedIn profile (experience lines built by expLine). */
export const LINKEDIN_PROFILE_ACTORS: ReadonlySet<string> = new Set([HARVEST_ACTOR, "apimaestro/linkedin-profile-detail"]);

/**
 * Company names from a profile excerpt: "Title @ Company (start–end)", "Current: Title @ Company", and the
 * apimaestro "Current: Company" line. Deduped, in order; empty companies dropped.
 */
export function experienceCompanies(excerpt: string): string[] {
  const out = excerpt.split("\n").flatMap((raw) => {
    const line = raw.trim();
    const at = line.lastIndexOf(" @ ");
    if (at >= 0) return [line.slice(at + 3).replace(/\s*\([^()]*\)$/, "").trim()];
    return line.startsWith("Current: ") ? [line.slice("Current: ".length).trim()] : [];
  });
  return [...new Set(out.filter((c) => c !== ""))];
}

const EMPLOYER_PAGE = "Employer page: ";

/** Current employers' LinkedIn company URLs from merged LinkedIn profile excerpts (the confirmed profile links them). */
export function employerPages(sources: readonly Source[]): string[] {
  const pages = sources
    .filter((s) => s.identity === "merged" && LINKEDIN_PROFILE_ACTORS.has(s.actor))
    .flatMap((s) => s.excerpt.split("\n").filter((l) => l.startsWith(EMPLOYER_PAGE)).map((l) => l.slice(EMPLOYER_PAGE.length).trim()));
  return [...new Set(pages)];
}

function eduLine(school: unknown, degree: unknown, field: unknown): string {
  return [txt(school), txt(degree), txt(field)].filter(Boolean).join(", ");
}

export type HarvestParsed = {
  url: string;
  excerpt: string;
  raw: HarvestProfile;
  name: string;
  headline: string;
  location: string;
  employer: string;
};

/** Lenient parse of harvestapi items into excerpt plus the identity fields the seed step needs. */
export function harvestProfiles(payload: unknown): HarvestParsed[] {
  const items = z.array(HarvestProfile).safeParse(payload);
  if (!items.success) return [];
  return items.data.map((p) => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
    const cur = p.experience[0];
    const current = cur ? `Current: ${expLine(cur.position ?? cur.title, cur.companyName, "", "")}` : "";
    const page = txt(cur?.companyLinkedinUrl);
    const employerPage = page.includes("linkedin.com/company/") ? `${EMPLOYER_PAGE}${page}` : "";
    const exp = p.experience.slice(0, 5).map((x) => expLine(x.position ?? x.title, x.companyName, x.startDate, x.endDate));
    const edu = p.education.slice(0, 3).map((x) => eduLine(x.schoolName ?? x.school, x.degree, x.fieldOfStudy ?? x.field));
    const location = txt(p.location);
    return {
      url: p.linkedinUrl,
      excerpt: clip(lines([name, p.headline ?? "", location, current, employerPage, ...exp, ...edu, `Skills: ${String(p.skills.length)}`])),
      raw: p,
      name,
      headline: p.headline?.trim() ?? "",
      location,
      employer: cur ? txt(cur.companyName) : "",
    };
  });
}

export const linkedinProfile: Collector = {
  id: HARVEST_ACTOR,
  requests: (ctx) => {
    const urls = linkedinUrls(ctx);
    return urls.length === 0 ? [] : [harvestRequest(urls)];
  },
  alreadyFetched: fetchedSources,
  parse: (payload, ctx) => harvestProfiles(payload).map((p) => ({ url: p.url, excerpt: p.excerpt, raw: p.raw, identity: identityFor(ctx, p.url) })),
  digest: (fetched, ctx) => factsOf(fetched.map((f) => f.payload), ctx),
};

export function factsOf(payloads: readonly unknown[], ctx: StepContext): ProfileFacts[] | null {
  return digestOf(payloads.flatMap((pl) => harvestProfiles(pl)).filter((p) => identityFor(ctx, p.url) === "merged").map((p) => harvestFacts(p.raw)));
}

const MaestroProfile = z.object({
  basic_info: z
    .object({ fullname: z.string().optional(), headline: z.string().optional(), location: Loose, profile_url: z.string().optional(), public_identifier: z.string().optional(), current_company: Loose })
    .default({}),
  experience: z.array(z.object({ title: Loose, company: Loose, start_date: Loose, end_date: Loose, is_current: z.boolean().optional() })).default([]),
  education: z.array(z.object({ school: Loose, degree: Loose, field_of_study: Loose })).default([]),
});

export const linkedinProfileDetail: Collector = {
  id: "apimaestro/linkedin-profile-detail",
  // One profile per run: the actor takes a single `username`.
  requests: (ctx) =>
    linkedinUrls(ctx)
      .slice(0, 3)
      .map((url) => ({
        via: "actor" as const,
        actor: "apimaestro/linkedin-profile-detail",
        input: { username: url, includeEmail: false },
        maxTotalChargeUsd: 0.05,
        timeoutSecs: 45,
      })),
  parse: (payload, ctx) => {
    const items = z.array(MaestroProfile).safeParse(payload);
    if (!items.success) return [];
    return items.data.flatMap((p) => {
      const b = p.basic_info;
      const url = b.profile_url ?? (b.public_identifier === undefined ? "" : `https://www.linkedin.com/in/${b.public_identifier}`);
      if (!url) return [];
      const exp = p.experience.slice(0, 5).map((x) => expLine(x.title, x.company, x.start_date, x.is_current === true ? "present" : x.end_date));
      const edu = p.education.slice(0, 3).map((x) => eduLine(x.school, x.degree, x.field_of_study));
      const current = txt(b.current_company) ? `Current: ${txt(b.current_company)}` : "";
      return [{ url, excerpt: clip(lines([b.fullname ?? "", b.headline ?? "", txt(b.location), current, ...exp, ...edu])), raw: p, identity: identityFor(ctx, url) }];
    });
  },
};
