/**
 * Tests for the podcast episode collector.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-podcasts.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - request url and headers, surname filter, ordering, cap, excerpt wording, digest
 *
 * Design constraints:
 * - No network; fixtures follow the Apple search response
 */
import { describe, expect, it } from "vitest";
import { podcasts } from "@/recipe/sources/podcasts";
import { baseContext } from "@/recipe/__tests__/fakes";
import type { Step } from "@/recipe/step";

const step = {} as Step;
const ctx = baseContext({ subject: "Dušan Šenkypl" });

const ep = (over: Record<string, unknown>) => ({
  trackName: "The Groupon Turnaround | Dušan Šenkypl & Rana Kashyap | Ep. 3",
  collectionName: "Mispriced Assets Podcast",
  releaseDate: "2026-09-11T16:21:11Z",
  trackViewUrl: "https://podcasts.apple.com/us/podcast/ep3/id1?i=3",
  description: "Dušan Šenkypl on turning Groupon around.",
  ...over,
});

describe("podcasts", () => {
  it("makes one search request with the user-agent", () => {
    expect(podcasts.requests(ctx, step)).toEqual([
      {
        via: "fetch",
        url: "https://itunes.apple.com/search?term=Du%C5%A1an%20%C5%A0enkypl&media=podcast&entity=podcastEpisode&limit=25",
        init: { headers: expect.objectContaining({ "user-agent": "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)" }) as unknown },
      },
    ]);
  });

  it("keeps episodes naming the surname (title or description), diacritics-insensitive", () => {
    const out = podcasts.parse(
      { resultCount: 3, results: [ep({}), ep({ trackName: "Unrelated", description: "Interview with Senkypl about insurance", trackViewUrl: "u2" }), ep({ trackName: "Other", description: "nothing", trackViewUrl: "u3" })] },
      ctx,
      step,
    );
    expect(out.map((s) => s.url)).toEqual(["https://podcasts.apple.com/us/podcast/ep3/id1?i=3", "u2"]);
  });

  it("writes plain-sentence excerpts with the description", () => {
    const out = podcasts.parse({ results: [ep({})] }, ctx, step);
    expect(out[0]?.excerpt).toBe(
      "Podcast episode 'The Groupon Turnaround | Dušan Šenkypl & Rana Kashyap | Ep. 3' on Mispriced Assets Podcast, released 2026-09-11. Dušan Šenkypl on turning Groupon around.",
    );
    expect(out[0]?.identity).toBe("unverified");
  });

  it("cuts descriptions at 700 chars, orders newest first and caps at 15", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      ep({ trackViewUrl: `u${String(i)}`, releaseDate: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, description: `Šenkypl ${"x".repeat(900)}` }),
    );
    const out = podcasts.parse({ results }, ctx, step);
    expect(out).toHaveLength(15);
    expect(out[0]?.url).toBe("u19");
    expect(out[0]?.excerpt.split("Šenkypl ")[1]?.length).toBeLessThanOrEqual(700);
  });

  it("returns [] for null or malformed payloads", () => {
    expect(podcasts.parse(null, ctx, step)).toEqual([]);
    expect(podcasts.parse({ foo: 1 }, ctx, step)).toEqual([]);
  });

  it("digests the episode count", () => {
    const req = podcasts.requests(ctx, step)[0] ?? { via: "fetch" as const, url: "" };
    expect(podcasts.digest?.([{ req, payload: { results: [ep({}), ep({ trackName: "No", description: "no" })] } }], ctx)).toEqual({ episodes: 1 });
  });
});
