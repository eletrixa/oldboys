/**
 * Apify GitHub profile collector: the profile page's own numbers (last-year contributions, pinned repos, achievements).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/github-apify.ts
 * Deps:    zod (actor via ports.callActor)
 * Tested:  src/recipe/__tests__/github-apify.test.ts
 *
 * Key responsibilities:
 * - `saswave/github-profile-scraper`: one actor request for up to two accepted GitHub handles, technical role families only
 * - `parseCount`: "19.9k" / "1,444" / "2.1m" / numbers to integers
 * - `profileOf`: the ApifyGithubProfile of one item, built once; the excerpt is formatted from it and `digest` returns it (read by the code-profile card)
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to [] (digest: null)
 * - Cost capped at maxTotalChargeUsd 0.05 and 45s per request
 */
import { z } from "zod";
import { ApifyGithubProfile, isTechnicalFamily } from "@/domain/code-profile";
import type { Collector, ParsedSource } from "@/recipe/sources/types";
import { clip, githubHandles, identityFor } from "@/recipe/sources/types";

const ACTOR = "saswave/github-profile-scraper";

const Count = z.union([z.string(), z.number()]).nullish();
const Text = z.string().nullish();

const Item = z.object({
  user: Text,
  username: Text,
  name: Text,
  followers: Count,
  last_year_contribution_number: Count,
  first_year_commit: Count,
  pinned_repos: z.array(z.object({ name: Text, url: Text, languages: z.array(z.string()).nullish(), stars: Count, forks: Count })).nullish(),
  achievements: z.array(z.string()).nullish(),
});
type Item = z.infer<typeof Item>;

/** "19.9k" -> 19900, "1,444" -> 1444, "2.1m" -> 2100000, 12 -> 12; null when not a count. */
export function parseCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  if (typeof value !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)\s*([kmb])?$/i.exec(value.trim().replaceAll(",", ""));
  if (m === null) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(Number(m[1]) * mult);
}

function usernameOf(item: Item): string | null {
  const fromUser = (item.user ?? "").split("/").filter((s) => s.length > 0).pop();
  const name = (item.username ?? fromUser ?? "").trim().replace(/^@/, "");
  return name.length > 0 ? name : null;
}

function yearOf(value: unknown): number | null {
  const m = /\b(\d{4})\b/.exec(typeof value === "number" ? String(value) : typeof value === "string" ? value : "");
  return m?.[1] === undefined ? null : Number(m[1]);
}

function items(payload: unknown): { item: Item; username: string }[] {
  const r = z.array(Item).safeParse(payload);
  if (!r.success) return [];
  return r.data.flatMap((item) => {
    const username = usernameOf(item);
    return username === null ? [] : [{ item, username }];
  });
}

/** The item's numbers as the digest shape (not yet schema-checked). */
function profileOf(item: Item, username: string): ApifyGithubProfile {
  return {
    handle: username,
    last_year_contributions: parseCount(item.last_year_contribution_number),
    first_commit_year: yearOf(item.first_year_commit),
    pinned_repos: (item.pinned_repos ?? []).flatMap((p) => {
      const name = (p.name ?? "").trim();
      if (name === "") return [];
      return [{ name, url: p.url ?? `https://github.com/${username}/${name}`, stars: parseCount(p.stars) ?? 0, forks: parseCount(p.forks) ?? 0, languages: p.languages ?? [] }];
    }),
    achievements: item.achievements ?? [],
    source_url: `https://apify.com/${ACTOR}?profile=${username}`,
  };
}

function excerptOf(item: Item, p: ApifyGithubProfile): string {
  const parts: string[] = [];
  if (p.last_year_contributions !== null) parts.push(`${String(p.last_year_contributions)} contributions in the last year`);
  if (p.first_commit_year !== null) parts.push(`first commit in ${String(p.first_commit_year)}`);
  const pinned = p.pinned_repos.map((r) => {
    const detail = [r.stars > 0 ? `★${String(r.stars)}` : null, r.languages[0] ?? null].filter((x) => x !== null).join(", ");
    return detail === "" ? r.name : `${r.name} (${detail})`;
  });
  if (pinned.length > 0) parts.push(`pinned repositories: ${pinned.join(", ")}`);
  if (p.achievements.length > 0) parts.push(`achievements: ${p.achievements.join(", ")}`);
  const followers = parseCount(item.followers);
  if (followers !== null) parts.push(`followers ${String(followers)}`);
  const who = (item.name ?? "").trim() || p.handle;
  return parts.length > 0 ? `${who} on GitHub: ${parts.join("; ")}` : `${who} on GitHub`;
}

export const githubApify: Collector = {
  id: ACTOR,
  requests: (ctx) => {
    if (!isTechnicalFamily(ctx.roleFamily)) return [];
    const handles = githubHandles(ctx);
    if (handles.length === 0) return [];
    return [{ via: "actor", actor: ACTOR, input: { peoples_links: handles.map((h) => `https://github.com/${h}`) }, maxTotalChargeUsd: 0.05, timeoutSecs: 45 }];
  },
  parse: (payload, ctx) =>
    items(payload).map(({ item, username }): ParsedSource => {
      const url = `https://github.com/${username}`;
      return { url, excerpt: clip(excerptOf(item, profileOf(item, username))), raw: item, identity: identityFor(ctx, url) };
    }),
  digest: (fetched, ctx) => {
    const handles = githubHandles(ctx).map((h) => h.toLowerCase());
    for (const f of fetched) {
      const hit = items(f.payload).find(({ username }) => handles.includes(username.toLowerCase()));
      if (hit === undefined) continue;
      const parsed = ApifyGithubProfile.safeParse(profileOf(hit.item, hit.username));
      if (parsed.success) return parsed.data;
    }
    return null;
  },
};
