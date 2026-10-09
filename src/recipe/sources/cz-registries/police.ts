/**
 * Policie ČR wanted and missing persons check (pátrání po osobách), server-rendered search.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/police.ts
 * Deps:    ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One GET with the full name; the page lists matching persons as cards (surname, given name, birth date, wanted / missing)
 * - Hits are kept only when both name tokens appear (the form matches name and/or surname)
 *
 * Design constraints:
 * - The site says every query is logged; one query per run, no photo is stored (only the card text and link)
 */
import type { RegistrySource } from "./shared";
import { blocks, HTML, namesMatch, text, tidyName, unavailable } from "./shared";

const PAGE = "https://policie.gov.cz/patrani-osoby";
const STATUS: Record<string, string> = { hledaný: "wanted", hledaná: "wanted", pohřešovaný: "missing", pohřešovaná: "missing" };

export const police: RegistrySource = {
  id: "police",
  request: (name) => ({ via: "fetch", url: `${PAGE}?search=true&FullName=${encodeURIComponent(name.full)}`, init: { headers: HTML } }),
  url: (name) => `${PAGE}?search=true&FullName=${encodeURIComponent(name.full)}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("policie.gov.cz answered without a body");
    if (!payload.includes("Celkový počet osob")) return unavailable("policie.gov.cz answered with an unexpected page");
    const hits = blocks(payload, 'href="?id=').flatMap((b) => {
      const id = /^href="\?id=(\d+)/.exec(b)?.[1];
      // The block starts inside the <a ...> tag: drop the rest of that tag, stop at its end.
      const card = b.slice(b.indexOf(">") + 1, b.includes("</a>") ? b.indexOf("</a>") : b.length);
      const lines = text(card).split("\n");
      // The photo's alt text is "GIVEN SURNAME"; the caption below it is "SURNAME GIVEN"
      const who = /alt="([^"]+)"/.exec(card)?.[1] ?? lines[0] ?? "";
      const born = lines[1] ?? null;
      if (id === undefined || !namesMatch(who, name)) return [];
      const word = lines.find((l) => Object.hasOwn(STATUS, l));
      const status = word === undefined ? null : (STATUS[word] ?? word);
      return [{ label: `${tidyName(who)}, born ${born ?? "?"} — ${status ?? "on the list"}`, url: `${PAGE}/?id=${id}`, status, born }];
    });
    return { hits, total: hits.length, note: null };
  },
};
