/**
 * JSON fetch adapter for public REST sources (ARES, GitHub, Bluesky ...) with a hard timeout.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/fetch.ts
 * Deps:    fetch (Workers runtime)
 * Tested:  n/a (exercised live in Phase D)
 *
 * Key responsibilities:
 * - One call, JSON in, JSON out; non-2xx and non-JSON throw with the status in the message
 *
 * Design constraints:
 * - 20 s timeout; the runner records a failed request as a note, never as evidence
 */
import type { JsonFetch } from "@/domain/ports";

const TIMEOUT_MS = 20_000;
const UA = "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)";

export const fetchJson: JsonFetch = async (url, init) => {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { accept: "application/json", "user-agent": UA, ...init?.headers },
    body: init?.body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${String(res.status)}`);
  return res.json();
};
