/**
 * Tests for the Wikipedia collector.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-wikipedia.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - requests, followUp selection, summary parsing, discovery-only search payloads, digest
 *
 * Design constraints:
 * - No network; fixtures follow real Wikipedia responses
 */
import { describe, expect, it } from "vitest";
import { wikipedia } from "@/recipe/sources/wikipedia";
import type { CollectorRequest, Fetched } from "@/recipe/sources/types";
import { baseContext } from "@/recipe/__tests__/fakes";
import type { Step } from "@/recipe/step";

const step = {} as Step;
const ctx = baseContext({ subject: "Dušan Šenkypl" });
const UA = "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)";

const csSearch = {
  query: {
    search: [
      { title: "Dušan Šenkypl", snippet: '<span class="searchmatch">Dušan</span> <span class="searchmatch">Šenkypl</span> (* 1976) je český podnikatel', pageid: 1 },
      { title: "Dušan", snippet: 'Dušan je mužské jméno', pageid: 2 },
      { title: "EPojisteni.cz", snippet: 'zakladatel <span class="searchmatch">Dušan</span> <span class="searchmatch">Šenkypl</span>', pageid: 3 },
    ],
  },
};
const enSearch = {
  query: { search: [{ title: "Groupon", snippet: 'led by <span class="searchmatch">Dusan</span> <span class="searchmatch">Senkypl</span> as CEO', pageid: 9 }] },
};
const searchReq = (l: string): CollectorRequest => wikipedia.requests(ctx, step).find((r) => r.via === "fetch" && r.url.startsWith(`https://${l}.`)) ?? { via: "fetch", url: "" };
const fetched: Fetched[] = [
  { req: searchReq("en"), payload: enSearch },
  { req: searchReq("cs"), payload: csSearch },
];

describe("wikipedia", () => {
  it("searches en and cs with the user-agent", () => {
    const reqs = wikipedia.requests(ctx, step);
    expect(reqs).toEqual([
      { via: "fetch", url: "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=Du%C5%A1an%20%C5%A0enkypl&format=json&srlimit=5", init: { headers: expect.objectContaining({ "user-agent": UA }) as unknown } },
      { via: "fetch", url: "https://cs.wikipedia.org/w/api.php?action=query&list=search&srsearch=Du%C5%A1an%20%C5%A0enkypl&format=json&srlimit=5", init: { headers: expect.objectContaining({ "user-agent": UA }) as unknown } },
    ]);
  });

  it("follows only full-name hits", () => {
    const urls = (wikipedia.followUp?.(ctx, step, fetched) ?? []).map((r) => (r.via === "fetch" ? r.url : ""));
    expect(urls).toEqual([
      "https://en.wikipedia.org/api/rest_v1/page/summary/Groupon",
      "https://cs.wikipedia.org/api/rest_v1/page/summary/Du%C5%A1an_%C5%A0enkypl",
      "https://cs.wikipedia.org/api/rest_v1/page/summary/EPojisteni.cz",
    ]);
    const first = wikipedia.followUp?.(ctx, step, fetched)[0];
    expect(first).toMatchObject({ init: { headers: { "user-agent": UA } } });
  });

  it("caps follow-ups at 3 per language and ignores bad payloads", () => {
    const many = { query: { search: Array.from({ length: 5 }, (_, i) => ({ title: `Dušan Šenkypl ${String(i)}`, snippet: "" })) } };
    const out = wikipedia.followUp?.(ctx, step, [{ req: searchReq("cs"), payload: many }, { req: searchReq("en"), payload: null }]) ?? [];
    expect(out).toHaveLength(3);
  });

  it("turns a summary into one source", () => {
    const req: CollectorRequest = { via: "fetch", url: "https://cs.wikipedia.org/api/rest_v1/page/summary/Du%C5%A1an_%C5%A0enkypl" };
    const out = wikipedia.parse(
      { title: "Dušan Šenkypl", description: "český podnikatel", extract: "Dušan Šenkypl je zakladatel EPojisteni.cz.", content_urls: { desktop: { page: "https://cs.wikipedia.org/wiki/Du%C5%A1an_%C5%A0enkypl" } } },
      ctx,
      step,
      req,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: "https://cs.wikipedia.org/wiki/Du%C5%A1an_%C5%A0enkypl", identity: "unverified" });
    expect(out[0]?.excerpt).toBe("Dušan Šenkypl. český podnikatel. Dušan Šenkypl je zakladatel EPojisteni.cz.");
  });

  it("falls back to a wiki url from the request language", () => {
    const req: CollectorRequest = { via: "fetch", url: "https://en.wikipedia.org/api/rest_v1/page/summary/Groupon" };
    expect(wikipedia.parse({ title: "Groupon", extract: "Dusan Senkypl led it." }, ctx, step, req)[0]?.url).toBe("https://en.wikipedia.org/wiki/Groupon");
  });

  it("search payloads and null payloads give no sources", () => {
    expect(wikipedia.parse(csSearch, ctx, step, searchReq("cs"))).toEqual([]);
    expect(wikipedia.parse(null, ctx, step, searchReq("cs"))).toEqual([]);
    expect(wikipedia.parse(null, ctx, step)).toEqual([]);
  });

  it("digests searched languages and article count", () => {
    const sum: Fetched = { req: { via: "fetch", url: "https://en.wikipedia.org/api/rest_v1/page/summary/Groupon" }, payload: { title: "Groupon", extract: "x" } };
    expect(wikipedia.digest?.([...fetched, sum], ctx)).toEqual({ searched: ["en", "cs"], articles: 1 });
  });
});
