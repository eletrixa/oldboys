/**
 * Česká advokátní komora check: attorneys and trainee attorneys under the person's name, with status.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/cak.ts
 * Deps:    ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One form POST (surname + given name); the site answers 302 to the session's result page, which the fetch adapter follows
 *   with the cookie it set
 * - Each result row -> hit: evidence number and name, attorney or trainee, status (Aktivní / Pozastavený / Vyškrtnutý), firm
 *
 * Design constraints:
 * - Public search, no key; one query per run
 */
import type { RegistrySource } from "./shared";
import { blocks, form, FORM, text, tidyName, unavailable } from "./shared";

const BASE = "https://vyhledavac.cak.cz";
const STATUS: Record<string, string> = { aktivní: "active", pozastavený: "suspended", vyškrtnutý: "struck off", "ve výkonu": "active" };

export const cak: RegistrySource = {
  id: "cak",
  request: (name) => ({
    via: "fetch",
    url: `${BASE}/`,
    init: { method: "POST", headers: FORM, body: form({ Surname: name.last, FirstName: name.first, Town: "", CompanyName: "", RegistrationCode: "", SelectedSpecialisation: "", SelectedLanguage: "", SelectedCourtAppoinment: "" }) },
  }),
  url: (name) => `${BASE}/#Surname=${encodeURIComponent(name.last)}&FirstName=${encodeURIComponent(name.first)}`,
  parse: (payload) => {
    if (typeof payload !== "string") return unavailable("vyhledavac.cak.cz answered without a body");
    const shown = /Zobrazeno advok[^:]*:\s*(\d+),\s*koncipient[^:]*:\s*(\d+)/.exec(text(payload));
    if (shown === null) return unavailable("vyhledavac.cak.cz answered with an unexpected page");
    const hits = blocks(payload, "<tr>").flatMap((row) => {
      const m = /<a href="(\/Contact\/(Details|DetailConcipient)\/[^"]+)">([^<]+)<\/a>/.exec(row);
      if (m === null) return [];
      const cells = text(row.replace(/<a[^>]*>/g, "").replace(/<\/a>/g, "")).split("\n");
      const entry = text(m[3] ?? "");
      const kind = m[2] === "Details" ? "attorney" : "trainee attorney";
      const status = cells.find((c) => c.toLowerCase() in STATUS) ?? null;
      const firm = cells[cells.length - 1] ?? "";
      return [{ label: `${tidyName(entry.replace(/^\d+\s*-\s*/, ""))} — ${kind}, evidence no. ${entry.split(" - ")[0] ?? "?"}${firm !== "" && firm !== entry ? `, ${firm}` : ""}`, url: `${BASE}${m[1] ?? ""}`, status: status === null ? null : (STATUS[status.toLowerCase()] ?? status), born: null }];
    });
    return { hits, total: Number(shown[1]) + Number(shown[2]), note: null };
  },
};
