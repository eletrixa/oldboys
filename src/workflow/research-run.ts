/**
 * ResearchRunWorkflow: Cloudflare Workflow that executes one goal recipe step by step through the pure runner.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/research-run.ts
 * Deps:    cloudflare:workers (WorkflowEntrypoint), bindings DB, SOURCES; src/adapters/*, src/recipe/*
 * Tested:  runner and seams via src/recipe/__tests__ with fake ports; this class n/a (Workers runtime)
 *
 * Key responsibilities:
 * - One `step.do` per recipe step: load context from D1 -> executeStep -> persist -> ledger row
 * - `seed` step (plans/006) runs first, before role_questions: the manager's LinkedIn URL / CV become the merged
 *   identity and set investigations.subject/anchor; a scrape or model failure is a ledger note, never a failed run;
 *   seed row ids are stable (stableId), so a retried seed step upserts instead of duplicating sources/candidates;
 *   the given profile's ProfileFacts go into its ledger ref as `digest`
 * - `role_template` step: a run started from a position (questions_json set, role_questions skipped) still matches the
 *   catalog template by title (no model call), so role_sites_serp and the technical-role gate get their sites and family
 * - verify's ledger row carries `ref.challenge` (devil's advocate record, idea #8: checked, held, per claim ground + why)
 * - a collector's `digest` (StepOutcome.digest) lands in the step's ledger ref as `digest`
 * - `onEmpty`: run the declared fallback step once, or record a Gap (ledger decision with ref.gap)
 * - resolve: persist candidates; pause with `step.waitForEvent('lineup-answer')` only when candidates exist and none is
 *   merged (lineupNeedsAnswer, seed merges count, so a given profile/CV never pauses); apply the manager's decisions on resume
 * - Budget (RUN_BUDGET_USD / RUN_BUDGET_CALLS) enforced here for collector steps, never by the LLM; parallel
 *   batches run at most (budget - spent) paid actor steps at once (planBatch), free REST steps always run
 * - Source identity re-marked after the lineup and before extract (applySourceIdentity), so only SERP hits on
 *   a merged profile count as confirmed
 * - Truthful gaps: a collector that made no request, or whose requests all failed, records "not searched: <why>", not its onEmpty text; a
 *   post-lineup collector whose hits are all unconfirmed records UNCONFIRMED_GAP, so every source ends in a row or a gap;
 *   a collector whose hits were all stored by an earlier step is not empty (runner), so no onEmpty gap is recorded
 * - Model failures degrade (evidence-only brief, ledger `{degraded}`) and the run still ends `done`;
 *   `failed` is only for unexpected throws and for a missing APIFY_TOKEN / ANTHROPIC_API_KEY (check-secrets step,
 *   src/domain/secrets.ts), whose reason ("APIFY_TOKEN is not set") lands in the ledger
 *
 * Design constraints:
 * - Imports only src/domain, src/recipe and src/adapters, never Next.js
 * - Step return values stay tiny (counts); payloads live in D1/R2
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { makeActorCall } from "@/adapters/apify";
import { applySourceIdentity, loadContext, loadRoleTemplates, makeLedgerAppend, makeSourceStore, persistOutcome, setCandidateDecisions } from "@/adapters/d1";
import { makeFetchJson } from "@/adapters/fetch";
import { makeLlmCall } from "@/adapters/llm";
import type { Candidate, GoalId } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { matchRoleTemplate } from "@/domain/role-catalog";
import { missingSecrets } from "@/domain/secrets";
import { planBatch } from "@/recipe/batch";
import { recipeFor } from "@/recipe/goals";
import { executeStep } from "@/recipe/runner";
import { lineupNeedsAnswer, noneConfirmed, UNCONFIRMED_GAP } from "@/recipe/seams/resolve";
import { roleQuestionsFor } from "@/recipe/seams/role";
import { CV_ACTOR, seedProfile } from "@/recipe/seams/seed";
import { HARVEST_ACTOR } from "@/recipe/sources/linkedin";
import type { StepOutcome } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";

export type ResearchRunParams = { runId: string };

export type LineupAnswer = { decisions: { id: string; decision: Candidate["decision"] }[] };

type Head = {
  subject: string;
  anchor: string;
  goal: GoalId;
  role: string | null;
  questions_json: string | null;
  role_template: string | null;
  profile_url: string | null;
  cv_text: string | null;
};

const COLLECTOR_KINDS = new Set<Step["kind"]>(["serp", "actor", "ares"]);
/** Collector steps run concurrently after the lineup; Apify + REST calls are I/O bound and independent. */
const PARALLEL = 5;

export class ResearchRunWorkflow extends WorkflowEntrypoint<CloudflareEnv, ResearchRunParams> {
  async run(event: Readonly<WorkflowEvent<ResearchRunParams>>, step: WorkflowStep): Promise<void> {
    const { runId } = event.payload;
    try {
      await this.runRecipe(runId, step);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await step.do("fail", async () => {
        await this.setStatus(runId, "failed");
        await this.ledger(runId, "run", "decision", 0, 0, { failed: true, reason });
      });
      throw error;
    }
  }

  private ports(): Ports {
    const env = this.env;
    return {
      callActor: makeActorCall(env.APIFY_TOKEN),
      fetchJson: makeFetchJson({ githubToken: env.GITHUB_TOKEN, stackExchangeKey: env.STACKEXCHANGE_KEY, openAlexKey: env.OPENALEX_API_KEY }),
      llm: makeLlmCall(env.ANTHROPIC_API_KEY, { primary: env.LLM_MODEL_PRIMARY, verify: env.LLM_MODEL_VERIFY }),
      appendLedger: makeLedgerAppend(env.DB),
      storeSource: makeSourceStore(env.DB, env.SOURCES),
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
    };
  }

  private async runRecipe(runId: string, step: WorkflowStep): Promise<void> {
    const head = await step.do("load-investigation", async () => {
      const row = await this.env.DB.prepare("SELECT subject, anchor, goal, role, questions_json, role_template, profile_url, cv_text FROM investigations WHERE id = ?")
        .bind(runId)
        .first<Head>();
      if (!row) throw new Error(`investigation ${runId} not found`);
      await this.setStatus(runId, "running");
      return row;
    });
    // An empty key would turn every actor or model call into a 401 and end the run "done" with nothing: fail instead
    await step.do("check-secrets", { retries: { limit: 0, delay: 0 } }, () => {
      const missing = missingSecrets(this.env);
      if (missing.length > 0) throw new Error(missing.join("; "));
      return Promise.resolve();
    });
    const recipe = recipeFor(head.goal);
    const seed = recipe.steps.find((s) => s.kind === "seed");
    if (seed !== undefined && (head.profile_url !== null || head.cv_text !== null)) {
      const derived = await this.seedStep(runId, seed, head, step);
      head.subject = derived.subject;
      head.anchor = derived.anchor;
    }
    if (head.subject.trim() === "") throw new Error("could not work out the candidate's name from the profile or CV");

    if (head.role !== null && head.role.length > 0 && head.questions_json !== null && head.role_template === null) {
      // A run started from a position already carries its questions, so role_questions is skipped below; the catalog
      // template still has to be matched (no model call) or role_sites_serp and the technical-role gate see no template.
      await step.do("role_template", async () => {
        const hit = matchRoleTemplate(head.role ?? "", await loadRoleTemplates(this.env.DB));
        if (hit !== null) await this.env.DB.prepare("UPDATE investigations SET role_template = ? WHERE id = ?").bind(hit.key, runId).run();
        return hit?.key ?? null;
      });
    }
    if (head.role !== null && head.role.length > 0 && head.questions_json === null) {
      await step.do("role_questions", async () => {
        const started = Date.now();
        const r = await roleQuestionsFor(head.role ?? "", await loadRoleTemplates(this.env.DB), this.ports(), head.anchor);
        await this.env.DB.prepare("UPDATE investigations SET questions_json = ?, role_template = ? WHERE id = ?")
          .bind(JSON.stringify(r.questions), r.template, runId)
          .run();
        await this.ledger(runId, "role_questions", "llm", r.cost_usd, Date.now() - started, { questions: r.questions.length, calls: r.calls, notes: r.notes, template: r.template });
        return r.questions.length;
      });
    }

    const ran = new Set<string>();
    let afterResolve = false;
    const runOne = async (recipeStep: Step): Promise<void> => {
      const result = await this.doStep(runId, recipeStep, recipe.questions, step);
      ran.add(recipeStep.id);
      if (result.skipped !== null) {
        // Never claim a search that did not happen: the gap says why it was skipped
        await this.recordGap(runId, recipeStep, `not searched: ${result.skipped}`, step);
      } else if (afterResolve && result.unconfirmed) {
        // Namesake hits only: say it was searched, so the brief is never silent on a source
        await this.recordGap(runId, recipeStep, UNCONFIRMED_GAP, step);
      } else if (result.empty && recipeStep.onEmpty !== undefined) {
        if ("gap" in recipeStep.onEmpty) {
          await this.recordGap(runId, recipeStep, recipeStep.onEmpty.gap, step);
        } else {
          const fallback = recipe.steps.find((s) => s.id === (recipeStep.onEmpty as { fallbackStep: string }).fallbackStep);
          if (fallback && fallback.id !== recipeStep.id && !ran.has(`${fallback.id}:fallback`)) {
            ran.add(`${fallback.id}:fallback`);
            await this.ledger(runId, recipeStep.id, "decision", 0, 0, { onEmpty: "fallback", fallbackStep: fallback.id });
            const again = await this.doStep(runId, { ...fallback, id: `${fallback.id}:fallback` }, recipe.questions, step);
            if (again.empty) await this.recordGap(runId, recipeStep, `fallback ${fallback.id} also empty`, step);
          } else {
            await this.recordGap(runId, recipeStep, "no usable fallback", step);
          }
        }
      }
    };

    // Before the lineup every step feeds the next (SERP -> candidates), so they run in order. After it the
    // collectors are independent: run them in batches of PARALLEL so a full recipe stays inside the 2-4 minute promise.
    // Each batch reads the spent calls once and starts no more paid steps than the budget has left.
    let batch: Step[] = [];
    let batchNo = 0;
    const flush = async (): Promise<void> => {
      while (batch.length > 0) {
        const remaining = await step.do(`batch-${String(++batchNo)}`, async () => {
          const ctx = await loadContext(this.env.DB, runId, recipe.questions);
          return ctx.budget.calls - ctx.spent.calls;
        });
        const { now, later } = planBatch(batch, remaining, PARALLEL);
        await Promise.all(now.map(runOne));
        batch = later;
      }
    };
    for (const recipeStep of recipe.steps) {
      // The seed step already ran above (or was skipped without a profile / CV); executeStep rejects it.
      if (recipeStep.kind === "seed") continue;
      if (recipeStep.kind === "resolve") {
        await this.resolveWithPause(runId, recipeStep, recipe.questions, step);
        afterResolve = true;
        continue;
      }
      if (afterResolve && COLLECTOR_KINDS.has(recipeStep.kind)) {
        batch.push(recipeStep);
        continue;
      }
      await flush();
      await runOne(recipeStep);
    }
    await flush();

    await step.do("finish", async () => {
      await this.setStatus(runId, "done");
      return { runId, status: "done" };
    });
  }

  /**
   * `skipped` is the reason a collector made no request at all (budget, nothing to look up); null when it ran.
   * `unconfirmed`: a collector returned hits and none is on a merged profile.
   */
  private async doStep(
    runId: string,
    recipeStep: Step,
    questions: ReturnType<typeof recipeFor>["questions"],
    step: WorkflowStep,
  ): Promise<{ empty: boolean; skipped: string | null; unconfirmed: boolean }> {
    return step.do(recipeStep.id, { retries: { limit: 1, delay: "5 seconds" } }, async () => {
      const started = Date.now();
      if (recipeStep.kind === "extract") await applySourceIdentity(this.env.DB, runId);
      const ctx = await loadContext(this.env.DB, runId, questions);
      if (COLLECTOR_KINDS.has(recipeStep.kind) && (ctx.spent.calls >= ctx.budget.calls || ctx.spent.usd >= ctx.budget.usd)) {
        await this.ledger(runId, recipeStep.id, "decision", 0, 0, { skipped: "run budget reached", spent: ctx.spent });
        return { empty: true, skipped: "run budget reached", unconfirmed: false };
      }
      const out: StepOutcome = await executeStep(recipeStep, ctx, this.ports());
      await persistOutcome(this.env.DB, runId, out);
      await this.ledger(runId, recipeStep.id, COLLECTOR_KINDS.has(recipeStep.kind) ? "call" : "llm", out.cost_usd, Date.now() - started, {
        actor: recipeStep.actor ?? null,
        sources: out.sources.length,
        candidates: out.candidates.length,
        claims: out.claims.length,
        brief: out.brief !== null,
        calls: out.calls,
        empty: out.empty,
        notes: out.notes,
        // Devil's advocate record (verify only): read back by GET /api/runs/:id/state (readChallenge), no migration
        ...(out.challenge === undefined ? {} : { challenge: out.challenge }),
        // Collector digest (e.g. github-deep): same pattern, read back by the run state route
        ...(out.digest === undefined ? {} : { digest: out.digest }),
      });
      const degraded = out.brief?.degraded ?? null;
      if (degraded !== null) await this.ledger(runId, recipeStep.id, "decision", 0, 0, { degraded });
      // A collector that made no request, or whose every request failed, has not searched anything: the gap
      // must say so instead of the recipe's "nothing found" text (a 401 from Apify is not "no search hits").
      // Reused seed evidence (not empty) is not a skip.
      const allFailed = out.notes.length > 0 && out.notes.every((n) => n.startsWith("request failed") || n === "run budget reached");
      const skipped = COLLECTOR_KINDS.has(recipeStep.kind) && out.empty && (out.calls === 0 || allFailed) && out.notes.length > 0 ? out.notes.join("; ") : null;
      const unconfirmed = COLLECTOR_KINDS.has(recipeStep.kind) && noneConfirmed(out.sources, ctx.candidates);
      return { empty: out.empty, skipped, unconfirmed };
    });
  }

  /** Profile URL / CV -> merged Source + Candidates, subject and anchor; one ledger row per lane used (actor, model). */
  private async seedStep(runId: string, recipeStep: Step, head: Head, step: WorkflowStep): Promise<{ subject: string; anchor: string }> {
    return step.do(recipeStep.id, { retries: { limit: 1, delay: "5 seconds" } }, async () => {
      const started = Date.now();
      const r = await seedProfile({ runId, subject: head.subject, anchor: head.anchor, profileUrl: head.profile_url, cvText: head.cv_text }, this.ports());
      await persistOutcome(this.env.DB, runId, r.out);
      await this.env.DB.prepare("UPDATE investigations SET subject = ?, anchor = ? WHERE id = ?").bind(r.subject, r.anchor, runId).run();
      const ref = { subject: r.subject, anchor: r.anchor, headline: r.headline, employer: r.employer, sources: r.out.sources.length, candidates: r.out.candidates.length, notes: r.out.notes };
      const ms = Date.now() - started;
      if (head.profile_url !== null) await this.ledger(runId, recipeStep.id, "call", r.actor.cost_usd, ms, { ...ref, ...(r.out.digest === undefined ? {} : { digest: r.out.digest }), actor: HARVEST_ACTOR, calls: r.actor.calls });
      if (head.cv_text !== null) await this.ledger(runId, recipeStep.id, "llm", r.llm.cost_usd, ms, { ...ref, actor: CV_ACTOR, calls: r.llm.calls });
      return { subject: r.subject, anchor: r.anchor };
    });
  }

  private async resolveWithPause(runId: string, recipeStep: Step, questions: ReturnType<typeof recipeFor>["questions"], step: WorkflowStep): Promise<void> {
    const needsAnswer = await step.do(recipeStep.id, async () => {
      const started = Date.now();
      const ctx = await loadContext(this.env.DB, runId, questions);
      const out = await executeStep(recipeStep, ctx, this.ports());
      await persistOutcome(this.env.DB, runId, out);
      const all = [...ctx.candidates, ...out.candidates];
      const ask = lineupNeedsAnswer(all);
      await this.ledger(runId, recipeStep.id, "llm", out.cost_usd, Date.now() - started, {
        candidates: out.candidates.map((c) => ({ id: c.id, platform: c.platform, url: c.profile_urls[0], score: c.score, decision: c.decision, snippet: c.snippet, reasons: c.reasons })),
        calls: out.calls,
        notes: out.notes,
        ask,
      });
      return ask;
    });
    if (!needsAnswer) return;

    await step.do(`${recipeStep.id}:pause`, async () => {
      await this.setStatus(runId, "paused");
      await this.ledger(runId, recipeStep.id, "pause", 0, 0, { waitingFor: "lineup-answer" });
    });
    const answer = await step.waitForEvent<LineupAnswer>("lineup-answer", { type: "lineup-answer", timeout: "1 hour" });
    await step.do(`${recipeStep.id}:answered`, async () => {
      await setCandidateDecisions(this.env.DB, runId, answer.payload.decisions);
      await this.setStatus(runId, "running");
      await this.ledger(runId, recipeStep.id, "decision", 0, 0, { decisions: answer.payload.decisions });
    });
  }

  private async recordGap(runId: string, recipeStep: Step, reason: string, step: WorkflowStep): Promise<void> {
    await step.do(`${recipeStep.id}:gap`, async () => {
      await this.env.DB.prepare("INSERT OR REPLACE INTO gaps (run_id, question_id, reason) VALUES (?, ?, ?)").bind(runId, recipeStep.id, reason).run();
      await this.ledger(runId, recipeStep.id, "decision", 0, 0, { gap: true, reason });
    });
  }

  private async setStatus(runId: string, status: "running" | "paused" | "done" | "failed"): Promise<void> {
    await this.env.DB.prepare("UPDATE investigations SET status = ? WHERE id = ?").bind(status, runId).run();
  }

  private async ledger(runId: string, stepId: string, kind: "call" | "llm" | "decision" | "pause", cost_usd: number, ms: number, ref: unknown): Promise<void> {
    await makeLedgerAppend(this.env.DB)({ run_id: runId, step: stepId, kind, cost_usd, ms, ref });
  }
}
