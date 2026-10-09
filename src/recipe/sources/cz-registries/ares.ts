/**
 * ARES check: sole-trader or business records whose business name is the person's name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/ares.ts
 * Deps:    zod, src/domain/cz-registry (townOf), src/domain/organization (ARES_BASE, AresSubjekt), ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One name search restricted to natural persons in business (legal form 101); hits whose name contains both name tokens
 * - Hit: business name, IČO, seat town (never street, house number or postcode: a namesake's home), since / until; status active or dissolved
 *
 * Design constraints:
 * - ARES has no person-name filter; this is the business-name search, so "Jan Novák s.r.o." and namesake traders both show
 * - ARES terms: no identical repeated queries (one per run) and well under the rate limit
 */
import { z } from "zod";
import { townOf } from "@/domain/cz-registry";
import { ARES_BASE, AresSubjekt } from "@/domain/organization";
import type { RegistrySource } from "./shared";
import { namesMatch, unavailable } from "./shared";

const Search = z.object({ pocetCelkem: z.number().optional(), ekonomickeSubjekty: z.array(AresSubjekt.loose()).default([]) });
const Dates = z.object({ datumVzniku: z.string().optional(), datumZaniku: z.string().nullish() });

export const aresPerson: RegistrySource = {
  id: "ares",
  request: (name) => ({
    via: "fetch",
    url: `${ARES_BASE}/ekonomicke-subjekty/vyhledat`,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ obchodniJmeno: name.full, pravniForma: ["101"], pocet: 10, start: 0 }) },
  }),
  url: (name) => `https://ares.gov.cz/ekonomicke-subjekty?obchodniJmeno=${encodeURIComponent(name.full)}`,
  parse: (payload, name) => {
    const r = Search.safeParse(payload);
    if (!r.success) return unavailable("ARES answered with an unexpected shape");
    const hits = r.data.ekonomickeSubjekty
      .filter((s) => namesMatch(s.obchodniJmeno ?? "", name))
      .map((s) => {
        const d = Dates.safeParse(s);
        const since = d.success ? d.data.datumVzniku : undefined;
        const until = d.success ? d.data.datumZaniku : undefined;
        return {
          label: `${s.obchodniJmeno ?? ""} — IČO ${s.ico}, ${s.sidlo?.nazevObce ?? townOf(s.sidlo?.textovaAdresa) ?? "town not listed"}, since ${since ?? "?"}${typeof until === "string" && until !== "" ? ` until ${until}` : ""}`,
          url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${s.ico}`,
          status: typeof until === "string" && until !== "" ? "dissolved" : "active",
          born: null,
        };
      });
    // pocetCelkem counts ARES's full-text matches (namesakes, "Jana Nováková" for "Jan Novák"); only the filtered rows are records under the name
    return { hits, total: hits.length, note: null };
  },
};
