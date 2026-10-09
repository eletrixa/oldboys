/**
 * treg.to adapter: one metered proxy over 60+ data providers, called by endpoint id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/treg.ts
 * Deps:    fetch (Workers runtime), src/adapters/fetch.ts (UA, TIMEOUT_MS)
 * Tested:  src/adapters/__tests__/treg.test.ts
 *
 * Key responsibilities:
 * - `tregUrl`: GET `https://treg.to/call/<endpoint>?<params>` (arrays joined with ","), POST the bare endpoint url
 * - `makeTregCall(token)`: sends `X-Treg-Token` and `X-Treg-Route-Max-Cost` (the request's cap), JSON body for POST;
 *   the real charge is read from `X-Treg-Cost-Micro` (integer micro-USD, missing = 0); an empty 2xx body is `null`, a negative value is 0
 * - Non-2xx throws `treg <endpoint>: HTTP <status> <160-char snippet>` (402 = balance exhausted, 503 = provider capacity;
 *   a failed call is never billed)
 *
 * Design constraints:
 * - 20 s timeout, no retry: the runner records the failure as a note, never as evidence
 * - The token is sent as a header only, never put in a URL, note or error snippet (redacted as [token])
 * - A 2xx body that is not JSON throws `treg <endpoint>: invalid JSON <snippet>`
 */
import { TIMEOUT_MS, UA } from "@/adapters/fetch";
import type { TregCall } from "@/domain/ports";

export const TREG_BASE = "https://treg.to/call";
const SNIPPET_CHARS = 160;

type Params = Parameters<TregCall>[0]["params"];

export function tregUrl(endpoint: string, params: Params, method: "GET" | "POST"): string {
  const base = `${TREG_BASE}/${endpoint}`;
  if (method === "POST") return base;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, Array.isArray(v) ? v.join(",") : String(v));
  const s = q.toString();
  return s === "" ? base : `${base}?${s}`;
}

export function makeTregCall(token: string): TregCall {
  return async ({ endpoint, method, params, maxCostUsd }) => {
    const headers: Record<string, string> = {
      "X-Treg-Token": token,
      "X-Treg-Route-Max-Cost": maxCostUsd.toFixed(10).replace(/0+$/, "").replace(/\.$/, ""),
      accept: "application/json",
      "user-agent": UA,
    };
    if (method === "POST") headers["content-type"] = "application/json";
    const res = await fetch(tregUrl(endpoint, params, method), {
      method,
      headers,
      ...(method === "POST" ? { body: JSON.stringify(params) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    const snippet = body.replace(/\s+/g, " ").trim().replaceAll(token, "[token]").slice(0, SNIPPET_CHARS);
    if (!res.ok) throw new Error(`treg ${endpoint}: HTTP ${String(res.status)} ${snippet}`);
    const micro = Number(res.headers.get("x-treg-cost-micro") ?? "0");
    const cost_usd = Number.isFinite(micro) ? Math.max(0, micro) / 1_000_000 : 0;
    if (body.trim() === "") return { payload: null, cost_usd };
    try {
      return { payload: JSON.parse(body) as unknown, cost_usd };
    } catch {
      throw new Error(`treg ${endpoint}: invalid JSON ${snippet}`);
    }
  };
}
