/**
 * Shared types and helpers of the treg social readers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/social-account.ts
 * Deps:    zod, src/domain/{claim,profile-facts}
 * Tested:  src/recipe/__tests__/treg-social-verify.test.ts
 *
 * Key responsibilities:
 * - `Read` (what one read yields: ProfileFacts field names, plus ready `extras` sentences), `Reader` (the per-platform object:
 *   `request` yields only the identifier, `param`/`extra` say how to send it, `profileUrl` and `read` take that identifier)
 * - `bare`, `nil` and the zod field shorthands
 *
 * Design constraints:
 * - Pure, no I/O
 */
import { z } from "zod";
import type { Candidate } from "@/domain/claim";
import type { ProfileFacts } from "@/domain/profile-facts";

/** Only the fields a platform has; `facts()` fills the rest. `extras` are ready sentences for fields only one platform has. */
export type Read = Partial<ProfileFacts> & { extras?: string[] };

export type Reader = {
  platform: string;
  endpoint: string;
  method: "GET" | "POST";
  provider: string;
  /** The noun of the excerpt's first sentence. */
  kind: "profile" | "account" | "page";
  /** What the posts count counts ("posts", "videos"). */
  postsLabel: string;
  /** Request param name for an identifier. */
  param: (id: string) => string;
  /** Fixed params sent beside the identifier. */
  extra?: Record<string, string>;
  /** The handle, URL or channel id to read, or null when the candidate has none. */
  request: (c: Candidate) => string | null;
  profileUrl: (id: string) => string;
  read: (payload: unknown, id: string) => Read | null;
};

export const bare = (h: string | null): string => (h ?? "").trim().replace(/^@/, "");
export const num = z.number().nullish();
export const text = z.string().nullish();
export const flag = z.boolean().nullish();
export const nil = (v: unknown): v is null | undefined => v === null || v === undefined;
