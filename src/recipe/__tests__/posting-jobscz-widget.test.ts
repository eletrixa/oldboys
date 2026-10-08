/**
 * Jobs.cz career-site widget chain: credentials from the page or the site script, the GraphQL reply to a posting, the fetch chain.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/posting-jobscz-widget.test.ts
 * Deps:    vitest, fixtures/postings/jobscz-widget-*
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - W1-W6: inline credentials, script discovery, meta refresh, script config, reply parsing, the chain with a fake fetch
 *
 * Design constraints:
 * - No network; the fake fetch answers by URL and records every request
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fetchJobsCzWidget,
  metaRefreshUrl,
  parseWidgetReply,
  WIDGET_API,
  widgetFromInline,
  widgetFromScript,
  widgetQuery,
  widgetScript,
} from "@/recipe/seams/posting-jobscz-widget";

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/postings/${name}`, import.meta.url), "utf8");
const PAGE_URL = "https://jablotron.jobs.cz/detail-pozice?r=detail&id=2001283886&rps=0&impressionId=";
const SCRIPT_URL = "https://jablotron.jobs.cz/assets/js/script.min.js?av=768f9ce6ef234ef2";
const ASSET_URL = "https://site-assets.jobs.cz/assets/jablotronalarms/768f9ce6ef234ef2/assets/js/script.min.js";
const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

type Call = { url: string; init?: RequestInit };
function fakeFetch(routes: Record<string, string | number>, calls: Call[]): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const hit = routes[url];
    if (hit === undefined) return Promise.resolve(new Response("not found", { status: 404 }));
    return Promise.resolve(typeof hit === "number" ? new Response("", { status: hit }) : new Response(hit, { status: 200 }));
  }) as typeof fetch;
}

describe("posting-jobscz-widget", () => {
  it("W1: inline __LMC_CAREER_WIDGET__.push gives widgetId and apiKey; a page without it gives undefined", () => {
    expect(widgetFromInline(fixture("jobscz-widget-inline.html"))).toEqual({ widgetId: "11111111-2222-4333-8444-555555555555", apiKey: KEY_A });
    expect(widgetFromInline(fixture("jobscz-widget-page.html"))).toBeUndefined();
    expect(widgetFromInline('<script>window.__LMC_CAREER_WIDGET__.push({"apiKey":"short","widgetId":"x"});</script>')).toBeUndefined();
  });

  it("W2: the site script and data-widget name are read from the page; a foreign-origin script is ignored", () => {
    expect(widgetScript(fixture("jobscz-widget-page.html"), PAGE_URL)).toEqual({ url: SCRIPT_URL, name: "main" });
    expect(widgetScript('<script src="/assets/js/script.min.js"></script>', PAGE_URL)).toEqual({ url: "https://jablotron.jobs.cz/assets/js/script.min.js", name: "main" });
    expect(widgetScript('<script src="https://evil.example/script.min.js"></script><div data-widget="main"></div>', PAGE_URL)).toBeUndefined();
    expect(widgetScript("<html></html>", PAGE_URL)).toBeUndefined();
  });

  it("W3: the meta-refresh page points at the asset host; other pages give undefined", () => {
    expect(metaRefreshUrl(fixture("jobscz-widget-redirect.html"))).toBe(ASSET_URL);
    expect(metaRefreshUrl("<html><head><meta http-equiv=\"refresh\" content=\"0;url='javascript:1'\"></head></html>")).toBeUndefined();
    expect(metaRefreshUrl("<html></html>")).toBeUndefined();
  });

  it("W4: the widgets config in the script gives the named entry, the first entry for an unknown name", () => {
    const js = fixture("jobscz-widget-script.js.txt");
    expect(widgetFromScript(js, "main")).toEqual({ widgetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", apiKey: KEY_B });
    expect(widgetFromScript(js, "main-sk")).toEqual({ widgetId: "ffffffff-0000-4111-8222-333333333333", apiKey: KEY_B });
    expect(widgetFromScript(js, "nope")?.widgetId).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(widgetFromScript("var x = 1;", "main")).toBeUndefined();
    expect(widgetFromScript('"widgets":{"main":{"id":"x"', "main")).toBeUndefined();
  });

  it("W5: the GraphQL reply gives title, employer, city and the content as text; junk gives empty text", () => {
    const r = parseWidgetReply(fixture("jobscz-widget-reply.json"));
    expect(r.title).toBe("Delphi vývojář/ka - produktový vývoj - remote/onsite");
    expect(r.company).toBe("JABLOTRON CLOUD Services s.r.o.");
    expect(r.location).toBe("Jablonec nad Nisou");
    expect(r.text).toContain("Delphi");
    expect(r.text).not.toMatch(/<[a-z]/);
    expect(r.text.length).toBeGreaterThan(1000);
    expect(parseWidgetReply('{"errors":[{"message":"WIDGET_NOT_FOUND"}]}')).toEqual({ text: "" });
    expect(parseWidgetReply("not json")).toEqual({ text: "" });
    const body = JSON.parse(widgetQuery("w", "123")) as { variables: unknown; query: string };
    expect(body.variables).toEqual({ widgetId: "w", jobAdId: "123" });
    expect(body.query).toContain("htmlContent");
  });

  it("W6: the chain fetches script, asset and API in order with the key as X-API-KEY; the inline page skips to the API", async () => {
    const calls: Call[] = [];
    const fetchFn = fakeFetch(
      { [SCRIPT_URL]: fixture("jobscz-widget-redirect.html"), [ASSET_URL]: fixture("jobscz-widget-script.js.txt"), [WIDGET_API]: fixture("jobscz-widget-reply.json") },
      calls,
    );
    const r = await fetchJobsCzWidget(fetchFn, { html: fixture("jobscz-widget-page.html"), url: PAGE_URL }, "2001283886", { headers: { "user-agent": "t" } });
    expect(r.parsed.title).toBe("Delphi vývojář/ka - produktový vývoj - remote/onsite");
    expect(r.raw).toContain("htmlContent");
    expect(calls.map((c) => c.url)).toEqual([SCRIPT_URL, ASSET_URL, WIDGET_API]);
    const api = calls[2]?.init;
    expect(api?.method).toBe("POST");
    expect((api?.headers as Record<string, string>)["x-api-key"]).toBe(KEY_B);
    expect((api?.headers as Record<string, string>)["user-agent"]).toBe("t");
    expect(JSON.parse(api?.body as string)).toMatchObject({ variables: { widgetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", jobAdId: "2001283886" } });

    const inline: Call[] = [];
    const r2 = await fetchJobsCzWidget(fakeFetch({ [WIDGET_API]: fixture("jobscz-widget-reply.json") }, inline), { html: fixture("jobscz-widget-inline.html"), url: "https://asseco.jobs.cz/?r=detail&id=2001292088" }, "2001292088");
    expect(r2.parsed.company).toBe("JABLOTRON CLOUD Services s.r.o.");
    expect(inline.map((c) => c.url)).toEqual([WIDGET_API]);
    expect((inline[0]?.init?.headers as Record<string, string>)["x-api-key"]).toBe(KEY_A);
  });

  it("W7: failures are plain errors: no widget on the page, HTTP error on the script, empty reply, missing id", async () => {
    const none: Call[] = [];
    await expect(fetchJobsCzWidget(fakeFetch({}, none), { html: "<html></html>", url: PAGE_URL }, "1")).rejects.toThrow("no career widget on the page");
    expect(none).toHaveLength(0);
    await expect(fetchJobsCzWidget(fakeFetch({ [SCRIPT_URL]: 503 }, []), { html: fixture("jobscz-widget-page.html"), url: PAGE_URL }, "1")).rejects.toThrow("HTTP 503 from jablotron.jobs.cz");
    await expect(
      fetchJobsCzWidget(fakeFetch({ [WIDGET_API]: '{"data":{"widget":{"jobAd":null}}}' }, []), { html: fixture("jobscz-widget-inline.html"), url: PAGE_URL }, "1"),
    ).rejects.toThrow("career widget returned no posting");
    await expect(fetchJobsCzWidget(fakeFetch({}, []), { html: fixture("jobscz-widget-inline.html"), url: PAGE_URL }, "")).rejects.toThrow("no job ad id");
  });
});
