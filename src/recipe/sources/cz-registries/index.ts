/**
 * `rest/cz-registries` collector: one request per Czech public registry the position needs, one Source per registry answered,
 * and the RegistryChecks digest the run page reads.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/index.ts
 * Deps:    src/domain/cz-registry (catalog, digest schema), ./isir ./ares ./justice ./police ./cak ./chambers-html ./chambers-json, ./shared
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - `requests`: `registriesFor(ctx.role)` filtered to the registries that have a source here; nothing without a two-token name
 * - `parse`: the registry's answer -> one Source whose excerpt says, in plain sentences, what the registry lists under the name
 *   (or that nothing is listed), so verify can quote it; identity stays "unverified" (a name match is never a confirmed identity)
 * - `digest`: RegistryChecks over every performed request; a registry that was requested but got no answer is `unavailable`
 *
 * Design constraints:
 * - Pure; registries without a working public endpoint (CAPTCHA, login) are not here and are listed as "not checked" by the UI
 * - Excerpts never carry a birth number; hits are the registry's own wording plus a link
 */
import { type RegistryCheck, type RegistryChecks, type RegistryId, registriesFor, registryById } from "@/domain/cz-registry";
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

function check(source: RegistrySource, name: PersonName, a: Answer): RegistryCheck {
  return {
    registry: source.id,
    status: a.note !== null ? "unavailable" : a.hits.length > 0 ? "hits" : "clear",
    searched: `${name.first} ${name.last}`,
    source_url: source.url(name),
    hits: a.hits,
    total: a.total,
    note: a.note,
  };
}

function sentence(source: RegistrySource, name: PersonName, a: Answer): string {
  const r = registryById(source.id);
  if (a.note !== null) return `${r.name} (${r.name_cs}) could not be checked for ${name.full}: ${a.note}.`;
  if (a.hits.length === 0) return `${r.name} (${r.name_cs}) lists no record under the name ${name.full}.`;
  const count = a.total !== null && a.total > a.hits.length ? `${String(a.total)} records (first ${String(a.hits.length)} shown)` : `${String(a.hits.length)} record${a.hits.length === 1 ? "" : "s"}`;
  const lines = a.hits.map((h) => `- ${h.label}${h.status === null ? "" : ` [${h.status}]`}`);
  return `${r.name} (${r.name_cs}) lists ${count} under the name ${name.full}; a namesake is possible:\n${lines.join("\n")}`;
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
    return [{ url: source.url(name), excerpt: clip(sentence(source, name, a)), raw: { registry: source.id, ...a }, identity: "unverified" as const }];
  },
  skipReason: (ctx) => (personName(ctx.subject) === null ? "name could not be split into given name and surname" : null),
  digest: (fetched, ctx) => digestOf(fetched, ctx),
};

export function digestOf(fetched: readonly Fetched[], ctx: StepContext): RegistryChecks | null {
  const name = personName(ctx.subject);
  if (name === null) return null;
  const answered = new Map<RegistryId, RegistryCheck>();
  for (const f of fetched) {
    const source = sourceOf(f.req, name);
    if (source !== null) answered.set(source.id, check(source, name, source.parse(f.payload, name)));
  }
  const checks = availableFor(ctx.role).map(
    (s) => answered.get(s.id) ?? check(s, name, { hits: [], total: null, note: "no answer from the registry (request failed or run budget reached)" }),
  );
  return { subject: name.full, role: ctx.role, checks };
}
