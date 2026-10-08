/**
 * Opt-in live smoke: runs the hiring recipe's collector steps against real Apify and REST endpoints.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/live-sources.test.ts
 * Deps:    vitest, src/adapters/apify, src/adapters/fetch (network, spends real money)
 * Tested:  n/a (this is the E1 gate: LIVE=1 APIFY_TOKEN=... SUBJECT="..." ANCHOR="..." pnpm exec vitest run live-sources)
 *
 * Key responsibilities:
 * - Skipped unless LIVE=1; then walks every collector step, prints calls, cost, source count and notes per step (also to $REPORT)
 * - Resolve runs with a throwing LLM so the deterministic fallback scoring seeds candidates for downstream steps
 *
 * Design constraints:
 * - Never part of `pnpm check`; the only assertion is that the SERP step yields at least one source
 * - Sources are kept in memory; nothing is written to D1 or R2
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeActorCall } from "@/adapters/apify";
import { fetchJson } from "@/adapters/fetch";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { executeStep } from "@/recipe/runner";
import type { StepContext } from "@/recipe/sources/types";
import { baseContext, fakePorts } from "./fakes";

const live = process.env.LIVE === "1";

describe.skipIf(!live)("live sources (LIVE=1)", () => {
  it("every hiring collector step runs against the real network", async () => {
    const token = process.env.APIFY_TOKEN;
    expect(token.length).toBeGreaterThan(10);
    const ports = fakePorts({ callActor: makeActorCall(token), fetchJson, newId: () => crypto.randomUUID(), now: () => new Date().toISOString() });
    let ctx: StepContext = baseContext({
      subject: process.env.SUBJECT ?? "Robert Vojáček",
      anchor: process.env.ANCHOR ?? "Praha",
      budget: { usd: 1, calls: 40 },
    });
    const report: string[] = [];
    for (const step of hiringRecipe.steps) {
      if (step.kind === "extract" || step.kind === "verify" || step.kind === "synthesize") continue;
      const started = Date.now();
      const out = await executeStep(step, ctx, ports);
      ctx = {
        ...ctx,
        sources: [...ctx.sources, ...out.sources],
        candidates: out.candidates.length > 0 ? out.candidates : ctx.candidates,
        spent: { usd: ctx.spent.usd + out.cost_usd, calls: ctx.spent.calls + out.calls },
      };
      const first = out.sources[0]?.url ?? out.candidates[0]?.profile_urls[0] ?? "-";
      report.push(
        `${step.id.padEnd(22)} calls=${String(out.calls)} usd=${out.cost_usd.toFixed(4)} sources=${String(out.sources.length)} cand=${String(out.candidates.length)} ${String(Date.now() - started)}ms ${first} ${out.notes.join(" | ")}`,
      );
      if (step.id === "serp_person" && out.sources.length === 0) {
        process.stdout.write(report.join("\n") + "\n");
        expect.fail(`serp_person returned nothing: ${out.notes.join(" | ")}`);
      }
    }
    report.push(`TOTAL usd=${ctx.spent.usd.toFixed(4)} calls=${String(ctx.spent.calls)} sources=${String(ctx.sources.length)}`);
    report.push(...ctx.candidates.map((c) => `candidate ${c.decision.padEnd(16)} ${c.score.toFixed(2)} ${c.platform} ${c.profile_urls.join(",")}`));
    const text = report.join("\n");
    process.stdout.write(text + "\n");
    if (process.env.REPORT !== undefined) writeFileSync(process.env.REPORT, text);
  }, 600_000);
});
