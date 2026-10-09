/**
 * ISIR (Insolvenční rejstřík) check through the public SOAP service, exact name match.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/isir.ts
 * Deps:    ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - One `getIsirWsCuzkDataRequest` (surname + given name, exact match, current and past cases, max 20)
 * - Each `<data>` record naming the person (joint-case co-debtors dropped) -> hit: name, town, file number and court, proceeding dates, the registry's state code; link to the case detail
 *
 * Design constraints:
 * - The record carries the birth number (`rc`): it is never read; only the birth date (public in the register) is kept
 * - Service terms: public read-only interface, no key; one call per run
 */
import type { RegistrySource } from "./shared";
import { namesMatch, unavailable } from "./shared";

export const ISIR_WS = "https://isir.justice.cz:8443/isir_cuzk_ws/IsirWsCuzkService";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const tag = (xml: string, name: string): string | null => {
  const v = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]?.trim() ?? "";
  return v === "" ? null : v;
};

const date = (s: string | null) => s?.replace(/Z$/, "") ?? null;

const STATES: Record<string, string> = {
  ODSKRTNUTA: "case closed",
  PRAVOMOCNA: "final decision",
  ZRUSENA: "cancelled",
};

export const isir: RegistrySource = {
  id: "isir",
  request: (name) => ({
    via: "fetch",
    url: ISIR_WS,
    init: {
      method: "POST",
      headers: { accept: "text/xml", "content-type": "text/xml; charset=utf-8", soapaction: '""' },
      body:
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://isirws.cca.cz/types/"><soapenv:Header/><soapenv:Body><typ:getIsirWsCuzkDataRequest>' +
        `<nazevOsoby>${esc(name.last)}</nazevOsoby><jmeno>${esc(name.first)}</jmeno>` +
        "<maxPocetVysledku>20</maxPocetVysledku><filtrAktualniRizeni>F</filtrAktualniRizeni><vyhledatPresnouShoduJmen>T</vyhledatPresnouShoduJmen><vyhledatBezDiakritiky>F</vyhledatBezDiakritiky><maxRelevanceVysledku>7</maxRelevanceVysledku>" +
        "</typ:getIsirWsCuzkDataRequest></soapenv:Body></soapenv:Envelope>",
    },
  }),
  url: (name) => `https://isir.justice.cz/isir/ueu/vysledek_lustrace.do?nazev_osoby=${encodeURIComponent(name.last)}&jmeno_osoby=${encodeURIComponent(name.first)}`,
  parse: (payload, name) => {
    if (typeof payload !== "string") return unavailable("ISIR answered without a body");
    if (payload.includes("<soap:Fault>") || payload.includes("<faultstring>")) return unavailable(`ISIR fault: ${tag(payload, "faultstring") ?? "unknown"}`);
    // Exact-match search still returns the other debtors of a joint case (a spouse): keep the person's own rows only
    const records = (payload.match(/<data>[\s\S]*?<\/data>/g) ?? []).filter((r) => namesMatch(`${tag(r, "jmeno") ?? ""} ${tag(r, "nazevOsoby") ?? ""}`, name));
    const hits = records.map((r) => {
      const who = `${tag(r, "jmeno") ?? ""} ${tag(r, "nazevOsoby") ?? ""}`.trim();
      const file = [tag(r, "cisloSenatu"), tag(r, "druhVec"), tag(r, "bcVec")].filter((x) => x !== null).join(" ") + (tag(r, "rocnik") === null ? "" : `/${tag(r, "rocnik") ?? ""}`);
      const state = tag(r, "druhStavKonkursu");
      const span = `${date(tag(r, "datumPmZahajeniUpadku")) ?? "?"} to ${date(tag(r, "datumPmUkonceniUpadku")) ?? "ongoing"}`;
      return {
        label: `${who}, ${tag(r, "mesto") ?? "?"} — insolvency case ${file} at ${tag(r, "nazevOrganizace") ?? "?"}, ${span}`,
        url: tag(r, "urlDetailRizeni") ?? "https://isir.justice.cz/isir/common/index.do",
        status: state === null ? null : (STATES[state] ?? state),
        born: date(tag(r, "datumNarozeni")),
      };
    });
    return { hits, total: hits.length, note: null };
  },
};
