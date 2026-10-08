/**
 * Stack Exchange REST collector: Stack Overflow users by name, ranked by reputation.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/stackexchange.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-makers.test.ts
 *
 * Key responsibilities:
 * - `rest/stackexchange`: one Source per matching user
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Anonymous quota (300 req/day per IP); one request per step
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Users = z.object({
  items: z.array(
    z.object({
      link: z.string(),
      display_name: z.string(),
      reputation: z.number().optional(),
      location: z.string().nullish(),
      creation_date: z.number().optional(),
    }),
  ),
});

export const stackexchange: Collector = {
  id: "rest/stackexchange",
  requests: (ctx) =>
    ctx.subject.trim().length === 0
      ? []
      : [
          {
            via: "fetch",
            url: `https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${encodeURIComponent(ctx.subject)}&site=stackoverflow`,
          },
        ],
  parse: (payload, ctx) => {
    const r = Users.safeParse(payload);
    if (!r.success) return [];
    return r.data.items.map((u) => ({
      url: u.link,
      excerpt: clip(
        [
          u.display_name,
          `reputation ${String(u.reputation ?? 0)}`,
          u.location,
          u.creation_date === undefined ? null : `joined ${new Date(u.creation_date * 1000).toISOString().slice(0, 10)}`,
        ]
          .filter((x): x is string => typeof x === "string" && x.length > 0)
          .join(" · "),
      ),
      raw: u,
      identity: identityFor(ctx, u.link),
    }));
  },
};
