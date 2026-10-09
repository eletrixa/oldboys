/**
 * Exa people search via treg: LinkedIn profiles for the name when none is confirmed yet (CV-only runs).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/people-search.ts
 * Deps:    zod, src/domain/corroborate (mentionsFullName), src/recipe/sources/types
 * Tested:  src/recipe/__tests__/treg-search.test.ts
 *
 * Key responsibilities:
 * - Runs before the lineup when no LinkedIn candidate is merged: one `exa.people.search` call
 *   (`<subject> <anchor>`, category people, 5 results, linkedin.com only; cost $0.007, capped at $0.01)
 * - One Source per linkedin.com/in/ result whose entity name spells the full name (result title only when the entity name is missing): canonical profile URL,
 *   excerpt line 1 `<name> – <latest title> @ <company>`, search note, location, up to 4 work history lines
 *
 * Design constraints:
 * - Pure: no fetch; identity stays "unverified" (the lineup scores the hit against the anchor and employers)
 * - Name rule: entity name only; a title never rescues a result whose entity name is someone else
 * - Allow-list parse: name, location and work history only
 */
import { z } from "zod";
import { mentionsFullName } from "@/domain/corroborate";
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

const text = (v: string | null | undefined): string => v?.trim() ?? "";

/** `https://www.linkedin.com/in/<slug>/` for a linkedin.com/in/ URL, else null. */
function canonicalProfile(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const [first, slug] = u.pathname.split("/").filter((s) => s !== "");
  return first === "in" && slug !== undefined ? `https://www.linkedin.com/in/${slug}/` : null;
}

type WorkItem = z.infer<typeof Work>;

/** `<title> @ <company>`, empty parts omitted. */
function roleOf(j: WorkItem): string {
  return [text(j.title), text(j.company?.name)].filter((s) => s !== "").join(" @ ");
}

/** `<title> @ <company> (<from>–<to>)`, empty parts omitted; no parenthesis without a start date. */
function historyLine(j: WorkItem): string {
  const role = roleOf(j);
  const from = text(j.dates?.from);
  const to = text(j.dates?.to);
  return from === "" ? role : `${role} (${from}–${to === "" ? "now" : to})`;
}

const query = (ctx: StepContext): string => `${ctx.subject} ${ctx.anchor}`.trim();

/** The Source for one search result, or null when it is no LinkedIn profile or its name does not spell the full subject name. */
function sourceOf(item: unknown, ctx: StepContext): ParsedSource | null {
  const r = Result.safeParse(item);
  if (!r.success) return null;
  const url = canonicalProfile(r.data.url);
  const props = r.data.entities?.[0]?.properties;
  const name = text(props?.name) || text(r.data.title); // title only when the entity name is missing
  if (url === null || !mentionsFullName(ctx.subject, name)) return null;
  const work = (props?.workHistory ?? []).flatMap((w) => {
    const j = Work.safeParse(w);
    return j.success && (text(j.data.title) !== "" || text(j.data.company?.name) !== "") ? [j.data] : [];
  });
  const headline = work[0] === undefined ? "" : roleOf(work[0]);
  const location = text(props?.location);
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
