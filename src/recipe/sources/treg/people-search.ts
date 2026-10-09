/**
 * Exa people search via treg: LinkedIn profiles for the name when none is confirmed yet (CV-only runs).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/people-search.ts
 * Deps:    zod, src/domain/corroborate (mentionsFullName), src/domain/profile-url (normalizeLinkedinProfile), src/recipe/sources/text (txt), src/recipe/sources/types
 * Tested:  src/recipe/__tests__/treg-search.test.ts
 *
 * Key responsibilities:
 * - Runs before the lineup when no LinkedIn candidate is merged: one `exa.people.search` call
 *   (`<subject> <anchor>`, category people, 5 results, linkedin.com only; cost $0.007, capped at $0.01)
 * - One Source per linkedin.com/in/ result whose entity name spells the full name (result title only when the entity name is missing): canonical profile URL (the form the other LinkedIn collectors store),
 *   excerpt line 1 `<name> – <latest title> @ <company>`, search note, location, up to 4 work history lines
 *
 * Design constraints:
 * - Pure: no fetch; identity stays "unverified" (the lineup scores the hit against the anchor and employers)
 * - Name rule: entity name only; a title never rescues a result whose entity name is someone else
 * - Allow-list parse: name, location and work history only
 */
import { z } from "zod";
import { mentionsFullName } from "@/domain/corroborate";
import { normalizeLinkedinProfile } from "@/domain/profile-url";
import { txt } from "@/recipe/sources/text";
import type { Collector, ParsedSource, StepContext } from "@/recipe/sources/types";
import { acceptedCandidates, clip, identityFor } from "@/recipe/sources/types";

const Work = z.object({
  title: z.string().nullish(),
  company: z.object({ name: z.string().nullish() }).nullish(),
  dates: z.object({ from: z.string().nullish(), to: z.string().nullish() }).nullish(),
});
const Props = z.object({ name: z.string().nullish(), location: z.string().nullish(), workHistory: z.array(z.unknown()).nullish() });
const Result = z.object({ url: z.string(), title: z.string().nullish(), entities: z.array(z.object({ properties: Props.nullish() })).nullish() });
const Payload = z.object({ results: z.array(z.unknown()) });

type WorkItem = z.infer<typeof Work>;

/** `<title> @ <company>`, empty parts omitted. */
function roleOf(j: WorkItem): string {
  return [txt(j.title), txt(j.company?.name)].filter((s) => s !== "").join(" @ ");
}

/** `<title> @ <company> (<from>–<to>)`, empty parts omitted; no parenthesis without a start date. */
function historyLine(j: WorkItem): string {
  const role = roleOf(j);
  const from = txt(j.dates?.from);
  const to = txt(j.dates?.to);
  return from === "" ? role : `${role} (${from}–${to === "" ? "now" : to})`;
}

const query = (ctx: StepContext): string => `${ctx.subject} ${ctx.anchor}`.trim();

/** The Source for one search result, or null when it is no LinkedIn profile or its name does not spell the full subject name. */
function sourceOf(item: unknown, ctx: StepContext): ParsedSource | null {
  const r = Result.safeParse(item);
  if (!r.success) return null;
  const url = normalizeLinkedinProfile(r.data.url);
  const props = r.data.entities?.[0]?.properties;
  const name = txt(props?.name) || txt(r.data.title); // title only when the entity name is missing
  if (url === null || !mentionsFullName(ctx.subject, name)) return null;
  const work = (props?.workHistory ?? []).flatMap((w) => {
    const j = Work.safeParse(w);
    return j.success && (txt(j.data.title) !== "" || txt(j.data.company?.name) !== "") ? [j.data] : [];
  });
  const headline = work[0] === undefined ? "" : roleOf(work[0]);
  const location = txt(props?.location);
  const lines = [
    headline === "" ? name : `${name} – ${headline}`,
    `Found by Exa people search for "${query(ctx)}" via treg`,
    location === "" ? "" : `Location: ${location}`,
    ...work.slice(0, 4).map(historyLine),
  ].filter((l) => l !== "");
  return { url, excerpt: clip(lines.join("\n")), raw: { url, name, location, workHistory: work }, identity: identityFor(ctx, url) };
}

export const tregPeopleSearch: Collector = {
  id: "treg/people-search",
  requests: (ctx) => {
    if (ctx.subject.trim() === "") return [];
    if (acceptedCandidates(ctx).some((c) => c.platform === "linkedin")) return [];
    return [
      {
        via: "treg",
        endpoint: "exa.people.search",
        method: "POST",
        params: { query: query(ctx), category: "people", numResults: 5, includeDomains: ["linkedin.com"] },
        maxCostUsd: 0.01,
      },
    ];
  },
  skipReason: (ctx) => (ctx.subject.trim() === "" ? "no name to search" : "a LinkedIn profile is already confirmed (given profile)"),
  parse: (payload, ctx) => {
    const p = Payload.safeParse(payload);
    if (!p.success) return [];
    const seen = new Set<string>();
    const out: ParsedSource[] = [];
    for (const item of p.data.results) {
      const src = sourceOf(item, ctx);
      if (src === null || seen.has(src.url)) continue;
      seen.add(src.url);
      out.push(src);
    }
    return out;
  },
};
