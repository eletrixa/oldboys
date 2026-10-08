/**
 * ResearchRunWorkflow: Cloudflare Workflow that executes one goal recipe step by step.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/research-run.ts
 * Deps:    cloudflare:workers (WorkflowEntrypoint), D1 binding DB
 * Tested:  n/a (skeleton; runner logic will be tested through src/recipe with fake ports)
 *
 * Key responsibilities:
 * - One `step.do` per recipe step; `step.waitForEvent('lineup-answer')` at the resolve step
 * - Append a ledger row per step so the SSE route can stream progress
 * - Any thrown error (step retries exhausted, lineup timeout) marks the investigation `failed` with a ledger reason
 *
 * Design constraints:
 * - Imports only src/domain and src/recipe, never Next.js
 * - Keep step payloads tiny (<1 MiB): raw actor output goes to R2 inside the step
 * - Budget (RUN_BUDGET_USD / RUN_BUDGET_CALLS) is enforced here, never delegated to the LLM
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { GoalId, LedgerKind } from "@/domain/claim";
import { recipeFor } from "@/recipe/goals";

export type ResearchRunParams = { runId: string };

export type LineupAnswer = { candidateId: string };

type InvestigationRow = { subject: string; anchor: string; goal: GoalId };

type LedgerRowInput = {
  step: string;
  kind: LedgerKind;
  cost_usd: number;
  ms: number;
  ref: unknown;
};

export class ResearchRunWorkflow extends WorkflowEntrypoint<CloudflareEnv, ResearchRunParams> {
  async run(event: Readonly<WorkflowEvent<ResearchRunParams>>, step: WorkflowStep): Promise<void> {
    const { runId } = event.payload;
    try {
      await this.runRecipe(runId, step);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await step.do("fail", async () => {
        await this.env.DB.prepare("UPDATE investigations SET status = 'failed' WHERE id = ?")
          .bind(runId)
          .run();
        return this.appendLedger(runId, {
          step: "run",
          kind: "decision",
          cost_usd: 0,
          ms: 0,
          ref: { failed: true, reason },
        });
      });
      throw error;
    }
  }

  private async runRecipe(runId: string, step: WorkflowStep): Promise<void> {
    const investigation = await step.do("load-investigation", async () => {
      const row = await this.env.DB.prepare(
        "SELECT subject, anchor, goal FROM investigations WHERE id = ?",
      )
        .bind(runId)
        .first<InvestigationRow>();
      if (!row) throw new Error(`investigation ${runId} not found`);
      await this.env.DB.prepare("UPDATE investigations SET status = 'running' WHERE id = ?")
        .bind(runId)
        .run();
      return row;
    });

    const recipe = recipeFor(investigation.goal);

    for (const recipeStep of recipe.steps) {
      if (recipeStep.kind === "resolve") {
        await step.do(`${recipeStep.id}:pause`, async () => {
          // TODO: score candidates vs anchor (LLM seam `score`) and persist them before pausing.
          await this.env.DB.prepare("UPDATE investigations SET status = 'paused' WHERE id = ?")
            .bind(runId)
            .run();
          return this.appendLedger(runId, {
            step: recipeStep.id,
            kind: "pause",
            cost_usd: 0,
            ms: 0,
            ref: { waitingFor: "lineup-answer" },
          });
        });

        const answer = await step.waitForEvent<LineupAnswer>("lineup-answer", {
          type: "lineup-answer",
          timeout: "1 hour",
        });

        await step.do(`${recipeStep.id}:answered`, async () => {
          await this.env.DB.prepare("UPDATE investigations SET status = 'running' WHERE id = ?")
            .bind(runId)
            .run();
          return this.appendLedger(runId, {
            step: recipeStep.id,
            kind: "decision",
            cost_usd: 0,
            ms: 0,
            ref: { candidateId: answer.payload.candidateId },
          });
        });
        continue;
      }

      await step.do(recipeStep.id, async () => {
        const started = Date.now();
        // TODO: wire Ports (callActor via apify-client, llm via @ai-sdk/anthropic, storeSource via R2)
        // and run the step body; apply `onEmpty` (fallbackStep or Gap) when the result is empty.
        // TODO: enforce RUN_BUDGET_USD / RUN_BUDGET_CALLS before each paid call.
        const kind: LedgerKind = recipeStep.actor ? "call" : "llm";
        return this.appendLedger(runId, {
          step: recipeStep.id,
          kind,
          cost_usd: 0,
          ms: Date.now() - started,
          ref: { actor: recipeStep.actor ?? null, todo: "not wired" },
        });
      });
    }

    await step.do("finish", async () => {
      await this.env.DB.prepare("UPDATE investigations SET status = 'done' WHERE id = ?")
        .bind(runId)
        .run();
      return { runId, status: "done" };
    });
  }

  /** Append one ledger row; seq is assigned atomically inside the INSERT. Returns the new seq. */
  private async appendLedger(runId: string, row: LedgerRowInput): Promise<{ seq: number }> {
    const result = await this.env.DB.prepare(
      `INSERT INTO ledger_entries (run_id, seq, ts, step, kind, cost_usd, ms, ref_json)
       VALUES (?1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM ledger_entries WHERE run_id = ?1), ?2, ?3, ?4, ?5, ?6, ?7)
       RETURNING seq`,
    )
      .bind(
        runId,
        new Date().toISOString(),
        row.step,
        row.kind,
        row.cost_usd,
        row.ms,
        JSON.stringify(row.ref ?? null),
      )
      .first<{ seq: number }>();
    if (!result) throw new Error("ledger insert returned no row");
    return { seq: result.seq };
  }
}
