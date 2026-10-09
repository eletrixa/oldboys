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
 * - A forked repo's excerpt carries FORK_MARK ("forked repository") so verify can challenge it without a model
 * - `digest`: the merged user's ProfileFacts (created_at, followers, following, bio, avatar)
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Unauthenticated API (60 req/h); one to two requests per step
 */
import { z } from "zod";
import { clipBio, emptyFacts, type ProfileFacts } from "@/domain/profile-facts";
import { count, digestOf } from "@/recipe/sources/facts";
import type { Collector, StepContext } from "@/recipe/sources/types";
import { acceptedCandidates, clip, identityFor } from "@/recipe/sources/types";

const User = z.object({
  login: z.string(),
  html_url: z.string(),
  name: z.string().nullish(),
  bio: z.string().nullish(),
  company: z.string().nullish(),
  location: z.string().nullish(),
  public_repos: z.number().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  avatar_url: z.string().optional(),
  created_at: z.string().optional(),
});
const Repo = z.object({
  html_url: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  language: z.string().nullish(),
  stargazers_count: z.number().optional(),
  pushed_at: z.string().nullish(),
  fork: z.boolean().optional(),
});
const Search = z.object({ items: z.array(z.object({ html_url: z.string(), login: z.string() })) });

const API = "https://api.github.com";
/** In a repo excerpt: the devil's advocate (src/domain/challenge forkPrecheck) never counts a fork as own work. */
export const FORK_MARK = "forked repository";

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
  parse: (payload, ctx) => {
    const repos = z.array(Repo).safeParse(payload);
    if (repos.success) {
      return repos.data.map((r) => ({
        url: r.html_url,
        excerpt: clip(
          [r.name, r.fork === true ? FORK_MARK : null, r.description, r.language, `${String(r.stargazers_count ?? 0)} stars`, `pushed ${r.pushed_at ?? "?"}`]
            .filter((x): x is string => typeof x === "string" && x.length > 0)
            .join(" · "),
        ),
        raw: r,
        identity: identityFor(ctx, r.html_url),
      }));
    }
    const search = Search.safeParse(payload);
    if (search.success) return search.data.items.map((i) => ({ url: i.html_url, excerpt: clip(i.login), raw: i, identity: identityFor(ctx, i.html_url) }));
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
        { url: u.html_url, excerpt: clip(parts.filter((x): x is string => typeof x === "string" && x.length > 0).join(" · ")), raw: u, identity: identityFor(ctx, u.html_url) },
      ];
    }
    return [];
  },
  digest: (payloads, ctx) => factsOf(payloads, ctx),
};

export function factsOf(payloads: readonly unknown[], ctx: StepContext): ProfileFacts[] | null {
  return digestOf(
      payloads.flatMap((pl) => {
        const u = User.safeParse(pl);
        if (!u.success || identityFor(ctx, u.data.html_url) !== "merged") return [];
        const f = emptyFacts("github", u.data.html_url, u.data.html_url);
        f.handle = u.data.login;
        f.display_name = u.data.name ?? null;
        f.bio = clipBio(u.data.bio);
        f.created_at = u.data.created_at ?? null;
        f.followers = count(u.data.followers);
        f.following = count(u.data.following);
        f.photo_url = u.data.avatar_url ?? null;
        return [f];
      }),
    );
}
