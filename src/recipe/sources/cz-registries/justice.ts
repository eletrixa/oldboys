/**
 * Veřejný rejstřík (or.justice.cz) person check: statutory-body seats and ownerships under the person's name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/justice.ts
 * Deps:    src/domain/cz-registry (townOf), ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One GET `rejstrik-$osoba` (given name + surname, starts-with, 50 rows); no cookie needed
 * - Each `li.result` -> hit: name, birth date, town of the address (never street or postcode), role (Angažmá), company and IČO, file number, entry date
 *
 * Design constraints:
 * - Page is Wicket HTML; parsing is by the result block's "Label:" rows, so a layout change yields no hits plus a note
 */
import { townOf } from "@/domain/cz-registry";
import type { RegistrySource } from "./shared";
import { blocks, cells, HTML, labelled, namesMatch, tidyName, unavailable } from "./shared";

const BASE = "https://or.justice.cz/ias/ui/rejstrik-$osoba";

export const justicePersons: RegistrySource = {
  id: "justice-or",
  request: (name) => ({ via: "fetch", url: justicePersons.url(name), init: { headers: HTML } }),
  url: (name) => `${BASE}?jmeno=${encodeURIComponent(name.first)}&prijmeni=${encodeURIComponent(name.last)}&polozek=50&typHledani=STARTS_WITH`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("or.justice.cz answered without a body");
    if (!payload.includes("search-results") && !payload.includes("Počet nalezených")) return unavailable("or.justice.cz answered with an unexpected page");
    // STARTS_WITH on both fields also returns "Jana Nováková" for "Jan Novák": keep the rows naming the person
    const hits = blocks(payload, '<li class="result').flatMap((b) => {
      // The record table ends where the "Výpis platných / Úplný výpis / Sbírka listin" links start
      const f = labelled(cells(b.split('<ul class="result-links')[0] ?? b).join("\n"));
      const ico = (f.get("IČO") ?? "").replace(/\s+/g, "");
      const who = tidyName(f.get("Jméno") ?? "");
      if (!namesMatch(who, name)) return [];
      return [{
        label: `${who}, ${townOf(f.get("Adresa")) ?? "town not listed"} — ${f.get("Angažmá") ?? "role unknown"} at ${f.get("Název subjektu") ?? "?"} (IČO ${ico || "?"}), file ${f.get("Spisová značka") ?? "?"}, entered ${f.get("Den zápisu") ?? "?"}`,
        url: ico === "" ? BASE : `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${ico}`,
        status: f.get("Angažmá") ?? null,
        born: f.get("Datum narození") ?? null,
      }];
    });
    return { hits, total: hits.length, note: null };
  },
};
