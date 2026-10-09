/**
 * JSON fetch adapter for public REST sources (ARES, GitHub, Bluesky ...) with a hard timeout.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/fetch.ts
 * Deps:    fetch (Workers runtime)
 * Tested:  src/adapters/__tests__/fetch.test.ts
 *
 * Key responsibilities:
 * - One call, JSON in, JSON out; non-2xx and non-JSON throw with the status and a 160-char body snippet
 * - A request whose `accept` header asks for `text/*` or XML (Czech registries answer HTML or SOAP) gets the body back as a string;
 *   a POST-redirect-GET answer (302 + session cookie, as vyhledavac.cak.cz does) is followed once with the cookies that redirect set
 * - One retry after 2 s on 429/503, and on 202 for a GET only (GitHub answers 202 while it computes repo stats; a POST's 202
 *   is "accepted" and is never re-sent); an empty body after that is `null`
 * - Any 2xx with an empty body returns `null` (it used to throw a JSON error); collectors parse `null` to `[]`
 * - Optional per-host credentials: GitHub bearer token, Stack Exchange app key (anonymous Workers egress shares quotas)
 *
 * Design constraints:
 * - 20 s timeout; the runner records a failed request as a note, never as evidence
 */
import type { JsonFetch } from "@/domain/ports";

export const TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 2_000;
const SNIPPET_CHARS = 160;
export const UA = "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)";

export type FetchCreds = { githubToken?: string; stackExchangeKey?: string; openAlexKey?: string; retryDelayMs?: number };

/** `accept: text/html`, `text/xml`, `application/xml` ... = the caller parses the body itself. */
function wantsText(accept: string | undefined): boolean {
  return accept !== undefined && /^(text\/|application\/(soap\+)?xml)/i.test(accept);
}

function isRedirect(res: Response): boolean {
  return (res.status === 301 || res.status === 302 || res.status === 303) && res.headers.get("location") !== null;
}

/** GET the redirect target once, sending back the cookies the redirect response set (name=value only). */
function followWithCookies(res: Response, from: string, headers: Record<string, string>): Promise<Response> {
  const target = new URL(res.headers.get("location") ?? "", from).toString();
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]?.trim() ?? "")
    .filter((c) => c.includes("="))
    .join("; ");
  const { "content-type": _ct, ...rest } = headers;
  return fetch(target, { method: "GET", headers: cookie === "" ? rest : { ...rest, cookie }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export function makeFetchJson(creds: FetchCreds = {}): JsonFetch {
  const retryDelay = creds.retryDelayMs ?? RETRY_DELAY_MS;
  return async (rawUrl, init) => {
    const u = new URL(rawUrl);
    const headers: Record<string, string> = {
      accept: "application/json",
      "accept-encoding": "gzip",
      "user-agent": UA,
      ...init?.headers,
    };
    const { githubToken = "", stackExchangeKey = "", openAlexKey = "" } = creds;
    if (u.hostname === "api.github.com" && githubToken !== "") headers.authorization = `Bearer ${githubToken}`;
    if (u.hostname === "api.stackexchange.com" && stackExchangeKey !== "" && !u.searchParams.has("key")) {
      u.searchParams.set("key", stackExchangeKey);
    }
    if (u.hostname === "api.openalex.org" && openAlexKey !== "" && !u.searchParams.has("api_key")) {
      u.searchParams.set("api_key", openAlexKey);
    }
    const url = u.toString();
    const method = init?.method ?? "GET";
    const text = wantsText(headers.accept);
    const attempt = () =>
      fetch(url, {
        method,
        headers,
        body: init?.body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: text ? "manual" : "follow",
      });
    let res = await attempt();
    if (res.status === 429 || res.status === 503 || (res.status === 202 && method === "GET")) {
      await new Promise((r) => setTimeout(r, retryDelay));
      res = await attempt();
    }
    if (text && isRedirect(res)) res = await followWithCookies(res, url, headers);
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, SNIPPET_CHARS);
      throw new Error(`${rawUrl}: HTTP ${String(res.status)}${snippet ? ` ${snippet}` : ""}`);
    }
    const body = await res.text();
    if (text) return body;
    return body === "" ? null : (JSON.parse(body) as unknown);
  };
}

export const fetchJson: JsonFetch = makeFetchJson();
