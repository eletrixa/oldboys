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
 * - One retry after 2 s on 429/503/202 (GitHub answers 202 while it computes repo stats); an empty body after that is `null`
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
    const attempt = () =>
      fetch(url, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    let res = await attempt();
    if (res.status === 429 || res.status === 503 || res.status === 202) {
      await new Promise((r) => setTimeout(r, retryDelay));
      res = await attempt();
    }
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, SNIPPET_CHARS);
      throw new Error(`${rawUrl}: HTTP ${String(res.status)}${snippet ? ` ${snippet}` : ""}`);
    }
    const text = await res.text();
    return text === "" ? null : (JSON.parse(text) as unknown);
  };
}

export const fetchJson: JsonFetch = makeFetchJson();
