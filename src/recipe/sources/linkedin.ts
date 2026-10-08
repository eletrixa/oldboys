/**
 * LinkedIn profile collectors: harvestapi/linkedin-profile-scraper (primary) and apimaestro/linkedin-profile-detail (fallback).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/linkedin.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-web.test.ts
 *
 * Key responsibilities:
 * - Request all candidate LinkedIn URLs in one actor run; parse each profile into one Source
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Input fields verified against https://apify.com/harvestapi/linkedin-profile-scraper/input-schema and https://apify.com/apimaestro/linkedin-profile-detail.md
 */
import { z } from "zod";
import { lines, txt } from "@/recipe/sources/text";
import type { Collector, StepContext } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const MODE = "Profile details no email ($4 per 1k)";

function linkedinUrls(ctx: StepContext): string[] {
  const urls = ctx.candidates
    .filter((c) => c.platform === "linkedin" && (c.decision === "merge" || c.decision === "possibly-same-as"))
    .flatMap((c) => c.profile_urls.filter((u) => u.includes("linkedin.com/in/")));
  return [...new Set(urls)];
}

const Loose = z.unknown().optional();

const HarvestProfile = z.object({
  linkedinUrl: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  headline: z.string().optional(),
  location: Loose,
  experience: z.array(z.object({ position: Loose, title: Loose, companyName: Loose, startDate: Loose, endDate: Loose, duration: Loose })).default([]),
  education: z.array(z.object({ schoolName: Loose, school: Loose, degree: Loose, fieldOfStudy: Loose, field: Loose })).default([]),
  skills: z.array(z.unknown()).default([]),
});

function expLine(title: unknown, company: unknown, start: unknown, end: unknown): string {
  const s = txt(start);
  const e = txt(end);
  const span = s || e ? ` (${s}–${e})` : "";
  return `${txt(title)} @ ${txt(company)}${span}`;
}

function eduLine(school: unknown, degree: unknown, field: unknown): string {
  return [txt(school), txt(degree), txt(field)].filter(Boolean).join(", ");
}

export const linkedinProfile: Collector = {
  id: "harvestapi/linkedin-profile-scraper",
  requests: (ctx) => {
    const urls = linkedinUrls(ctx);
    if (urls.length === 0) return [];
    return [
      {
        via: "actor",
        actor: "harvestapi/linkedin-profile-scraper",
        input: { urls, profileScraperMode: MODE },
        maxTotalChargeUsd: 0.05,
        timeoutSecs: 45,
      },
    ];
  },
  parse: (payload) => {
    const items = z.array(HarvestProfile).safeParse(payload);
    if (!items.success) return [];
    return items.data.map((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
      const cur = p.experience[0];
      const current = cur ? `Current: ${expLine(cur.position ?? cur.title, cur.companyName, "", "")}` : "";
      const exp = p.experience.slice(0, 5).map((x) => expLine(x.position ?? x.title, x.companyName, x.startDate, x.endDate));
      const edu = p.education.slice(0, 3).map((x) => eduLine(x.schoolName ?? x.school, x.degree, x.fieldOfStudy ?? x.field));
      return {
        url: p.linkedinUrl,
        excerpt: clip(lines([name, p.headline ?? "", txt(p.location), current, ...exp, ...edu, `Skills: ${String(p.skills.length)}`])),
        raw: p,
      };
    });
  },
};

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
  parse: (payload) => {
    const items = z.array(MaestroProfile).safeParse(payload);
    if (!items.success) return [];
    return items.data.flatMap((p) => {
      const b = p.basic_info;
      const url = b.profile_url ?? (b.public_identifier === undefined ? "" : `https://www.linkedin.com/in/${b.public_identifier}`);
      if (!url) return [];
      const exp = p.experience.slice(0, 5).map((x) => expLine(x.title, x.company, x.start_date, x.is_current === true ? "present" : x.end_date));
      const edu = p.education.slice(0, 3).map((x) => eduLine(x.school, x.degree, x.field_of_study));
      const current = txt(b.current_company) ? `Current: ${txt(b.current_company)}` : "";
      return [{ url, excerpt: clip(lines([b.fullname ?? "", b.headline ?? "", txt(b.location), current, ...exp, ...edu])), raw: p }];
    });
  },
};
