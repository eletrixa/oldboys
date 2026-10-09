/**
 * GitHub user search by name before the lineup (technical roles): the accounts GitHub itself lists for the candidate's name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/github-search.ts
 * Deps:    zod, src/domain/code-profile (isTechnicalRole), src/domain/corroborate (mentionsFullName), ./instagram-search (handleNamesSubject)
 * Tested:  src/recipe/__tests__/github-search.test.ts
 *
 * Key responsibilities:
 * - `rest/github-search`: one `search/users?q=<name> in:name` request, then `followUp` reads the profile of the first
 *   MAX_HITS logins (`users/<login>`) so the lineup sees the display name, company, location, bio and website and can
 *   corroborate them against the anchor and the confirmed employers (name + city alone stays possibly-same-as)
 * - Runs only for a technical role (src/domain/code-profile) and only while no GitHub account is confirmed; the
 *   `github_profile` step after the lineup then reads the confirmed account and `github_deep` its statistics
 * - One Source per account whose display name or login spells the full name; the search listing itself is never a Source
 *
 * Design constraints:
 * - Pure: no fetch; identity stays "unverified" (a name match on GitHub is never a confirmed identity)
 * - Free REST (GITHUB_TOKEN is added by the fetch adapter); at most 1 + MAX_HITS requests
 */
import { z } from "zod";
import { isTechnicalRole, technicalSkipReason } from "@/domain/code-profile";
import { mentionsFullName } from "@/domain/corroborate";
import { handleNamesSubject } from "@/recipe/sources/instagram-search";
import type { Collector, CollectorRequest, Fetched, StepContext } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const API = "https://api.github.com";
export const MAX_HITS = 3;

const Search = z.object({ items: z.array(z.object({ login: z.string() })) });
const User = z.object({
  login: z.string(),
  html_url: z.string(),
  name: z.string().nullish(),
  bio: z.string().nullish(),
  company: z.string().nullish(),
  location: z.string().nullish(),
  blog: z.string().nullish(),
  public_repos: z.number().optional(),
  created_at: z.string().optional(),
});

export const searchUrl = (subject: string): string => `${API}/search/users?q=${encodeURIComponent(subject.trim())}+in:name&per_page=5`;
export const userUrl = (login: string): string => `${API}/users/${encodeURIComponent(login)}`;

const confirmed = (ctx: StepContext): boolean => ctx.candidates.some((c) => c.platform === "github" && c.decision === "merge");

export const githubSearch: Collector = {
  id: "rest/github-search",
  requests: (ctx) => {
    if (ctx.subject.trim() === "" || !isTechnicalRole(ctx) || confirmed(ctx)) return [];
    return [{ via: "fetch", url: searchUrl(ctx.subject) }];
  },
  skipReason: (ctx) => {
    if (ctx.subject.trim() === "") return "no name to search";
    return technicalSkipReason(ctx) ?? "a GitHub account is already confirmed (given profile or CV)";
  },
  followUp: (_ctx, _step, fetched: readonly Fetched[]) => {
    const listing = fetched.find((f) => f.req.via === "fetch" && f.req.url.startsWith(`${API}/search/users`));
    const parsed = Search.safeParse(listing?.payload);
    if (!parsed.success) return [];
    return parsed.data.items.slice(0, MAX_HITS).map((i): CollectorRequest => ({ via: "fetch", url: userUrl(i.login) }));
  },
  parse: (payload, ctx) => {
    const user = User.safeParse(payload);
    if (!user.success) return [];
    const u = user.data;
    if (!mentionsFullName(ctx.subject, u.name ?? "") && !handleNamesSubject(ctx.subject, u.login)) return [];
    const lines = [
      u.name ?? u.login,
      `@${u.login}`,
      u.company ?? "",
      u.location ?? "",
      u.bio ?? "",
      u.blog ?? "",
      [u.public_repos === undefined ? "" : `${String(u.public_repos)} public repos`, u.created_at === undefined ? "" : `joined ${u.created_at.slice(0, 10)}`].filter((x) => x !== "").join(", "),
      `Found by GitHub user search for "${ctx.subject}"`,
    ];
    return [{ url: u.html_url, excerpt: clip(lines.filter((l) => l.trim() !== "").join("\n")), raw: u, identity: identityFor(ctx, u.html_url) }];
  },
};
