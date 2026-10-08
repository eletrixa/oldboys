/**
 * Apify adapter: run an actor synchronously over the REST API with timeout and cost cap, return items + exact cost.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/apify.ts
 * Deps:    fetch (Workers runtime), zod
 * Tested:  n/a (exercised by `pnpm preview` runs against a live actor)
 *
 * Key responsibilities:
 * - POST /v2/acts/{id}/runs with `timeout`, `maxTotalChargeUsd` and `waitForFinish` (returns the Run object;
 *   `run-sync` would return the actor's OUTPUT record instead), then GET dataset items (clean, limited)
 * - Cost comes from the run's `usageTotalUsd`, never estimated
 *
 * Design constraints:
 * - Raw fetch, not apify-client: documented fallback in plans/002 risk A (axios under nodejs_compat)
 * - Never throws on an empty dataset; throws on HTTP errors so the runner records the failure
 */
import { z } from "zod";
import type { ActorCall } from "@/domain/ports";

const RunResponse = z.object({
  data: z.object({
    id: z.string(),
    status: z.string(),
    defaultDatasetId: z.string(),
    usageTotalUsd: z.number().optional(),
  }),
});

const MAX_ITEMS = 50;

export function makeActorCall(token: string): ActorCall {
  return async ({ actor, input, timeoutSecs, maxTotalChargeUsd }) => {
    const id = actor.replace("/", "~");
    const q = new URLSearchParams({
      timeout: String(timeoutSecs),
      maxTotalChargeUsd: maxTotalChargeUsd.toFixed(2),
      waitForFinish: String(Math.min(timeoutSecs, 60)),
    });
    const runRes = await fetch(`https://api.apify.com/v2/acts/${id}/runs?${q.toString()}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!runRes.ok) throw new Error(`apify ${actor}: HTTP ${String(runRes.status)} ${(await runRes.text()).slice(0, 200)}`);
    const run = RunResponse.parse(await runRes.json()).data;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&limit=${String(MAX_ITEMS)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!itemsRes.ok) throw new Error(`apify dataset ${run.defaultDatasetId}: HTTP ${String(itemsRes.status)}`);
    const items = z.array(z.unknown()).parse(await itemsRes.json());
    return { items, cost_usd: run.usageTotalUsd ?? 0 };
  };
}
