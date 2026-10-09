/**
 * Instagram name search via Apify `apify/instagram-scraper` (profile search): the accounts Instagram itself lists for the name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/instagram-search.ts
 * Deps:    zod, src/domain/corroborate (mentionsFullName, fold)
 * Tested:  src/recipe/__tests__/sources-search.test.ts
 *
 * Key responsibilities:
 * - Runs before the lineup for every run that has no confirmed Instagram account yet (a CV-linked account is confirmed):
 *   one `searchType: "profile"` run, at most 5 accounts, one post each
 * - The actor answers with one post per account found (`ownerUsername`, `ownerFullName`) or, on some builds, with the
 *   account itself (`username`, `fullName`); either shape becomes one Source per account whose display name or handle
 *   carries the candidate's full name, so the lineup (resolve) scores it against the anchor and the confirmed employers
 * - The excerpt's first line is the display name (pickDrafts reads the title line); the handle and the one caption follow
 *
 * Design constraints:
 * - Pure: no fetch; identity stays "unverified" (a name match on Instagram is never a confirmed identity)
 * - Never a post URL as the source: the profile URL is the identity the later `instagram_profile` step scrapes
 */
import { z } from "zod";
import { fold, mentionsFullName } from "@/domain/corroborate";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Post = z.object({ ownerUsername: z.string(), ownerFullName: z.string().nullish(), caption: z.string().nullish() });
const Account = z.object({ username: z.string(), fullName: z.string().nullish(), biography: z.string().nullish() });
const Item = z.union([Post, Account]);

type Found = { username: string; name: string; text: string };

function found(item: z.infer<typeof Item>): Found {
  if ("ownerUsername" in item) return { username: item.ownerUsername, name: item.ownerFullName ?? "", text: item.caption ?? "" };
  return { username: item.username, name: item.fullName ?? "", text: item.biography ?? "" };
}

/** The handle spells the full name ("jana.dvorakova", "janadvorakova"), diacritics and separators ignored. */
export function handleNamesSubject(subject: string, handle: string): boolean {
  const parts = fold(subject).split(/[^a-z]+/).filter((p) => p.length > 1);
  if (parts.length < 2) return false;
  const h = fold(handle).replace(/[^a-z]/g, "");
  const first = parts[0] ?? "";
  const sur = parts.at(-1) ?? "";
  return h.includes(sur) && (h.includes(first) || h.startsWith(`${first.charAt(0)}${sur}`));
}

export const profileUrl = (username: string): string => `https://www.instagram.com/${username.replace(/^@/, "")}/`;

export const instagramSearch: Collector = {
  id: "apify/instagram-scraper",
  requests: (ctx) => {
    if (ctx.subject.trim() === "") return [];
    if (ctx.candidates.some((c) => c.platform === "instagram" && c.decision === "merge")) return [];
    return [
      {
        via: "actor",
        actor: "apify/instagram-scraper",
        input: { search: ctx.subject.trim(), searchType: "profile", searchLimit: 5, resultsLimit: 1 },
        maxTotalChargeUsd: 0.03,
        timeoutSecs: 150,
      },
    ];
  },
  skipReason: (ctx) => (ctx.subject.trim() === "" ? "no name to search" : "an Instagram account is already confirmed (given profile or CV)"),
  parse: (payload, ctx) => {
    const items = z.array(z.unknown()).safeParse(payload);
    if (!items.success) return [];
    const byHandle = new Map<string, Found>();
    for (const raw of items.data) {
      const r = Item.safeParse(raw);
      if (!r.success) continue;
      const f = found(r.data);
      if (f.username === "" || byHandle.has(f.username.toLowerCase())) continue;
      if (!mentionsFullName(ctx.subject, f.name) && !handleNamesSubject(ctx.subject, f.username)) continue;
      byHandle.set(f.username.toLowerCase(), f);
    }
    return [...byHandle.values()].map((f) => {
      const url = profileUrl(f.username);
      const lines = [f.name === "" ? f.username : f.name, `@${f.username}`, `Found by Instagram profile search for "${ctx.subject}"`, f.text === "" ? "" : `Post: ${clip(f.text, 200)}`];
      return { url, excerpt: clip(lines.filter((l) => l !== "").join("\n")), raw: { username: f.username, name: f.name, text: f.text }, identity: identityFor(ctx, url) };
    });
  },
};
