/**
 * Chambers with a JSON answer: Czech Chamber of Architects (Plone API) and Czech Dental Chamber (members API).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/chambers-json.ts
 * Deps:    zod, src/domain/cz-registry (townOf), ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - ČKA: full-text search, post-filtered to the surname; hit = title + name, certification number, town, review state
 * - ČSK: members filter by surname and given name; hit = name with titles, specializations, workplace
 *
 * Design constraints:
 * - Both are the sites' own front-end APIs (undocumented); an unexpected shape yields "unavailable", never a throw
 */
import { z } from "zod";
import { townOf } from "@/domain/cz-registry";
import type { RegistrySource } from "./shared";
import { form, namesMatch, unavailable } from "./shared";

const Cka = z.object({
  items_total: z.number().optional(),
  items: z.array(z.object({ "@id": z.string(), title: z.string().nullish(), firstname: z.string().nullish(), lastname: z.string().nullish(), certification_number: z.string().nullish(), contact_town: z.string().nullish(), review_state: z.string().nullish() })).default([]),
});

export const cka: RegistrySource = {
  id: "cka",
  request: (name) => ({ via: "fetch", url: cka.url(name), init: { headers: { accept: "application/json" } } }),
  url: (name) => `https://www.cka.cz/++api++/svet-architektury/architekti-a-projekty/seznam-architektu?${form({ SearchableText: name.last })}`,
  parse: (payload, name) => {
    const r = Cka.safeParse(payload);
    if (!r.success) return unavailable("cka.cz answered with an unexpected shape");
    const hits = r.data.items
      .filter((i) => namesMatch(`${i.firstname ?? ""} ${i.lastname ?? ""}`, name))
      .map((i) => ({
        label: `${i.title ?? `${i.firstname ?? ""} ${i.lastname ?? ""}`} — authorised architect no. ${i.certification_number ?? "?"}, ${i.contact_town ?? "town unknown"}`,
        // "@id" of a ++api++ answer is the JSON URL; the human page is the same path without the API prefix
        url: i["@id"].replace("/++api++", ""),
        status: i.review_state === "approved" ? "listed" : (i.review_state ?? null),
        born: null,
      }));
    return { hits, total: hits.length, note: null };
  },
};

const Csk = z.object({
  pagination: z.object({ object_count: z.number().optional() }).optional(),
  data: z.array(z.object({ full_name: z.string().nullish(), first_name: z.string().nullish(), last_name: z.string().nullish(), specializations: z.array(z.unknown()).default([]), workplace: z.object({ name: z.string().nullish(), address: z.object({ print: z.string().nullish() }).nullish() }).nullish() })),
});

export const csk: RegistrySource = {
  id: "csk",
  request: (name) => ({
    via: "fetch",
    url: "https://is-api.dent.cz/api/v1/web/members",
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ per_page: 10, page: 1, filter: `last_name="${name.last.replace(/"/g, "")}"  &  first_name="${name.first.replace(/"/g, "")}"` }) },
  }),
  url: (name) => `https://www.dent.cz/zubni-lekari#${form({ last_name: name.last, first_name: name.first })}`,
  parse: (payload, name) => {
    const r = Csk.safeParse(payload);
    if (!r.success) return unavailable("is-api.dent.cz answered with an unexpected shape");
    // The API pads the page with empty rows: keep the members whose name is the one asked for
    const hits = r.data.data.filter((m) => namesMatch(`${m.first_name ?? ""} ${m.last_name ?? ""}`, name)).map((m) => {
      const where = [m.workplace?.name, townOf(m.workplace?.address?.print)].filter((x): x is string => typeof x === "string" && x !== "").join(", ");
      return { label: `${(m.full_name ?? "").replace(/\s+/g, " ").trim()} — dentist, member of the Czech Dental Chamber${where === "" ? "" : `, ${where}`}`, url: "https://www.dent.cz/zubni-lekari", status: "member", born: null };
    });
    return { hits, total: hits.length, note: null };
  },
};
