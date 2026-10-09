/**
 * Read-pages collector: fetches the run's confirmed web pages and replaces their SERP snippet with page text around the person.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/read-pages.ts
 * Deps:    none (htmlPageText / pageExcerpt from src/domain/html-text, confirmedSources from the resolve seam)
 * Tested:  src/recipe/__tests__/sources-read-pages.test.ts
 *
 * Key responsibilities:
 * - `rest/read-pages` requests: confirmed (merged) sources on platform "web", http(s), not a pdf/xml/json/image, excerpt
 *   under 3000 chars (not read yet), host not a social site or people-data aggregator; sec.gov first (at most SEC_MAX), then ctx order, max READ_MAX
 * - parse: page text around the surname / full name (`pageExcerpt`, READ_EXCERPT_MAX) as a merged source with `replaces: true`,
 *   so the runner overwrites the existing row's excerpt; a page that never names the surname yields nothing
 * - digest `{ read, pages: [{url, chars}] }`
 *
 * Design constraints:
 * - Free fetches only (no Apify); pure, the runner performs the fetch
 * - Never reads unverified sources: a namesake's page must not gain weight by being read
 */
import { fold, hasWord } from "@/domain/corroborate";
import { htmlPageText, pageExcerpt } from "@/domain/html-text";
import { confirmedSources } from "@/recipe/seams/resolve";
import type { Collector, CollectorRequest } from "@/recipe/sources/types";
import { platformOf } from "@/recipe/sources/types";

export const READ_EXCERPT_MAX = 6000;
export const READ_MAX = 16;
/** SEC exhibits are short and many name the same person; a few suffice, the rest of the slots go to press and profiles. */
export const SEC_MAX = 4;
/** An excerpt this long was already read (SERP snippets are capped at EXCERPT_MAX = 2000). */
const READ_ALREADY = 3000;
const SKIP_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "github.com",
  "rocketreach.co",
  "zoominfo.com",
  "apollo.io",
  "signalhire.com",
  "contactout.com",
];
const SKIP_EXT = /\.(?:pdf|xml|json|jpe?g|png)$/i;
const HEADERS = {
  accept: "text/html,application/xhtml+xml",
  "user-agent": "Mozilla/5.0 (compatible; oldboys-hackathon/0.1; +https://oldboys.asajj.cz)",
};

const onHost = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);

function readable(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (SKIP_EXT.test(u.pathname)) return null;
    const host = u.hostname.toLowerCase();
    return SKIP_HOSTS.some((d) => onHost(host, d)) ? null : u;
  } catch {
    return null;
  }
}

const surnameOf = (subject: string): string => subject.trim().split(/\s+/).at(-1) ?? "";

export const readPages: Collector = {
  id: "rest/read-pages",
  requests: (ctx) => {
    const pages = confirmedSources(ctx).flatMap((s) => {
      const u = platformOf(s.url) === "web" && s.excerpt.length < READ_ALREADY ? readable(s.url) : null;
      return u === null ? [] : [{ url: s.url, sec: onHost(u.hostname.toLowerCase(), "sec.gov") }];
    });
    const ordered = [...pages.filter((p) => p.sec).slice(0, SEC_MAX), ...pages.filter((p) => !p.sec)];
    return ordered.slice(0, READ_MAX).map((p): CollectorRequest => ({ via: "fetch", url: p.url, init: { headers: { ...HEADERS } } }));
  },
  skipReason: () => "no confirmed web pages to read",
  parse: (payload, ctx, _step, req) => {
    if (typeof payload !== "string" || req?.via !== "fetch") return [];
    const page = htmlPageText(payload);
    const surname = surnameOf(ctx.subject);
    // Not about them, or the text needs JavaScript to render: keep the snippet.
    if (surname === "" || !hasWord(fold(page.text), fold(surname))) return [];
    return [
      {
        url: req.url,
        excerpt: pageExcerpt(page, [surname, ctx.subject], READ_EXCERPT_MAX),
        raw: { title: page.title, chars: page.text.length },
        identity: "merged",
        replaces: true,
      },
    ];
  },
  digest: (fetched) => {
    const pages = fetched.flatMap((f) =>
      f.req.via === "fetch" && typeof f.payload === "string" ? [{ url: f.req.url, chars: htmlPageText(f.payload).text.length }] : [],
    );
    return { read: pages.length, pages };
  },
};
