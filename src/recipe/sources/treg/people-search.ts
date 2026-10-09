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
 * - One Source per linkedin.com/in/ result whose entity name or title spells the full name: canonical profile URL,
 *   excerpt line 1 `<name> – <latest title> @ <company>`, search note, location, up to 4 work history lines
 *
 * Design constraints:
 * - Pure: no fetch; identity stays "unverified" (the lineup scores the hit against the anchor and employers)
 * - Allow-list parse: name, location and work history only
 */
import { z } from "zod";
import { mentionsFullName } from "@/domain/corroborate";
import type { Collector, ParsedSource } from "@/recipe/sources/types";
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
  if (!u.hostname.toLowerCase().endsWith("linkedin.com")) return null;
  const [first, slug] = u.pathname.split("/").filter((s) => s !== "");
  return first === "in" && slug !== undefined ? `https://www.linkedin.com/in/${slug}/` : null;
}

const query = (ctx: { subject: string; anchor: string }): string => `${ctx.subject} ${ctx.anchor}`.trim();

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
      const r = Result.safeParse(item);
      if (!r.success) continue;
      const url = canonicalProfile(r.data.url);
      const props = r.data.entities?.[0]?.properties;
      const name = text(props?.name) || text(r.data.title);
      if (url === null || seen.has(url) || !(mentionsFullName(ctx.subject, name) || mentionsFullName(ctx.subject, text(r.data.title)))) continue;
      seen.add(url);
      const work = (props?.workHistory ?? []).flatMap((w) => {
        const j = Work.safeParse(w);
        return j.success && (text(j.data.title) !== "" || text(j.data.company?.name) !== "") ? [j.data] : [];
      });
      const latest = work[0];
      const headline = latest === undefined ? "" : [text(latest.title), text(latest.company?.name)].filter((s) => s !== "").join(" @ ");
      const lines = [
        headline === "" ? name : `${name} – ${headline}`,
        `Found by Exa people search for "${query(ctx)}" via treg`,
        text(props?.location) === "" ? "" : `Location: ${text(props?.location)}`,
        ...work.slice(0, 4).map((j) => `${text(j.title)} @ ${text(j.company?.name)} (${text(j.dates?.from)}–${text(j.dates?.to) || "now"})`),
      ].filter((l) => l !== "");
      out.push({ url, excerpt: clip(lines.join("\n")), raw: { url, name, location: text(props?.location), workHistory: work }, identity: identityFor(ctx, url) });
    }
    return out;
  },
};
