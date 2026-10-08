/**
 * ARES v3 collectors: entity search by name and public-register record (statutory bodies) by IČO.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/ares.ts
 * Deps:    none (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources.test.ts
 *
 * Key responsibilities:
 * - `ares/ekonomicke-subjekty/vyhledat`: POST name search; one Source per entity
 * - `ares/ekonomicke-subjekty-vr`: GET statutory bodies for every IČO found earlier in the run
 *
 * Design constraints:
 * - Free API, no key; stay well under 500 req/min
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

const Subjekt = z.object({
  ico: z.string(),
  obchodniJmeno: z.string().optional(),
  sidlo: z.object({ textovaAdresa: z.string().optional() }).optional(),
  pravniForma: z.string().optional(),
  datumVzniku: z.string().optional(),
});
const Search = z.object({ pocetCelkem: z.number().optional(), ekonomickeSubjekty: z.array(Subjekt).default([]) });

export const aresSearch: Collector = {
  id: "ares/ekonomicke-subjekty/vyhledat",
  requests: (ctx) => {
    const ico = /^\d{8}$/.test(ctx.anchor.trim()) ? ctx.anchor.trim() : null;
    return [
      {
        via: "fetch",
        url: `${BASE}/ekonomicke-subjekty/vyhledat`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ico === null ? { obchodniJmeno: ctx.subject, pocet: 5 } : { ico: [ico], pocet: 5 }),
        },
      },
    ];
  },
  parse: (payload) => {
    const r = Search.safeParse(payload);
    if (!r.success) return [];
    return r.data.ekonomickeSubjekty.map((s) => ({
      url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${s.ico}`,
      excerpt: clip(
        `${s.obchodniJmeno ?? ""} · IČO ${s.ico} · ${s.pravniForma ?? ""} · vznik ${s.datumVzniku ?? "?"} · ${s.sidlo?.textovaAdresa ?? ""}`,
      ),
      raw: s,
    }));
  },
};

const Clen = z.object({
  fyzickaOsoba: z.object({ jmeno: z.string().optional(), prijmeni: z.string().optional() }).optional(),
  clenstvi: z.object({ funkce: z.object({ nazev: z.string().optional() }).optional() }).optional(),
  datumZapisu: z.string().optional(),
  datumVymazu: z.string().nullable().optional(),
});
const Vr = z.object({
  zaznamy: z
    .array(
      z.object({
        ico: z.string().optional(),
        obchodniJmeno: z.string().optional(),
        statutarniOrgany: z.array(z.object({ clenoveOrganu: z.array(Clen).default([]) })).default([]),
      }),
    )
    .default([]),
});

function icosFrom(urls: readonly string[]): string[] {
  return [...new Set(urls.map((u) => /[?&]ico=(\d{8})/.exec(u)?.[1]).filter((x): x is string => x !== undefined))];
}

export const aresVr: Collector = {
  id: "ares/ekonomicke-subjekty-vr",
  requests: (ctx) =>
    icosFrom(ctx.sources.map((s) => s.url)).map((ico) => ({
      via: "fetch" as const,
      url: `${BASE}/ekonomicke-subjekty-vr/${ico}`,
    })),
  parse: (payload) => {
    const r = Vr.safeParse(payload);
    if (!r.success) return [];
    return r.data.zaznamy.flatMap((z) => {
      const members = z.statutarniOrgany.flatMap((o) => o.clenoveOrganu);
      if (members.length === 0) return [];
      const lines = members.map(
        (m) =>
          `${m.fyzickaOsoba?.jmeno ?? ""} ${m.fyzickaOsoba?.prijmeni ?? ""} — ${m.clenstvi?.funkce?.nazev ?? "člen"} od ${m.datumZapisu ?? "?"}${typeof m.datumVymazu === "string" && m.datumVymazu.length > 0 ? ` do ${m.datumVymazu}` : " (current)"}`,
      );
      return [
        {
          url: `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${z.ico ?? ""}`,
          excerpt: clip(`${z.obchodniJmeno ?? ""} statutory bodies:\n${lines.join("\n")}`),
          raw: z,
        },
      ];
    });
  },
};
