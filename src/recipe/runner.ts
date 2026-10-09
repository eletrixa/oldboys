/**
 * Pure step executor: runs one recipe step against ports and returns what it produced.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/runner.ts
 * Deps:    none (I/O only through Ports)
 * Tested:  src/recipe/__tests__/runner.test.ts
 *
 * Key responsibilities:
 * - serp/actor/ares steps: collector.requests -> ports (callActor | fetchJson | callTreg) -> collector.parse -> ports.storeSource
 * - resolve/extract/verify/synthesize: delegate to the LLM seams
 * - A collector whose sources an earlier step already fetched (`alreadyFetched`) and that has nothing new to request
 *   returns those sources, not empty, with the note "already fetched at seed" and no request
 * - `collectWith(collector, ...)` is `collect` for an explicit collector: a first wave, then once `collector.followUp(fetched)`
 *   through the same per-request path (budget, calls, error note, dedup), then `collector.digest` into StepOutcome.digest;
 *   both receive the performed request/payload pairs (`Fetched`), recorded right after the request succeeds
 * - Budget: refuse a paid (actor) request once calls or USD are exhausted (note + empty); free REST fetches are not gated;
 *   a treg request reserves its `maxCostUsd` against the run USD budget before its chunk starts (dropped with "run budget reached"
 *   when it would not fit) and never counts as a call; with `ports.callTreg === null` (TREG_TOKEN unset) treg requests are dropped
 *   with the note "TREG_TOKEN not set"
 * - A wave performs consecutive fetch and treg requests up to 6 at a time and applies results (parse, dedup, `Fetched`) in request order;
 *   stores of a request's hits run up to 6 at a time with parsed order preserved; actor requests run one by one
 * - One source per page: a hit whose canonical URL (no locale / trailing slash) is already in the run is not stored again;
 *   deduped hits add the note "N hits already in the run" and do not make the step empty (no onEmpty gap). A collector
 *   with `enriches` (profile scrapers) skips only URLs it stored itself in this step: its page (bio, counts, posts) is
 *   richer than the search hit that first listed the URL
 * - A parsed source with `replaces: true` whose canonical URL is already in ctx.sources is stored under the existing
 *   source's id, url, identity, actor and fetched_at with the new excerpt and raw (the D1 upsert rewrites that row), lands
 *   in outcome.sources, and adds the note "replaced excerpts of N pages"; a `replaces` source for a new URL is stored normally
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
import { emptyOutcome } from "@/recipe/sources/types";
import type { Collector, CollectorRequest, Fetched, ParsedSource, StepContext, StepOutcome } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";

export const SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Workers allow 6 simultaneous outbound connections. */
const FETCH_CONCURRENCY = 6;

type Attempt = { ok: { payload: unknown; cost_usd: number } } | { error: unknown };

/** Re-exported for the seams and tests that import it from here; defined beside StepOutcome so the resolve seam need not import the runner. */
export { emptyOutcome };

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
  switch (req.via) {
    case "actor": {
      const r = await ports.callActor({
        actor: req.actor,
        input: req.input,
        timeoutSecs: req.timeoutSecs,
        maxTotalChargeUsd: req.maxTotalChargeUsd,
      });
      return { payload: r.items, cost_usd: r.cost_usd };
    }
    case "treg":
      // followUp waves skip the up-front TREG_TOKEN filter, so the port can still be null here
      if (ports.callTreg === null) throw new Error("TREG_TOKEN not set");
      return ports.callTreg({ endpoint: req.endpoint, method: req.method, params: req.params, maxCostUsd: req.maxCostUsd });
    case "fetch":
      return { payload: await ports.fetchJson(req.url, req.init), cost_usd: 0 };
  }
}

async function collect(step: Step, ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  if (step.actor === undefined) throw new Error(`step ${step.id} has no actor`);
  return collectWith(collectorFor(step.actor), step, ctx, ports);
}

/** `collect` for an explicit collector (test seam): first wave, optional followUp wave, optional digest. */
export async function collectWith(collector: Collector, step: Step, ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  let requests = collector.requests(ctx, step);
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
    out.notes.push(collector.skipReason?.(ctx) ?? "no confirmed handle or id to look up");
    return out;
  }
  if (ports.callTreg === null && requests.some((r) => r.via === "treg")) {
    out.notes.push("TREG_TOKEN not set");
    requests = requests.filter((r) => r.via !== "treg");
    if (requests.length === 0) return out;
  }
  // An enriching collector stores its page beside the earlier search hit of the same URL; others keep one source per URL per run
  const seen = new Set(collector.enriches === true ? [] : ctx.sources.map((s) => canonicalUrl(s.url)));
  const existing = new Map(ctx.sources.map((s) => [canonicalUrl(s.url), s]));
  const done: Fetched[] = [];
  let parsedHits = 0;
  let deduped = 0;
  let replaced = 0;
  let tregDropNoted = false; // one "run budget reached" per step however many treg requests are dropped
  const attempt = (req: CollectorRequest): Promise<Attempt> => perform(req, ports).then((ok) => ({ ok }), (error: unknown) => ({ error }));
  // Applies one performed request: tallies, parse, dedup, store. Called in request order whatever order the fetches finished in.
  const apply = async (req: CollectorRequest, res: Attempt): Promise<void> => {
    if (req.via === "actor") out.calls += 1; // only paid actor runs count toward RUN_BUDGET_CALLS
    let parsed: ParsedSource[];
    try {
      if ("error" in res) throw res.error;
      out.cost_usd += res.ok.cost_usd;
      done.push({ req, payload: res.ok.payload }); // before parse: a parse throw must not drop the pair
      parsed = collector.parse(res.ok.payload, ctx, step, req);
    } catch (error) {
      out.notes.push(`request failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    parsedHits += parsed.length;
    const fresh: { source: Omit<Source, "r2_key">; raw: unknown }[] = [];
    for (const p of parsed) {
      const key = canonicalUrl(p.url);
      const prior = p.replaces === true ? existing.get(key) : undefined;
      if (prior !== undefined) {
        existing.delete(key); // one rewrite per page per step
        replaced += 1;
        const { r2_key: _r2, ...kept } = prior;
        out.sources.push(await ports.storeSource({ ...kept, excerpt: p.excerpt }, p.raw));
        continue;
      }
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
      fresh.push({ source, raw: p.raw });
    }
    // Stores run up to FETCH_CONCURRENCY at a time; results land in parsed order. A rejection fails apply (Promise.all), as before.
    const stored = new Array<Source>(fresh.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < fresh.length) {
        const i = next++;
        const f = fresh[i];
        if (f) stored[i] = await ports.storeSource(f.source, f.raw);
      }
    };
    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, fresh.length) }, worker));
    out.sources.push(...stored);
  };
  // Fetches run up to FETCH_CONCURRENCY at a time; actor runs stay sequential because the budget check reads what earlier ones spent.
  const wave = async (reqs: readonly CollectorRequest[]): Promise<void> => {
    const queue = [...reqs];
    while (queue.length > 0) {
      const lead = queue[0];
      if (lead?.via === "actor") {
        queue.shift();
        if (!budgetLeft(ctx, out.calls, out.cost_usd)) {
          out.notes.push("run budget reached");
          return;
        }
        await apply(lead, await attempt(lead));
        continue;
      }
      const nextActor = queue.findIndex((r) => r.via === "actor");
      const taken = queue.splice(0, Math.min(FETCH_CONCURRENCY, nextActor === -1 ? queue.length : nextActor));
      // treg spend is only known after the call: reserve each request's cap against the USD budget up front
      let reserved = 0;
      const chunk = taken.filter((r) => {
        if (r.via !== "treg") return true;
        if (ctx.spent.usd + out.cost_usd + reserved + r.maxCostUsd > ctx.budget.usd) {
          if (!tregDropNoted) out.notes.push("run budget reached");
          tregDropNoted = true;
          return false;
        }
        reserved += r.maxCostUsd;
        return true;
      });
      for (const { req, res } of await Promise.all(chunk.map(async (req) => ({ req, res: await attempt(req) })))) await apply(req, res);
    }
  };
  await wave(requests);
  if (collector.followUp) await wave(collector.followUp(ctx, step, [...done]));
  if (deduped > 0) out.notes.push(`${String(deduped)} hits already in the run`);
  if (replaced > 0) out.notes.push(`replaced excerpts of ${String(replaced)} pages`);
  // Pages found but all stored by an earlier step are not "nothing found": empty only when parse returned nothing
  out.empty = parsedHits === 0;
  const digest = collector.digest?.(done, ctx);
  if (digest !== undefined && digest !== null) out.digest = digest;
  return out;
}
