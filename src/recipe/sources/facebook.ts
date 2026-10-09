/**
 * Facebook page collector via Apify `apify/facebook-pages-scraper` (public pages, about $0.012 per page).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/facebook.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-posts.test.ts
 *
 * Key responsibilities:
 * - Request the facebook.com URLs of merged facebook candidates (at most 2); one Source per page
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Public page fields only: title, categories, intro, followers, website, creation date; never email or phone,
 *   which the actor also returns
 * - Input fields verified against https://api.apify.com/v2/acts/apify~facebook-pages-scraper (startUrls, required)
 */
import { z } from "zod";
import { lines, txt } from "@/recipe/sources/text";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor, platformOf } from "@/recipe/sources/types";

const Page = z.object({
  facebookUrl: z.string(),
  title: z.string().nullish(),
  categories: z.array(z.string()).nullish(),
  intro: z.string().nullish(),
  followers: z.number().nullish(),
  website: z.string().nullish(),
  creation_date: z.string().nullish(),
});

export const facebookPage: Collector = {
  id: "apify/facebook-pages-scraper",
  requests: (ctx) => {
    const urls = ctx.candidates
      .filter((c) => c.platform === "facebook" && c.decision === "merge")
      .flatMap((c) => c.profile_urls.filter((u) => platformOf(u) === "facebook"));
    const start = [...new Set(urls)].slice(0, 2);
    if (start.length === 0) return [];
    return [{ via: "actor", actor: "apify/facebook-pages-scraper", input: { startUrls: start.map((url) => ({ url })) }, maxTotalChargeUsd: 0.03, timeoutSecs: 45 }];
  },
  parse: (payload, ctx) => {
    const items = z.array(Page).safeParse(payload);
    if (!items.success) return [];
    return items.data.map((p) => ({
      url: p.facebookUrl,
      excerpt: clip(
        lines([
          p.title ?? "",
          `Categories: ${txt(p.categories ?? [])}`,
          p.intro ?? "",
          `Followers: ${String(p.followers ?? "?")}`,
          (p.website ?? "") === "" ? "" : `Website: ${p.website ?? ""}`,
          (p.creation_date ?? "") === "" ? "" : `Created: ${p.creation_date ?? ""}`,
        ]),
      ),
      raw: { facebookUrl: p.facebookUrl, title: p.title, categories: p.categories, intro: p.intro, followers: p.followers, website: p.website },
      identity: identityFor(ctx, p.facebookUrl),
    }));
  },
};
