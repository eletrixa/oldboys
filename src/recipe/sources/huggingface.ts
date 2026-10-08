/**
 * Hugging Face REST collector: models published by an author.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/huggingface.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-makers.test.ts
 *
 * Key responsibilities:
 * - `rest/huggingface`: author = accepted huggingface handle, else slug of the subject
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Public API, no key; limit 10 models
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { acceptedCandidates, clip, identityFor } from "@/recipe/sources/types";

const Models = z.array(
  z.object({
    id: z.string(),
    downloads: z.number().optional(),
    likes: z.number().optional(),
    lastModified: z.string().optional(),
  }),
);

export const huggingface: Collector = {
  id: "rest/huggingface",
  requests: (ctx) => {
    const handle = acceptedCandidates(ctx).find(
      (c) => c.platform === "huggingface" && typeof c.handle === "string" && c.handle.length > 0,
    )?.handle;
    const author = handle ?? ctx.subject.trim().toLowerCase().replace(/\s+/g, "-");
    if (author.length === 0) return [];
    return [{ via: "fetch", url: `https://huggingface.co/api/models?author=${encodeURIComponent(author)}&limit=10` }];
  },
  parse: (payload, ctx) => {
    const r = Models.safeParse(payload);
    if (!r.success) return [];
    return r.data.map((m) => ({
      url: `https://huggingface.co/${m.id}`,
      excerpt: clip(
        `${m.id} · ${String(m.downloads ?? 0)} downloads · ${String(m.likes ?? 0)} likes · modified ${m.lastModified ?? "?"}`,
      ),
      raw: m,
      identity: identityFor(ctx, `https://huggingface.co/${m.id}`),
    }));
  },
};
