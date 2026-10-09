/**
 * `rest/cz-registries` collector: one request per Czech public registry the position needs, one Source per registry answered,
 * and the RegistryChecks digest the run page reads.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/index.ts
 * Deps:    src/domain/cz-registry (catalog, digest schema), src/domain/corroborate (place, employer tokens), src/recipe/sources/linkedin
 *          (experience companies of merged profiles; not the resolve seam, which would import the runner back into the sources), ./isir ./ares ./justice ./police ./cak ./chambers-html ./chambers-json, ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - `requests`: `registriesFor(ctx.role)` filtered to the registries that have a source here; nothing without a two-token name
 * - `attribute`: a hit is the candidate's when its label carries the anchor's city (Czech declensions and the English name of the
 *   city included) or a distinctive token of a confirmed employer (merged LinkedIn profile experience); `match` says which
 * - In the PLACED registries (the label names a town or address) a hit that matches nothing while the candidate's city is known
 *   is a namesake: counted, not listed; without a known city every hit stays listed as "namesake possible"
 * - `parse`: the registry's answer -> one Source whose excerpt says, in plain sentences, what the registry lists under the name
 *   (or that nothing is listed), so verify can quote it; identity stays "unverified" (a name match is never a confirmed identity)
 * - `digest`: RegistryChecks over every performed request; a registry that was requested but got no answer is `unavailable`
 *
 * Design constraints:
 * - Pure; registries without a working public endpoint (CAPTCHA, login) are not here and are listed as "not checked" by the UI
 * - Excerpts never carry a birth number; hits are the registry's own wording plus a link
 */
import { employerHit, fold, hasWord, type OrgToken, orgTokens, placeOf } from "@/domain/corroborate";
import { type RegistryCheck, type RegistryChecks, type RegistryHit, type RegistryId, registriesFor, registryById } from "@/domain/cz-registry";
import { experienceCompanies, LINKEDIN_PROFILE_ACTORS } from "@/recipe/sources/linkedin";
import type { Collector, CollectorRequest, Fetched, StepContext } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";
import { aresPerson } from "./ares";
import { cak } from "./cak";
import { ckait, clnk, ekcr, kacr, kdp, nkcr, nrpzs } from "./chambers-html";
import { cka, csk } from "./chambers-json";
import { isir } from "./isir";
import { justicePersons } from "./justice";
import { police } from "./police";
import { type Answer, type PersonName, personName, type RegistrySource } from "./shared";

export const SOURCES: readonly RegistrySource[] = [isir, aresPerson, justicePersons, police, cak, nrpzs, cka, ckait, kdp, kacr, nkcr, ekcr, csk, clnk];
const byId = new Map(SOURCES.map((s) => [s.id, s]));

/** Registries the collector can query for this role (catalog order). */
export function availableFor(role: string | null): RegistrySource[] {
  return registriesFor(role).flatMap((r) => byId.get(r.id) ?? []);
}

function sourceOf(req: CollectorRequest, name: PersonName): RegistrySource | null {
  if (req.via !== "fetch") return null;
  const url = req.url;
  return SOURCES.find((s) => {
    const own = s.request(name);
    return own.via === "fetch" && own.url === url;
  }) ?? null;
}

/** Registries whose hit label names a town or address, so a hit at another place can be set aside as a namesake. */
const PLACED: ReadonlySet<RegistryId> = new Set(["isir", "ares", "justice-or", "cka", "csk", "kacr", "nkcr", "ekcr", "nrpzs"]);

/** Anchor words that are not the place itself ("Hlavní město Praha", "Prague Metropolitan Area", "okres Příbram"). */
const PLACE_STOP = new Set(["hlavni", "mesto", "stred", "nad", "pod", "metropolitan", "area", "region", "kraj", "okres", "district", "czechia", "czech", "republic", "republika", "ceska"]);
const PLACE_ALIAS: Record<string, string[]> = {
  prague: ["praha", "praze", "prahy", "prahu"],
  praha: ["praze", "prahy", "prahu", "prague"],
  brno: ["brne", "brna"],
  ostrava: ["ostrave", "ostravy"],
  plzen: ["plzni", "plzne", "pilsen"],
  olomouc: ["olomouci", "olomouce"],
  liberec: ["liberci", "liberce"],
  pardubice: ["pardubicich", "pardubic"],
  budejovice: ["budejovicich", "budejovic"],
  vary: ["varech", "varu"],
  zlin: ["zline", "zlina"],
};

/** Folded words that name the anchor's city, with Czech locative / genitive forms and the English name; never the subject's own name parts. */
export function placeWords(anchor: string, subject = ""): string[] {
  const place = placeOf(anchor);
  if (place === null) return [];
  const nameParts = new Set(fold(subject).split(/[^a-z]+/));
  const words = place.split(/[^a-z]+/).filter((w) => w.length >= 3 && !PLACE_STOP.has(w) && !nameParts.has(w));
  return [...new Set(words.flatMap((w) => [w, ...(PLACE_ALIAS[w] ?? []), ...(w.endsWith("o") || w.endsWith("a") ? [`${w.slice(0, -1)}e`] : [])]))];
}

type Who = { places: string[]; tokens: OrgToken[] };

/** Same set as resolve's mergedProfileOrgs: companies in the experience lines of merged LinkedIn profile sources. */
function whoIs(ctx: StepContext): Who {
  const orgs = ctx.sources.filter((s) => s.identity === "merged" && LINKEDIN_PROFILE_ACTORS.has(s.actor)).flatMap((s) => experienceCompanies(s.excerpt));
  return { places: placeWords(ctx.anchor, ctx.subject), tokens: orgTokens(orgs, ctx.subject) };
}

/** Why a hit is the candidate's: its label names the anchor's city or a confirmed employer; null when only the name matches. */
export function attribute(hit: Pick<RegistryHit, "label">, who: Who): string | null {
  const hay = fold(hit.label);
  const place = who.places.find((w) => hasWord(hay, w));
  if (place !== undefined) return `city: ${place.charAt(0).toUpperCase()}${place.slice(1)}`;
  const org = employerHit(hit.label, who.tokens);
  return org === null ? null : `company: ${org}`;
}

/** Hits attributed to the candidate and the count set aside as namesakes (PLACED registries, city known). */
function sort(source: RegistrySource, a: Answer, who: Who): { own: RegistryHit[]; namesakes: number } {
  const all = a.hits.map((h) => ({ ...h, match: attribute(h, who) }));
  if (!PLACED.has(source.id) || who.places.length === 0) return { own: all, namesakes: 0 };
  const own = all.filter((h) => h.match !== null);
  return { own, namesakes: all.length - own.length };
}

function check(source: RegistrySource, name: PersonName, a: Answer, who: Who): RegistryCheck {
  const { own, namesakes } = sort(source, a, who);
  return {
    registry: source.id,
    status: a.note !== null ? "unavailable" : own.length > 0 ? "hits" : namesakes > 0 ? "namesakes" : "clear",
    searched: `${name.first} ${name.last}`,
    source_url: source.url(name),
    hits: own,
    namesakes,
    total: a.total,
    note: a.note,
  };
}

function sentence(source: RegistrySource, name: PersonName, a: Answer, who: Who): string {
  const r = registryById(source.id);
  const label = `${r.name} (${r.name_cs})`;
  if (a.note !== null) return `${label} could not be checked for ${name.full}: ${a.note}.`;
  if (a.hits.length === 0) return `${label} lists no record under the name ${name.full}.`;
  const { own, namesakes } = sort(source, a, who);
  const city = who.places[0] ?? "";
  const where = city === "" ? "" : ` (${city.charAt(0).toUpperCase()}${city.slice(1)})`;
  if (own.length === 0) {
    return `${label} lists ${String(namesakes)} record${namesakes === 1 ? "" : "s"} under the name ${name.full}, none at the candidate's city${where} or employers; left out as namesakes.`;
  }
  const lines = own.map((h) => `- ${h.label}${h.status === null ? "" : ` [${h.status}]`}${h.match === null ? "" : ` (${h.match})`}`);
  const n = own.length;
  if (namesakes === 0 && own.every((h) => h.match === null)) {
    const count = a.total !== null && a.total > n ? `${String(a.total)} records (first ${String(n)} shown)` : `${String(n)} record${n === 1 ? "" : "s"}`;
    return `${label} lists ${count} under the name ${name.full}; a namesake is possible:\n${lines.join("\n")}`;
  }
  const aside = namesakes === 0 ? "" : `\n${String(namesakes)} other record${namesakes === 1 ? "" : "s"} under the same name elsewhere left out as namesakes.`;
  return `${label} lists ${String(n)} record${n === 1 ? "" : "s"} under the name ${name.full} at the candidate's city or employer:\n${lines.join("\n")}${aside}`;
}

export const czRegistries: Collector = {
  id: "rest/cz-registries",
  requests: (ctx) => {
    const name = personName(ctx.subject);
    if (name === null) return [];
    return availableFor(ctx.role).map((s) => s.request(name));
  },
  parse: (payload, ctx, _step, req) => {
    const name = personName(ctx.subject);
    if (name === null || req === undefined) return [];
    const source = sourceOf(req, name);
    if (source === null) return [];
    const a = source.parse(payload, name);
    return [{ url: source.url(name), excerpt: clip(sentence(source, name, a, whoIs(ctx))), raw: { registry: source.id, ...a }, identity: "unverified" as const }];
  },
  skipReason: (ctx) => (personName(ctx.subject) === null ? "name could not be split into given name and surname" : null),
  digest: (fetched, ctx) => digestOf(fetched, ctx),
};

export function digestOf(fetched: readonly Fetched[], ctx: StepContext): RegistryChecks | null {
  const name = personName(ctx.subject);
  if (name === null) return null;
  const who = whoIs(ctx);
  const answered = new Map<RegistryId, RegistryCheck>();
  for (const f of fetched) {
    const source = sourceOf(f.req, name);
    if (source !== null) answered.set(source.id, check(source, name, source.parse(f.payload, name), who));
  }
  const checks = availableFor(ctx.role).map(
    (s) => answered.get(s.id) ?? check(s, name, { hits: [], total: null, note: "no answer from the registry (request failed or run budget reached)" }, who),
  );
  return { subject: name.full, role: ctx.role, checks };
}
