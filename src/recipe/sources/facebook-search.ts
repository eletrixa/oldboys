/**
 * Facebook people search via Apify `apify/facebook-search-scraper` (`searchType: "profiles"`): the profiles Facebook lists for the name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/facebook-search.ts
 * Deps:    zod, src/domain/corroborate (mentionsFullName), ./instagram-search (handleNamesSubject), ./text (lines)
 * Tested:  src/recipe/__tests__/sources-search.test.ts
 *
 * Key responsibilities:
 * - Runs before the lineup for every run that has no confirmed Facebook profile yet: one search, at most 5 results
 * - Lenient parse: a result is kept when it carries a facebook.com URL and a name that spells the candidate's full name
 *   (the actor's field names differ between pages and profiles: facebookUrl / pageUrl / url, title / name / pageName)
 * - The excerpt is the name, the profile's own intro lines (`info`, `intro`, `categories`, `address`) and the search note,
 *   so the lineup can match the anchor's city or a confirmed employer; identity stays "unverified"
 *
 * Design constraints:
 * - Pure: no fetch. Email and phone, which the actor also returns for pages, are never read into excerpt or raw
 * - Cost: $0.001 per run + $0.006 per result (actor pricing, 2026-10); capped at $0.04
 */
import { z } from "zod";
import { mentionsFullName } from "@/domain/corroborate";
import { handleNamesSubject } from "@/recipe/sources/instagram-search";
import { lines, txt } from "@/recipe/sources/text";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor, platformOf } from "@/recipe/sources/types";

const Str = z.string().nullish();
const Result = z.object({
  facebookUrl: Str,
  pageUrl: Str,
  url: Str,
  profileUrl: Str,
  title: Str,
  name: Str,
  pageName: Str,
  fullName: Str,
  info: z.array(z.string()).nullish().catch(null),
  intro: Str,
  about: Str,
  categories: z.array(z.string()).nullish().catch(null),
  address: Str,
  location: Str,
  followers: z.number().nullish().catch(null),
});

const first = (...v: (string | null | undefined)[]): string => v.find((x): x is string => typeof x === "string" && x.trim() !== "")?.trim() ?? "";

export const facebookSearch: Collector = {
  id: "apify/facebook-search-scraper",
  requests: (ctx) => {
    if (ctx.subject.trim() === "") return [];
    if (ctx.candidates.some((c) => c.platform === "facebook" && c.decision === "merge")) return [];
    return [
      {
        via: "actor",
        actor: "apify/facebook-search-scraper",
        input: { categories: [ctx.subject.trim()], searchType: "profiles", resultsLimit: 5 },
        maxTotalChargeUsd: 0.04,
        timeoutSecs: 90,
      },
    ];
  },
  skipReason: (ctx) => (ctx.subject.trim() === "" ? "no name to search" : "a Facebook profile is already confirmed (given profile or CV)"),
  parse: (payload, ctx) => {
    const items = z.array(z.unknown()).safeParse(payload);
    if (!items.success) return [];
    const seen = new Set<string>();
    return items.data.flatMap((raw) => {
      const r = Result.safeParse(raw);
      if (!r.success) return [];
      const p = r.data;
      const url = first(p.facebookUrl, p.pageUrl, p.profileUrl, p.url);
      const name = first(p.title, p.name, p.fullName, p.pageName).split(" | ")[0]?.trim() ?? "";
      if (url === "" || platformOf(url) !== "facebook" || seen.has(url)) return [];
      const handle = new URL(url).pathname.split("/").find((seg) => seg !== "") ?? "";
      if (!mentionsFullName(ctx.subject, name) && !handleNamesSubject(ctx.subject, handle)) return [];
      seen.add(url);
      const info = [...(p.info ?? []), p.intro ?? "", p.about ?? ""].filter((l) => l.trim() !== "");
      const excerpt = clip(
        lines([
          name === "" ? handle : name,
          ...info,
          (p.categories ?? []).length === 0 ? "" : `Categories: ${txt(p.categories ?? [])}`,
          first(p.address, p.location) === "" ? "" : `Location: ${first(p.address, p.location).split(" https://")[0] ?? ""}`,
          p.followers === null || p.followers === undefined ? "" : `Followers: ${String(p.followers)}`,
          `Found by Facebook people search for "${ctx.subject}"`,
        ]),
      );
      return [{ url, excerpt, raw: { url, name, info, categories: p.categories ?? [], address: first(p.address, p.location) }, identity: identityFor(ctx, url) }];
    });
  },
};
