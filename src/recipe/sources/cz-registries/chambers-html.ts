/**
 * Chambers with an HTML answer: tax advisers (KDP), auditors (KAČR), construction engineers (ČKAIT), notaries, bailiffs,
 * pharmacists, and the health-care provider register (NRPZS).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/chambers-html.ts
 * Deps:    ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One search request per chamber, surname (and given name where the form takes it); hits post-filtered to both name tokens
 * - Each hit: the chamber's own line (name, evidence number, status or field) and a link to the member page or the search
 *
 * Design constraints:
 * - Table and card layouts are read through htmlToText lines; a layout change yields no hits and the UI's "unexpected page" note
 */
import type { PersonName, RegistrySource } from "./shared";
import { blocks, cells, form, FORM, HTML, namesMatch, text, unavailable } from "./shared";

const rows = (html: string, marker: string, name: PersonName): string[][] =>
  blocks(html, marker).map((b) => text(b.split("</li>")[0] ?? b).split("\n")).filter((l) => namesMatch(l.join(" "), name));

const href = (html: string, re: RegExp): string | null => re.exec(html)?.[1] ?? null;

export const kdp: RegistrySource = {
  id: "kdp",
  request: (name) => ({ via: "fetch", url: "https://www.kdpcr.cz/seznam-danovych-poradcu", init: { method: "POST", headers: FORM, body: form({ "f[ft]": name.last, "f[t][1]": "1" }) } }),
  url: (name) => `https://www.kdpcr.cz/seznam-danovych-poradcu#${form({ "f[ft]": name.last })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("kdpcr.cz answered without a body");
    if (!payload.includes("/danovy-poradce/")) return payload.includes("Fyzické osoby") ? { hits: [], total: 0, note: null } : unavailable("kdpcr.cz answered with an unexpected page");
    const seen = new Set<string>();
    const hits = [...payload.matchAll(/<a href="(\/danovy-poradce\/[^"]+)"[^>]*title="Zobrazit více o ([^"]+)"/g)].flatMap((m) => {
      const [, path = "", who = ""] = m;
      if (seen.has(path) || !namesMatch(who, name)) return [];
      seen.add(path);
      return [{ label: `${text(who)} — registered tax adviser`, url: `https://www.kdpcr.cz${path}`, status: "registered", born: null }];
    });
    return { hits, total: hits.length, note: null };
  },
};

export const kacr: RegistrySource = {
  id: "kacr",
  request: (name) => ({ via: "fetch", url: kacr.url(name), init: { headers: HTML } }),
  url: (name) => `https://www.kacr.cz/vyber-auditora?${form({ sSearchId_92: `*${name.last}*`, sSearchId_39: "zapsani", sAction: "sActionResults", sBool: "and", nAbsolutePage: "1", sSearchId_91: "ANO" })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("kacr.cz answered without a body");
    const page = text(payload);
    if (!page.includes("Našli jsme") && !page.includes("Nenašli jsme") && !page.includes("auditor")) return unavailable("kacr.cz answered with an unexpected page");
    const hits = blocks(payload, "<tr>").flatMap((row) => {
      const link = href(row, /href="(\/detail-auditora\?nGoodsID=\d+)"/);
      const c = cells(row.split("</tr>")[0] ?? row);
      if (link === null || !namesMatch(c[0] ?? "", name)) return [];
      return [{ label: `${c[0] ?? ""} — auditor, licence no. ${c[1] ?? "?"}, ${c[2] ?? ""}`, url: `https://www.kacr.cz${link}`, status: c[4] ?? null, born: null }];
    });
    return { hits, total: hits.length, note: null };
  },
};

export const ckait: RegistrySource = {
  id: "ckait",
  request: (name) => ({ via: "fetch", url: ckait.url(name), init: { headers: HTML } }),
  url: (name) => `https://www.ckait.cz/autorizovane-osoby?${form({ field_surname_value: name.last, field_firstname_value: name.first })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("ckait.cz answered without a body");
    if (!payload.includes("autorizovane-osoby")) return unavailable("ckait.cz answered with an unexpected page");
    const hits = blocks(payload, "<tr>").flatMap((row) => {
      const link = href(row, /href="(\/autorizovana-osoba\/\d+\/)"/);
      const c = cells(row.split("</tr>")[0] ?? row);
      if (link === null || !namesMatch(c[2] ?? "", name)) return [];
      return [{ label: `${c[2] ?? ""} — authorised person no. ${c[0] ?? "?"}, field ${c[3] ?? "?"}`, url: `https://www.ckait.cz${link}`, status: c[1] ?? null, born: null }];
    });
    return { hits, total: hits.length, note: null };
  },
};

export const nkcr: RegistrySource = {
  id: "nkcr",
  request: (name) => ({ via: "fetch", url: nkcr.url(name), init: { headers: HTML } }),
  url: (name) => `https://www.nkcr.cz/seznam-notaru?${form({ f_last_name: name.last })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("nkcr.cz answered without a body");
    if (!payload.includes("Výsledky vyhledávání")) return unavailable("nkcr.cz answered with an unexpected page");
    const hits = rows(payload, '<li class="search__result"', name).map((l) => ({ label: `${l[0] ?? ""} — notary, ${l.find((x) => x.startsWith("Notářská komora")) ?? "office listed"}`, url: nkcr.url(name), status: "appointed", born: null }));
    return { hits, total: hits.length, note: null };
  },
};

export const ekcr: RegistrySource = {
  id: "ekcr",
  request: (name) => ({ via: "fetch", url: ekcr.url(name), init: { headers: HTML } }),
  url: (name) => `https://www.ekcr.cz/vyhledat-exekutora?${form({ "executor_search[name]": name.last })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("ekcr.cz answered without a body");
    if (!payload.includes("executor_search")) return unavailable("ekcr.cz answered with an unexpected page");
    const hits = blocks(payload, '<div class="executor executor--grid">').flatMap((b) => {
      const l = text(b).split("\n");
      const who = l.find((x) => namesMatch(x, name));
      if (who === undefined) return [];
      return [{ label: `${who} — court bailiff, ${l.find((x) => x.startsWith("Obvod")) ?? ""}, ${l.find((x) => x.startsWith("č. soud. exek.")) ?? ""}`, url: ekcr.url(name), status: "appointed", born: null }];
    });
    return { hits, total: hits.length, note: null };
  },
};

export const clnk: RegistrySource = {
  id: "clnk",
  request: (name) => ({ via: "fetch", url: clnk.url(name), init: { headers: HTML } }),
  url: (name) => `https://lekarnici.cz/seznam-lekaren-a-lekarniku/?${form({ druh_hledani: "lekarnici", textVeJmenu: name.last, fs: "1" })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("lekarnici.cz answered without a body");
    if (!payload.includes('id="tabulka"')) return unavailable("lekarnici.cz answered with an unexpected page");
    const hits = blocks(payload, "<tr ").flatMap((row) => {
      const c = cells(row.split("</tr>")[0] ?? row);
      const link = href(row, /href="(https?:\/\/lekarnici\.cz\/lekarnici\/[^"]+)"/);
      if (link === null || !namesMatch(c[0] ?? "", name)) return [];
      return [{ label: `${c[0] ?? ""} — pharmacist, member no. ${c[1] ?? "?"}`, url: link, status: "member", born: null }];
    });
    return { hits, total: hits.length, note: null };
  },
};

export const nrpzs: RegistrySource = {
  id: "nrpzs",
  request: (name) => ({ via: "fetch", url: nrpzs.url(name), init: { headers: HTML } }),
  url: (name) => `https://nrpzs.uzis.cz/index.php?${form({ pg: "vyhledavani-poskytovatele--pro-verejnost", q: name.full })}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("nrpzs.uzis.cz answered without a body");
    if (!payload.includes("Počet nalezených záznamů") && !payload.includes("result-window")) return unavailable("nrpzs.uzis.cz answered with an unexpected page");
    const total = Number(/Počet nalezených záznamů:(?:&nbsp;|\s)*(\d+)/.exec(payload)?.[1] ?? "0");
    const hits = blocks(payload, '<div class="row result">').flatMap((b) => {
      const l = text(b).split("\n");
      const link = href(b, /href="(detail-\d+-[^"]+\.html)"/);
      if (!namesMatch(l[0] ?? "", name)) return [];
      return [{ label: `${l[0] ?? ""} — health-care provider, ${l[1] ?? "field unknown"}, ${l.find((x) => x.startsWith("IČO")) ?? ""}`, url: link === null ? nrpzs.url(name) : `https://nrpzs.uzis.cz/${link}`, status: "registered provider", born: null }];
    });
    return { hits, total: Number.isFinite(total) ? total : hits.length, note: null };
  },
};
