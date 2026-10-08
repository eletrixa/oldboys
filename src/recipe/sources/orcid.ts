/**
 * ORCID public API collector: expanded researcher search by given and family name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/orcid.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-makers.test.ts
 *
 * Key responsibilities:
 * - `rest/orcid`: one Source per matching ORCID record
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Last whitespace-separated token is the family name; needs at least two tokens
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const Expanded = z.object({
  "expanded-result": z
    .array(
      z.object({
        "orcid-id": z.string(),
        "given-names": z.string().nullish(),
        "family-names": z.string().nullish(),
        "institution-name": z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
});

export const orcid: Collector = {
  id: "rest/orcid",
  requests: (ctx) => {
    const parts = ctx.subject.trim().split(/\s+/);
    if (parts.length < 2) return [];
    const family = parts[parts.length - 1] ?? "";
    const given = parts.slice(0, -1).join(" ");
    const q = `given-names:${given} AND family-name:${family}`;
    return [
      {
        via: "fetch",
        url: `https://pub.orcid.org/v3.0/expanded-search/?q=${encodeURIComponent(q)}&rows=5`,
        init: { headers: { accept: "application/json" } },
      },
    ];
  },
  parse: (payload) => {
    const r = Expanded.safeParse(payload);
    if (!r.success) return [];
    return (r.data["expanded-result"] ?? []).map((h) => ({
      url: `https://orcid.org/${h["orcid-id"]}`,
      excerpt: clip(
        [`${h["given-names"] ?? ""} ${h["family-names"] ?? ""}`.trim(), ...(h["institution-name"] ?? [])]
          .filter((x) => x.length > 0)
          .join(" · "),
      ),
      raw: h,
    }));
  },
};
