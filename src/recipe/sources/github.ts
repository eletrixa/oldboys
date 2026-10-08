/**
 * GitHub REST collector: user profile, recent repos, or name search.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/github.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-makers.test.ts
 *
 * Key responsibilities:
 * - `rest/github`: accepted github candidate -> user + repos; otherwise user search by name
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Unauthenticated API (60 req/h); one to two requests per step
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { acceptedCandidates, clip } from "@/recipe/sources/types";

const User = z.object({
  login: z.string(),
  html_url: z.string(),
  name: z.string().nullish(),
  bio: z.string().nullish(),
  company: z.string().nullish(),
  location: z.string().nullish(),
  public_repos: z.number().optional(),
  followers: z.number().optional(),
  created_at: z.string().optional(),
});
const Repo = z.object({
  html_url: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  language: z.string().nullish(),
  stargazers_count: z.number().optional(),
  pushed_at: z.string().nullish(),
});
const Search = z.object({ items: z.array(z.object({ html_url: z.string(), login: z.string() })) });

const API = "https://api.github.com";

export const github: Collector = {
  id: "rest/github",
  requests: (ctx) => {
    const handle = acceptedCandidates(ctx).find(
      (c) => c.platform === "github" && typeof c.handle === "string" && c.handle.length > 0,
    )?.handle;
    if (typeof handle === "string") {
      const h = encodeURIComponent(handle);
      return [
        { via: "fetch", url: `${API}/users/${h}` },
        { via: "fetch", url: `${API}/users/${h}/repos?sort=updated&per_page=10` },
      ];
    }
    if (ctx.subject.trim().length === 0) return [];
    return [{ via: "fetch", url: `${API}/search/users?q=${encodeURIComponent(ctx.subject)}+in:name` }];
  },
  parse: (payload) => {
    const repos = z.array(Repo).safeParse(payload);
    if (repos.success) {
      return repos.data.map((r) => ({
        url: r.html_url,
        excerpt: clip(
          [r.name, r.description, r.language, `${String(r.stargazers_count ?? 0)} stars`, `pushed ${r.pushed_at ?? "?"}`]
            .filter((x): x is string => typeof x === "string" && x.length > 0)
            .join(" · "),
        ),
        raw: r,
      }));
    }
    const search = Search.safeParse(payload);
    if (search.success) return search.data.items.map((i) => ({ url: i.html_url, excerpt: clip(i.login), raw: i }));
    const user = User.safeParse(payload);
    if (user.success) {
      const u = user.data;
      const parts = [
        u.name ?? u.login,
        u.bio,
        u.company,
        u.location,
        u.public_repos === undefined ? null : `${String(u.public_repos)} public repos`,
        u.followers === undefined ? null : `${String(u.followers)} followers`,
        u.created_at === undefined ? null : `joined ${u.created_at}`,
      ];
      return [
        { url: u.html_url, excerpt: clip(parts.filter((x): x is string => typeof x === "string" && x.length > 0).join(" · ")), raw: u },
      ];
    }
    return [];
  },
};
