/**
 * Veřejný rejstřík (or.justice.cz) person check: statutory-body seats and ownerships under the person's name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/justice.ts
 * Deps:    ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One GET `rejstrik-$osoba` (given name + surname, starts-with, 50 rows); no cookie needed
 * - Each `li.result` -> hit: name, birth date, address, role (Angažmá), company and IČO, file number, entry date
 *
 * Design constraints:
 * - Page is Wicket HTML; parsing is by the result block's "Label:" rows, so a layout change yields no hits plus a note
 */
import type { RegistrySource } from "./shared";
import { blocks, HTML, labelled, text, tidyName, unavailable } from "./shared";

const BASE = "https://or.justice.cz/ias/ui/rejstrik-$osoba";

export const justicePersons: RegistrySource = {
  id: "justice-or",
  request: (name) => ({ via: "fetch", url: justicePersons.url(name), init: { headers: HTML } }),
  url: (name) => `${BASE}?jmeno=${encodeURIComponent(name.first)}&prijmeni=${encodeURIComponent(name.last)}&polozek=50&typHledani=STARTS_WITH`,
  parse: (payload) => {
    if (typeof payload !== "string") return unavailable("or.justice.cz answered without a body");
    if (!payload.includes("search-results") && !payload.includes("Počet nalezených")) return unavailable("or.justice.cz answered with an unexpected page");
    const hits = blocks(payload, '<li class="result').map((b) => {
      // The record table ends where the "Výpis platných / Úplný výpis / Sbírka listin" links start
      const f = labelled(text(b.split('<ul class="result-links')[0] ?? b));
      const ico = (f.get("IČO") ?? "").replace(/\s+/g, "");
      const who = tidyName(f.get("Jméno") ?? "");
      return {
        label: `${who}, ${f.get("Adresa") ?? "?"} — ${f.get("Angažmá") ?? "role unknown"} at ${f.get("Název subjektu") ?? "?"} (IČO ${ico || "?"}), file ${f.get("Spisová značka") ?? "?"}, entered ${f.get("Den zápisu") ?? "?"}`,
        url: ico === "" ? BASE : `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${ico}`,
        status: f.get("Angažmá") ?? null,
        born: f.get("Datum narození") ?? null,
      };
    });
    const m = /Počet nalezených subjektů:\s*<[^>]*>?\s*(\d+)/.exec(payload) ?? /Počet nalezených subjektů:\s*(\d+)/.exec(text(payload));
    const total = m?.[1] !== undefined ? Number(m[1]) : hits.length;
    return { hits, total, note: null };
  },
};
