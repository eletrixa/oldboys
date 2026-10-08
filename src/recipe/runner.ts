/**
 * Pure step executor: runs one recipe step against ports and returns what it produced.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/runner.ts
 * Deps:    none (I/O only through Ports)
 * Tested:  src/recipe/__tests__/runner.test.ts
 *
 * Key responsibilities:
 * - serp/actor/ares steps: collector.requests -> ports (callActor | fetchJson) -> collector.parse -> ports.storeSource
 * - resolve/extract/verify/synthesize: delegate to the LLM seams
 * - Budget: refuse a paid (actor) request once calls or USD are exhausted (note + empty); free REST fetches are not gated
 *
 * Design constraints:
 * - Never mutates ctx; the Workflow persists the outcome and rebuilds ctx for the next step
 * - `onEmpty` is interpreted by the caller (Workflow), not here; runner only reports `empty`
 * - A collector that made no request (`calls === 0`) with a note was skipped, not searched: the Workflow
 *   turns that note into a "not searched: <note>" gap instead of the recipe's onEmpty text
 */
import type { Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { extractClaims } from "@/recipe/seams/extract";
import { resolveCandidates } from "@/recipe/seams/resolve";
import { synthesizeBrief } from "@/recipe/seams/synthesize";
import { verifyClaims } from "@/recipe/seams/verify";
import { collectorFor } from "@/recipe/sources";
import type { CollectorRequest, ParsedSource, StepContext, StepOutcome } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";

export const SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function emptyOutcome(): StepOutcome {
  return { sources: [], candidates: [], claims: [], gaps: [], brief: null, claims_mode: "append", empty: true, cost_usd: 0, calls: 0, notes: [] };
}

export async function executeStep(step: Step, ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  switch (step.kind) {
    case "serp":
    case "actor":
    case "ares":
      return collect(step, ctx, ports);
    case "resolve":
      return resolveCandidates(ctx, ports);
    case "extract":
      return extractClaims(ctx, ports);
    case "verify":
      return verifyClaims(ctx, ports);
    case "synthesize":
      return synthesizeBrief(ctx, ports);
  }
}

function budgetLeft(ctx: StepContext, spentCalls: number, spentUsd: number): boolean {
  return ctx.spent.calls + spentCalls < ctx.budget.calls && ctx.spent.usd + spentUsd < ctx.budget.usd;
}

async function perform(req: CollectorRequest, ports: Ports): Promise<{ payload: unknown; cost_usd: number }> {
  if (req.via === "actor") {
    const r = await ports.callActor({
      actor: req.actor,
      input: req.input,
      timeoutSecs: req.timeoutSecs,
      maxTotalChargeUsd: req.maxTotalChargeUsd,
    });
    return { payload: r.items, cost_usd: r.cost_usd };
  }
  return { payload: await ports.fetchJson(req.url, req.init), cost_usd: 0 };
}

async function collect(step: Step, ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  if (step.actor === undefined) throw new Error(`step ${step.id} has no actor`);
  const collector = collectorFor(step.actor);
  const requests = collector.requests(ctx, step);
  const out = emptyOutcome();
  if (requests.length === 0) {
    out.notes.push("no confirmed handle or id to look up");
    return out;
  }
  for (const req of requests) {
    if (req.via === "actor" && !budgetLeft(ctx, out.calls, out.cost_usd)) {
      out.notes.push("run budget reached");
      break;
    }
    let parsed: ParsedSource[];
    try {
      const { payload, cost_usd } = await perform(req, ports);
      if (req.via === "actor") out.calls += 1; // only paid actor runs count toward RUN_BUDGET_CALLS
      out.cost_usd += cost_usd;
      parsed = collector.parse(payload, ctx, step);
    } catch (error) {
      if (req.via === "actor") out.calls += 1;
      out.notes.push(`request failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const p of parsed) {
      const fetched = ports.now();
      const source: Omit<Source, "r2_key"> = {
        id: ports.newId(),
        run_id: ctx.runId,
        url: p.url,
        actor: step.actor,
        fetched_at: fetched,
        excerpt: p.excerpt,
        expires_at: new Date(Date.parse(fetched) + SOURCE_TTL_MS).toISOString(),
        identity: p.identity ?? "unverified",
      };
      out.sources.push(await ports.storeSource(source, p.raw));
    }
  }
  out.empty = out.sources.length === 0;
  return out;
}
