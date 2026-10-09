/**
 * LinkedIn posts collector via Apify `harvestapi/linkedin-profile-posts` (no cookies, $0.002 per post).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/linkedin-posts.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-posts.test.ts
 *
 * Key responsibilities:
 * - Request the latest own posts (no reposts, reactions or comments) of the merged LinkedIn profile; one Source per post
 * - A post is "merged" only when its author's public identifier sits on a merged candidate's profile
 *
 * Design constraints:
 * - Excerpts capped at POST_CHARS (600) so posts leave room for other sources in extract's prompt
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Merged profiles only, never possibly-same-as: posts are the subject's own voice, a namesake's would mislead
 * - Input fields verified against https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts (targetUrls, maxPosts, includeReposts)
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const MAX_POSTS = 10;
/** Per-post excerpt cap: ten posts must not crowd the other sources out of extract's prompt budget. */
const POST_CHARS = 600;

const Post = z.object({
  linkedinUrl: z.string(),
  content: z.string().nullish(),
  author: z.object({ publicIdentifier: z.string().nullish() }).nullish(),
  postedAt: z.object({ date: z.string().nullish() }).nullish(),
  engagement: z.object({ likes: z.number().nullish(), comments: z.number().nullish() }).nullish(),
});

export const linkedinPosts: Collector = {
  id: "harvestapi/linkedin-profile-posts",
  requests: (ctx) => {
    const urls = ctx.candidates
      .filter((c) => c.platform === "linkedin" && c.decision === "merge")
      .flatMap((c) => c.profile_urls.filter((u) => u.includes("linkedin.com/in/")));
    const target = urls[0];
    if (target === undefined) return [];
    return [
      {
        via: "actor",
        actor: "harvestapi/linkedin-profile-posts",
        input: { targetUrls: [target], maxPosts: MAX_POSTS, includeReposts: false, scrapeReactions: false, scrapeComments: false },
        maxTotalChargeUsd: 0.03,
        timeoutSecs: 45,
      },
    ];
  },
  parse: (payload, ctx) => {
    const items = z.array(Post).safeParse(payload);
    if (!items.success) return [];
    return items.data.flatMap((p) => {
      const text = (p.content ?? "").trim();
      if (text === "") return [];
      const who = p.author?.publicIdentifier ?? "";
      const date = p.postedAt?.date?.slice(0, 10) ?? "?";
      return [
        {
          url: p.linkedinUrl,
          excerpt: clip(`LinkedIn post, ${date} · ${String(p.engagement?.likes ?? 0)} likes, ${String(p.engagement?.comments ?? 0)} comments\n${text}`, POST_CHARS),
          raw: p,
          identity: who === "" ? ("unverified" as const) : identityFor(ctx, `https://www.linkedin.com/in/${who}`),
        },
      ];
    });
  },
};
