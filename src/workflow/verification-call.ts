/**
 * VerificationCallWorkflow: waits for a dialed call's result, ingests it, and writes claims.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/verification-call.ts
 * Deps:    cloudflare:workers (WorkflowEntrypoint), D1 DB, R2 SOURCES, src/adapters/{d1,llm}, src/domain/call*, src/workflow/calls
 * Tested:  n/a (pure parts covered in src/workflow/__tests__/calls.test.ts and src/domain/__tests__/call-ingest.test.ts)
 *
 * Key responsibilities:
 * - load-call, wait for the `call-result` event (poll the provider if it times out), ingest, extract, finish
 * - Store the transcript as one `sources` row and the extracted STATEMENT/INFERENCE claims in `claims`
 * - Any thrown error marks the call `failed` with a ledger reason, then rethrows
 *
 * Design constraints:
 * - Imports only src/domain, src/recipe, src/adapters and src/workflow, never Next.js
 * - Dialing never happens here: the approve route already placed the call
 * - The result is persisted by the webhook route (or by the poll step) BEFORE the event is sent, so an
 *   early webhook is safe: load-call finds `result_r2_key` already set and skips the wait
 * - The R2 object at `result_r2_key` is the mapped CallResult JSON for both providers, not the raw webhook
 * - Steps cannot nest, so the poll loop is one `poll-result-N` step per attempt with `step.sleep` between
 * - Step payloads stay tiny: claim bodies go to D1 inside the step, never returned
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { claimUpsert, makeLedgerAppend, makeSourceStore } from "@/adapters/d1";
import { makeLlmCall } from "@/adapters/llm";
import { type Call, CallResult } from "@/domain/call";
import { callResultToClaims, transcriptToExcerpt } from "@/domain/call-ingest";
import type { Claim, LedgerKind } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { SOURCE_TTL_MS } from "@/recipe/runner";
import {
  CALL_RESULT_EVENT,
  CALL_SOURCE_ACTOR,
  callResultR2Key,
  callSourceId,
  callSourceUrl,
  failCall,
  loadCall,
  providerFor,
  recordCallResult,
  type CallResultEvent,
} from "@/workflow/calls";

export type VerificationCallParams = { callId: string; runId: string };

const POLL_ATTEMPTS = 3;
const NO_RETRY = { retries: { limit: 0, delay: "1 second" } } as const;

export class VerificationCallWorkflow extends WorkflowEntrypoint<CloudflareEnv, VerificationCallParams> {
  async run(event: Readonly<WorkflowEvent<VerificationCallParams>>, step: WorkflowStep): Promise<void> {
    const { callId, runId } = event.payload;
    try {
      await this.runCall(callId, runId, step);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await step.do("fail", async () => {
        await failCall(this.env.DB, callId, reason);
        return this.ledger(runId, "call:fail", "decision", { type: "phone", callId, failed: true, reason });
      });
      throw error;
    }
  }

  private async ledger(runId: string, step: string, kind: LedgerKind, ref: unknown, cost_usd = 0, ms = 0): Promise<{ seq: number }> {
    const entry = await makeLedgerAppend(this.env.DB)({ run_id: runId, step, kind, cost_usd, ms, ref });
    return { seq: entry.seq };
  }

  private async runCall(callId: string, runId: string, step: WorkflowStep): Promise<void> {
    const call = await step.do("load-call", async () => {
      const loaded = await loadCall(this.env.DB, callId);
      if (!loaded) throw new Error(`call ${callId} not found`);
      if (loaded.run_id !== runId) throw new Error(`call ${callId} does not belong to run ${runId}`);
      return loaded;
    });

    const key = call.result_r2_key ?? (await this.awaitResult(call, step));
    if (key === null) return;

    const sourceId = await step.do("ingest", async () => this.ingest(call, key));
    const { claims, gapReason } = await step.do("extract", async () => this.extract(call, key, sourceId));

    await step.do("finish", async () =>
      this.ledger(runId, "call:finish", "decision", {
        type: "phone",
        callId,
        provider: call.provider,
        mock: call.provider === "mock",
        claims,
        gap: gapReason,
      }),
    );
  }

  /** Wait for the webhook event, then poll (the first poll also picks up a result the webhook already stored). */
  private async awaitResult(call: Call, step: WorkflowStep): Promise<string | null> {
    try {
      await step.waitForEvent<CallResultEvent>(CALL_RESULT_EVENT, { type: CALL_RESULT_EVENT, timeout: "30 minutes" });
    } catch {
      // Timeout or lost event: fall through to polling the provider directly.
    }
    for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
      if (attempt > 1) await step.sleep(`poll-wait-${String(attempt)}`, "1 minute");
      let key: string | null = null;
      try {
        key = await step.do(`poll-result-${String(attempt)}`, NO_RETRY, async () => this.pollOnce(call));
      } catch (error) {
        // A transient provider error must not end the call; the next attempt (or poll-failed) decides.
        const reason = error instanceof Error ? error.message : String(error);
        await this.env.DB.prepare("UPDATE calls SET last_error = ? WHERE id = ?").bind(reason, call.id).run();
      }
      if (key !== null) return key;
    }
    await step.do("poll-failed", async () => {
      await failCall(this.env.DB, call.id, "no result from provider");
      return this.ledger(call.run_id, "call:poll", "decision", { type: "phone", callId: call.id, failed: true });
    });
    return null;
  }

  /** Returns the stored key when the webhook already landed; otherwise one provider fetch, persisted on success. */
  private async pollOnce(call: Call): Promise<string | null> {
    const stored = await this.env.DB.prepare("SELECT result_r2_key FROM calls WHERE id = ?")
      .bind(call.id)
      .first<{ result_r2_key: string | null }>();
    if (stored?.result_r2_key !== null && stored?.result_r2_key !== undefined) return stored.result_r2_key;
    if (call.provider_conversation_id === null) return null;
    const result = await providerFor(call.provider, this.env).fetchResult(call.provider_conversation_id);
    if (result === null) return null;
    const key = callResultR2Key(call.run_id, call.id);
    await this.env.SOURCES.put(key, JSON.stringify(result));
    await recordCallResult(this.env.DB, call.id, result, key, new Date().toISOString()).run();
    return key;
  }

  private async readResult(key: string): Promise<CallResult> {
    const object = await this.env.SOURCES.get(key);
    if (!object) throw new Error(`call result ${key} missing in R2`);
    return CallResult.parse(await object.json());
  }

  /** One `sources` row for the transcript; makeSourceStore re-puts the same object under the same key. */
  private async ingest(call: Call, key: string): Promise<string> {
    const result = await this.readResult(key);
    const now = Date.now();
    const source = await makeSourceStore(this.env.DB, this.env.SOURCES)(
      {
        id: callSourceId(call.id),
        run_id: call.run_id,
        url: callSourceUrl(call.provider, result.provider_conversation_id),
        actor: CALL_SOURCE_ACTOR[call.provider],
        fetched_at: new Date(now).toISOString(),
        excerpt: transcriptToExcerpt(result.transcript),
        expires_at: new Date(now + SOURCE_TTL_MS).toISOString(),
        // Operator-entered number with recorded consent: the transcript is about the subject by construction.
        identity: "merged",
      },
      result,
    );
    return source.id;
  }

  private async extract(call: Call, key: string, sourceId: string): Promise<{ claims: number; gapReason: string | null }> {
    const result = await this.readResult(key);
    const inner = makeLlmCall(this.env.ANTHROPIC_API_KEY, {
      primary: this.env.LLM_MODEL_PRIMARY,
      verify: this.env.LLM_MODEL_VERIFY,
    });
    let costUsd = 0;
    const started = Date.now();
    const llm: LlmCall = async (input) => {
      const out = await inner(input);
      costUsd += out.cost_usd;
      return out;
    };
    const { claims, gapReason } = await callResultToClaims({
      result,
      brief: call.brief,
      runId: call.run_id,
      callId: call.id,
      sourceId,
      llm,
    });
    await this.ledger(
      call.run_id,
      "call:extract",
      "llm",
      { type: "phone", callId: call.id, claims: claims.length, gap: gapReason },
      costUsd,
      Date.now() - started,
    );
    await this.writeClaims(call.run_id, claims);
    return { claims: claims.length, gapReason };
  }

  /** Upsert the claims and close the gaps they answer, in one batch. */
  private async writeClaims(runId: string, claims: Claim[]): Promise<void> {
    if (claims.length === 0) return;
    const questionIds = [...new Set(claims.map((c) => c.question_id))];
    await this.env.DB.batch([
      ...claims.map((c) => claimUpsert(this.env.DB, c)),
      this.env.DB
        .prepare(`DELETE FROM gaps WHERE run_id = ? AND question_id IN (${questionIds.map(() => "?").join(", ")})`)
        .bind(runId, ...questionIds),
    ]);
  }
}
