/**
 * Tests for the rest/read-pages collector: which confirmed pages it reads, and the excerpt it writes back.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-read-pages.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Request selection: merged web pages only, skip list, file extensions, already-read excerpts, sec.gov first, READ_MAX cap, skipReason
 * - parse: a page without the surname yields nothing; a page with mentions yields a merged `replaces` source with title + windows
 */
import { describe, expect, it } from "vitest";
import type { Source } from "@/domain/claim";
import { READ_EXCERPT_MAX, READ_MAX, readPages } from "@/recipe/sources/read-pages";
import type { CollectorRequest } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";
import { baseContext } from "@/recipe/__tests__/fakes";

const step: Step = { id: "read_pages", kind: "actor", actor: "rest/read-pages" };

let n = 0;
function src(url: string, over: Partial<Source> = {}): Source {
  n += 1;
  return { id: `s${String(n)}`, run_id: "run-1", url, actor: "apify/google-search-scraper", fetched_at: "t", excerpt: "snippet", r2_key: "k", expires_at: "t", identity: "merged", ...over };
}

const urls = (reqs: CollectorRequest[]): string[] => reqs.map((r) => (r.via === "fetch" ? r.url : r.via === "actor" ? r.actor : r.endpoint));

describe("readPages.requests", () => {
  it("reads merged web pages only, skipping social sites, aggregators, files and already-read excerpts", () => {
    const ctx = baseContext({
      sources: [
        src("https://example.cz/clanek/jana"),
        src("https://news.example.com/a", { identity: "unverified" }),
        src("https://www.linkedin.com/in/jana"),
        src("https://cz.linkedin.com/pulse/x"),
        src("https://rocketreach.co/jana-dvorakova"),
        src("https://blog.github.com/post"),
        src("https://example.cz/report.PDF"),
        src("https://example.cz/feed.xml"),
        src("https://example.cz/read", { excerpt: "x".repeat(3000) }),
        src("ftp://example.cz/file"),
        src("cv:run-1"),
      ],
    });
    expect(urls(readPages.requests(ctx, step))).toEqual(["https://example.cz/clanek/jana"]);
  });

  it("sends an HTML accept header and a named user agent", () => {
    const [req] = readPages.requests(baseContext({ sources: [src("https://example.cz/a")] }), step);
    expect(req).toEqual({
      via: "fetch",
      url: "https://example.cz/a",
      init: { headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; oldboys-hackathon/0.1; +https://oldboys.asajj.cz)" } },
    });
  });

  it("puts sec.gov pages first and caps at READ_MAX", () => {
    const web = Array.from({ length: READ_MAX + 3 }, (_, i) => src(`https://example.cz/p${String(i)}`));
    const sec = src("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany");
    const got = urls(readPages.requests(baseContext({ sources: [...web, sec] }), step));
    expect(got).toHaveLength(READ_MAX);
    expect(got[0]).toBe(sec.url);
    expect(got[1]).toBe("https://example.cz/p0");
  });

  it("names why it read nothing", () => {
    expect(readPages.requests(baseContext(), step)).toEqual([]);
    expect(readPages.skipReason?.(baseContext())).toBe("no confirmed web pages to read");
  });
});

describe("readPages.parse", () => {
  const req: CollectorRequest = { via: "fetch", url: "https://example.cz/clanek/jana" };
  const ctx = baseContext();

  it("returns nothing for a page that never names the surname (not about them, or needs JavaScript)", () => {
    expect(readPages.parse("<html><title>App</title><body><div id=root></div></body></html>", ctx, step, req)).toEqual([]);
    expect(readPages.parse({ not: "html" }, ctx, step, req)).toEqual([]);
  });

  it("writes the title and the passages around the person as a merged replacement", () => {
    const filler = "<p>Lorem ipsum dolor sit amet.</p>".repeat(60);
    const html = `<html><head><title>Data team | Example</title></head><body>${filler}<p>Jana Dvořáková leads the data platform.</p>${filler}<p>Dvorakova joined in 2021.</p>${filler}</body></html>`;
    const [out, ...rest] = readPages.parse(html, ctx, step, req);
    expect(rest).toEqual([]);
    expect(out?.url).toBe(req.url);
    expect(out?.identity).toBe("merged");
    expect(out?.replaces).toBe(true);
    expect(out?.excerpt.startsWith("Data team | Example\n")).toBe(true);
    expect(out?.excerpt).toContain("Jana Dvořáková leads the data platform.");
    expect(out?.excerpt).toContain("\n…\n");
    expect(out?.excerpt).toContain("Dvorakova joined in 2021.");
    expect(out?.excerpt.length).toBeLessThanOrEqual(READ_EXCERPT_MAX);
    expect(out?.raw).toMatchObject({ title: "Data team | Example" });
  });

  it("digests the pages it fetched", () => {
    const digest = readPages.digest?.([{ req, payload: "<p>Hello</p>" }, { req, payload: null }], ctx);
    expect(digest).toEqual({ read: 1, pages: [{ url: req.url, chars: 5 }] });
  });
});
