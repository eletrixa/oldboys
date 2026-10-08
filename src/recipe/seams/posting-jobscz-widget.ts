/**
 * Jobs.cz career-site widget: company sites on `<company>.jobs.cz` render the posting client-side from a GraphQL widget API.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-jobscz-widget.ts
 * Deps:    src/recipe/seams/posting-html.ts
 * Tested:  src/recipe/__tests__/posting-jobscz-widget.test.ts (fixtures jobscz-widget-*)
 *
 * Key responsibilities:
 * - `widgetFromInline`: credentials from the inline `__LMC_CAREER_WIDGET__.push({apiKey, widgetId})` call
 * - `widgetScript` + `metaRefreshUrl` + `widgetFromScript`: sites without the inline call keep the `widgets` config in their own
 *   `script.min.js` (served behind a meta-refresh page); the `data-widget` attribute names the entry to use
 * - `widgetQuery` / `parseWidgetReply`: the detail query and the reply to title, company, location and text
 * - `fetchJobsCzWidget`: the whole chain with an injected fetch, at most three requests; throws with a plain reason
 *
 * Design constraints:
 * - Only `api.capybara.lmc.cz` and same-origin assets of the page are fetched; the API key is a public client-side key read from the page
 * - Every parser is pure and never throws; the raw GraphQL reply is what the caller stores
 */
import { htmlToText } from "@/recipe/seams/posting-html";
import type { ParsedPosting } from "@/recipe/seams/posting-parse";

export const WIDGET_API = "https://api.capybara.lmc.cz/api/graphql/widget";
const KEY = /^[0-9a-f]{64}$/i;
const EMPTY: ParsedPosting = { text: "" };

export type WidgetCreds = { widgetId: string; apiKey: string };
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/** The JSON object literal starting at `from` (an opening brace), balanced and string-aware; undefined when unbalanced. */
function objectAt(s: string, from: number): string | undefined {
  let depth = 0;
  let quoted = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === "\\") i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return s.slice(from, i + 1);
  }
  return undefined;
}

function parseObject(s: string | undefined): Obj | undefined {
  if (s === undefined) return undefined;
  try {
    const v: unknown = JSON.parse(s);
    return isObj(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

const creds = (widgetId: unknown, apiKey: unknown): WidgetCreds | undefined =>
  typeof widgetId === "string" && widgetId !== "" && typeof apiKey === "string" && KEY.test(apiKey) ? { widgetId, apiKey } : undefined;

export function widgetFromInline(html: string): WidgetCreds | undefined {
  const at = html.indexOf("__LMC_CAREER_WIDGET__.push(");
  if (at < 0) return undefined;
  const cfg = parseObject(objectAt(html, html.indexOf("{", at)));
  return cfg === undefined ? undefined : creds(cfg.widgetId, cfg.apiKey);
}

/** Same-origin `script.min.js` of the career site and the `data-widget` name (default `main`). */
export function widgetScript(html: string, pageUrl: string): { url: string; name: string } | undefined {
  const src = /<script\b[^>]*\bsrc=["']([^"']*\/script\.min\.js[^"']*)["']/i.exec(html)?.[1];
  if (src === undefined) return undefined;
  try {
    const url = new URL(src, pageUrl);
    if (url.origin !== new URL(pageUrl).origin) return undefined;
    return { url: url.href, name: /\bdata-widget=["']([^"']+)["']/i.exec(html)?.[1] ?? "main" };
  } catch {
    return undefined;
  }
}

/** Target of `<meta http-equiv="refresh" content="0;url='...'">`, when the body is such a page. */
export function metaRefreshUrl(html: string): string | undefined {
  const meta = /<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/i.exec(html)?.[0];
  const content = meta === undefined ? undefined : (/content="([^"]*)"/i.exec(meta)?.[1] ?? /content='([^']*)'/i.exec(meta)?.[1]);
  const target = content === undefined ? undefined : /url=\s*'?([^'"\s]+)/i.exec(content.replace(/&#0?39;|&apos;/g, "'"))?.[1];
  return target === undefined || !/^https?:\/\//.test(target) ? undefined : target;
}

export function widgetFromScript(js: string, name: string): WidgetCreds | undefined {
  const at = js.indexOf('"widgets":');
  if (at < 0) return undefined;
  const widgets = parseObject(objectAt(js, js.indexOf("{", at)));
  if (widgets === undefined) return undefined;
  const entry = widgets[name] ?? Object.values(widgets)[0];
  return isObj(entry) ? creds(entry.id, entry.apiKey) : undefined;
}

export function widgetQuery(widgetId: string, jobAdId: string): string {
  const query =
    "query($widgetId: ID!, $jobAdId: ID!) { widget(id: $widgetId) { jobAd(id: $jobAdId) { id title headerText teaser languageIso " +
    "content { htmlContent sections { title text } } locations { city region country } employer { companyName } } } }";
  return JSON.stringify({ query, variables: { widgetId, jobAdId } });
}

export function parseWidgetReply(payload: unknown): ParsedPosting {
  const data = typeof payload === "string" ? parseObject(payload) : payload;
  const widget = isObj(data) && isObj(data.data) && isObj(data.data.widget) ? data.data.widget : undefined;
  const ad = widget !== undefined && isObj(widget.jobAd) ? widget.jobAd : undefined;
  if (ad === undefined) return EMPTY;
  const content = isObj(ad.content) ? ad.content : {};
  const sections = Array.isArray(content.sections) ? content.sections.filter(isObj) : [];
  const parts = [
    htmlToText(str(content.htmlContent) ?? ""),
    ...sections.map((s) => [str(s.title), str(s.text) === undefined ? undefined : htmlToText(str(s.text) ?? "")].filter(Boolean).join("\n")),
  ].filter((p) => p !== "");
  const place = Array.isArray(ad.locations) ? ad.locations.find(isObj) : undefined;
  const location = place === undefined ? undefined : (str(place.city) ?? str(place.region) ?? str(place.country));
  const company = isObj(ad.employer) ? str(ad.employer.companyName) : undefined;
  return {
    ...(str(ad.title) !== undefined ? { title: str(ad.title) } : {}),
    ...(company !== undefined ? { company } : {}),
    ...(location !== undefined ? { location } : {}),
    text: parts.join("\n\n"),
  };
}

async function get(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<string> {
  const res = await fetchFn(url, init);
  if (!res.ok) throw new Error(`HTTP ${String(res.status)} from ${new URL(url).hostname}`);
  return res.text();
}

/** Credentials from the page itself, else from the site's script (one hop through the meta-refresh page when present). */
async function resolveCreds(fetchFn: typeof fetch, page: { html: string; url: string }, init: RequestInit): Promise<WidgetCreds> {
  const inline = widgetFromInline(page.html);
  if (inline) return inline;
  const script = widgetScript(page.html, page.url);
  if (!script) throw new Error("no career widget on the page");
  let js = await get(fetchFn, script.url, init);
  const next = metaRefreshUrl(js);
  if (next !== undefined) js = await get(fetchFn, next, init);
  const found = widgetFromScript(js, script.name);
  if (!found) throw new Error("career widget config not found");
  return found;
}

/** The posting behind a Jobs.cz career-site page through the widget API; `init` carries the shared user agent and timeout. */
export async function fetchJobsCzWidget(
  fetchFn: typeof fetch,
  page: { html: string; url: string },
  jobAdId: string,
  init: RequestInit = {},
): Promise<{ parsed: ParsedPosting; raw: string }> {
  if (jobAdId === "") throw new Error("no job ad id in the URL");
  const { widgetId, apiKey } = await resolveCreds(fetchFn, page, init);
  const raw = await get(fetchFn, WIDGET_API, {
    ...init,
    method: "POST",
    headers: { ...(init.headers as Record<string, string> | undefined), "content-type": "application/json", "x-api-key": apiKey },
    body: widgetQuery(widgetId, jobAdId),
  });
  const parsed = parseWidgetReply(raw);
  if (parsed.text === "") throw new Error("career widget returned no posting");
  return { parsed, raw };
}
