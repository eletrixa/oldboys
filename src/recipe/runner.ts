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
 * - A collector whose sources an earlier step already fetched (`alreadyFetched`) and that has nothing new to request
 *   returns those sources, not empty, with the note "already fetched at seed" and no request
 * - `collectWith(collector, ...)` is `collect` for an explicit collector: a first wave, then once `collector.followUp(fetched)`
 *   through the same per-request path (budget, calls, error note, dedup), then `collector.digest` into StepOutcome.digest;
 *   both receive the performed request/payload pairs (`Fetched`), recorded right after the request succeeds
 * - Budget: refuse a paid (actor) request once calls or USD are exhausted (note + empty); free REST fetches are not gated
 * - One source per page: a hit whose canonical URL (no locale / trailing slash) is already in the run is not stored again;
 *   deduped hits add the note "N hits already in the run" and do not make the step empty (no onEmpty gap)
 *
 * Design constraints:
 * - Never mutates ctx; the Workflow persists the outcome and rebuilds ctx for the next step
 * - `onEmpty` is interpreted by the caller (Workflow), not here; runner only reports `empty`
 * - A collector that made no request (`calls === 0`) with a note was skipped, not searched: the Workflow
 *   turns that note into a "not searched: <note>" gap instead of the recipe's onEmpty text
 */
import type { Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { canonicalUrl } from "@/domain/url";
import { extractClaims } from "@/recipe/seams/extract";
import { resolveCandidates } from "@/recipe/seams/resolve";
import { synthesizeBrief } from "@/recipe/seams/synthesize";
import { verifyClaims } from "@/recipe/seams/verify";
import { collectorFor } from "@/recipe/sources";
import type { Collector, CollectorRequest, Fetched, ParsedSource, StepContext, StepOutcome } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";

export const SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function emptyOutcome(): StepOutcome {
  return { sources: [], candidates: [], claims: [], gaps: [], brief: null, claims_mode: "append", empty: true, cost_usd: 0, calls: 0, notes: [] };
}

export async function executeStep(step: Step, ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  switch (step.kind) {
    case "seed":
      // Needs the manager's profile URL / CV, which StepContext does not carry: the Workflow's seed_profile step runs it
      throw new Error(`step ${step.id}: seed runs in the Workflow (seedProfile), not through executeStep`);
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
  return collectWith(collectorFor(step.actor), step, ctx, ports);
}

/** `collect` for an explicit collector (test seam): first wave, optional followUp wave, optional digest. */
export async function collectWith(collector: Collector, step: Step, ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const requests = collector.requests(ctx, step);
  const out = emptyOutcome();
  const fetched = collector.alreadyFetched?.(ctx) ?? [];
  if (requests.length === 0 && fetched.length > 0) {
    // Not a skip: the evidence exists, an earlier step (seed) fetched it. Not empty, so no gap is recorded.
    out.sources = [...fetched];
    out.empty = false;
    out.notes.push("already fetched at seed");
    return out;
  }
  if (requests.length === 0) {
    out.notes.push("no confirmed handle or id to look up");
    return out;
  }
  const seen = new Set(ctx.sources.map((s) => canonicalUrl(s.url)));
  const done: Fetched[] = [];
  let parsedHits = 0;
  let deduped = 0;
  const run = async (req: CollectorRequest): Promise<boolean> => {
    if (req.via === "actor" && !budgetLeft(ctx, out.calls, out.cost_usd)) {
      out.notes.push("run budget reached");
      return false;
    }
    let parsed: ParsedSource[];
    try {
      const { payload, cost_usd } = await perform(req, ports);
      if (req.via === "actor") out.calls += 1; // only paid actor runs count toward RUN_BUDGET_CALLS
      out.cost_usd += cost_usd;
      done.push({ req, payload }); // before parse: a parse throw must not drop the pair
      parsed = collector.parse(payload, ctx, step, req);
    } catch (error) {
      if (req.via === "actor") out.calls += 1;
      out.notes.push(`request failed: ${error instanceof Error ? error.message : String(error)}`);
      return true;
    }
    parsedHits += parsed.length;
    for (const p of parsed) {
      const key = canonicalUrl(p.url);
      if (seen.has(key)) {
        deduped += 1;
        continue;
      }
      seen.add(key);
      const at = ports.now();
      const source: Omit<Source, "r2_key"> = {
        id: ports.newId(),
        run_id: ctx.runId,
        url: p.url,
        actor: step.actor ?? collector.id,
        fetched_at: at,
        excerpt: p.excerpt,
        expires_at: new Date(Date.parse(at) + SOURCE_TTL_MS).toISOString(),
        identity: p.identity ?? "unverified",
      };
      out.sources.push(await ports.storeSource(source, p.raw));
    }
    return true;
  };
  const wave = async (reqs: readonly CollectorRequest[]): Promise<void> => {
    for (const req of reqs) if (!(await run(req))) break;
  };
  await wave(requests);
  if (collector.followUp) await wave(collector.followUp(ctx, step, [...done]));
  if (deduped > 0) out.notes.push(`${String(deduped)} hits already in the run`);
  // Pages found but all stored by an earlier step are not "nothing found": empty only when parse returned nothing
  out.empty = parsedHits === 0;
  const digest = collector.digest?.(done, ctx);
  if (digest !== undefined && digest !== null) out.digest = digest;
  return out;
}
