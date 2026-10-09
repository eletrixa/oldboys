/**
 * Shared types and helpers of the treg social readers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/social-account.ts
 * Deps:    zod, src/domain/claim, src/recipe/sources/types
 * Tested:  src/recipe/__tests__/treg-social-verify.test.ts
 *
 * Key responsibilities:
 * - `Account` (what one read yields), `Reader` (the per-platform `{ request, profileUrl, read }` object), `TregParams`
 * - request builders (`handleReq`, `urlReq`), `acct` (Account with every field present), zod field shorthands
 *
 * Design constraints:
 * - Pure, no I/O
 */
import { z } from "zod";
import type { Candidate } from "@/domain/claim";
import type { CollectorRequest } from "@/recipe/sources/types";

export type TregParams = Extract<CollectorRequest, { via: "treg" }>["params"];

export type Account = {
  handle: string | null;
  name: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  connections: number | null;
  verified: boolean | null;
  premium: boolean | null;
  open_to_work: boolean | null;
  created_at: string | null;
  photo_url: string | null;
  first_year: number | null;
  /** Ready sentences for fields only one platform has (Facebook category, website, likes). */
  extras: string[];
};

export type Reader = {
  platform: string;
  endpoint: string;
  method: "GET" | "POST";
  provider: string;
  /** "profile", "account" or "page": the noun of the excerpt's first sentence. */
  kind: string;
  /** What the posts count counts ("posts", "videos"). */
  postsLabel: string;
  request: (c: Candidate) => TregParams | null;
  profileUrl: (params: TregParams) => string;
  read: (payload: unknown, params: TregParams) => Account | null;
};

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const bare = (h: string | null): string => (h ?? "").trim().replace(/^@/, "");
export const num = z.number().nullish();
export const text = z.string().nullish();
export const flag = z.boolean().nullish();
export const acct = (over: Partial<Account>): Account => ({
  handle: null, name: null, bio: null, followers: null, following: null, posts: null, connections: null,
  verified: null, premium: null, open_to_work: null, created_at: null, photo_url: null, first_year: null, extras: [], ...over,
});
export const handleReq = (c: Candidate, key: string): TregParams | null => (bare(c.handle) === "" ? null : { [key]: bare(c.handle) });
export const urlReq = (c: Candidate, key: string, more: TregParams = {}): TregParams | null => {
  const url = c.profile_urls[0];
  return url === undefined ? null : { [key]: url, ...more };
};
export const nil = (v: unknown): v is null | undefined => v === null || v === undefined;
