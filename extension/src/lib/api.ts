/**
 * API client for the oldboys Worker: start a run, read its status.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/api.ts
 * Deps:    zod, @domain/run-status
 * Tested:  extension/src/lib/__tests__/api.test.ts
 *
 * Key responsibilities:
 * - POST /api/runs with the bearer token; 200 means an earlier run was reused
 * - GET /api/runs/:id validated against the shared RunStatus schema
 * - Map 401 / 429 / other failures to typed errors the popup can show
 *
 * Design constraints:
 * - fetch is a parameter so tests inject a fake; the background passes globalThis.fetch
 * - Settings (apiBase, token, goal) live in storage.local; see store.ts
 */
import { z } from "zod";
import { GoalId } from "@domain/claim";
import { RunStatus } from "@domain/run-status";
import { type Mark } from "./mark";

export const Settings = z.object({
  apiBase: z.url().default("https://oldboys.asajj.cz"),
  token: z.string().default(""),
  goal: GoalId.default("hiring"),
});
export type Settings = z.infer<typeof Settings>;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    readonly code: "no-token" | "unauthorized" | "rate-limited" | "not-found" | "bad-response",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const StartResponse = z.object({ id: z.string().min(1), reused: z.boolean().optional() });

export async function startRun(
  settings: Settings,
  mark: Mark,
  fetchImpl: Fetch,
): Promise<{ id: string; reused: boolean }> {
  if (settings.token.length === 0) throw new ApiError("no-token", "Paste the run token in the popup first.");
  const res = await fetchImpl(`${settings.apiBase}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.token}` },
    body: JSON.stringify(mark),
  });
  if (res.status === 401) throw new ApiError("unauthorized", "The run token was rejected.");
  if (res.status === 429) throw new ApiError("rate-limited", "Run cap reached; try again later.");
  const parsed = StartResponse.safeParse(await res.json().catch(() => null));
  if (!res.ok || !parsed.success) throw new ApiError("bad-response", `Start failed (${String(res.status)}).`);
  return { id: parsed.data.id, reused: parsed.data.reused ?? false };
}

export async function getStatus(settings: Settings, runId: string, fetchImpl: Fetch): Promise<RunStatus> {
  const res = await fetchImpl(`${settings.apiBase}/api/runs/${encodeURIComponent(runId)}`);
  if (res.status === 404) throw new ApiError("not-found", "Run not found.");
  const parsed = RunStatus.safeParse(await res.json().catch(() => null));
  if (!res.ok || !parsed.success) throw new ApiError("bad-response", `Status failed (${String(res.status)}).`);
  return parsed.data;
}

export function runUrl(settings: Settings, runId: string): string {
  return `${settings.apiBase}/runs/${encodeURIComponent(runId)}`;
}
