/**
 * VerificationCallWorkflow: waits for a dialed call's result, ingests it, and writes claims.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/verification-call.ts
 * Deps:    cloudflare:workers (WorkflowEntrypoint), D1 DB, R2 SOURCES, src/domain/call*, src/workflow/{calls,ledger,adapters/llm}
 * Tested:  n/a (pure parts covered in src/workflow/__tests__/calls.test.ts and src/domain/__tests__/call-ingest.test.ts)
 *
 * Key responsibilities:
 * - load-call, wait for the `call-result` event (poll the provider if it times out), ingest, extract, finish
 * - Store the transcript as one `sources` row and the extracted STATEMENT/INFERENCE claims in `claims`
 * - Any thrown error marks the call `failed` with a ledger reason, then rethrows
 *
 * Design constraints:
 * - Imports only src/domain and src/workflow, never Next.js
 * - Dialing never happens here: the approve route already placed the call
 * - The result is persisted by the webhook route (or by the poll step) BEFORE the event is sent, so an
 *   early webhook is safe: load-call finds `result_r2_key` already set and skips the wait
 * - The R2 object at `result_r2_key` is the mapped CallResult JSON for both providers, not the raw webhook
 * - Steps cannot nest, so the poll loop is one `poll-result-N` step per attempt with `step.sleep` between
 * - Step payloads stay tiny: claim bodies go to D1 inside the step, never returned
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { type Call, CallResult, transitionCall } from "@/domain/call";
import { callResultToClaims, transcriptToExcerpt } from "@/domain/call-ingest";
import type { Claim } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { createLlm } from "@/workflow/adapters/llm";
import { callResultR2Key, callSourceUrl, loadCall, selectCallProvider } from "@/workflow/calls";
import { appendLedger } from "@/workflow/ledger";

export type VerificationCallParams = { callId: string; runId: string };

export type CallResultEvent = { conversation_id: string };

export const CALL_RESULT_EVENT = "call-result";

const POLL_ATTEMPTS = 3;
const SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NO_RETRY = { retries: { limit: 0, delay: "1 second" } } as const;

type Loaded = { status: string; result_r2_key: string | null; provider: string; provider_conversation_id: string | null };

const bit = (b: boolean | null): number | null => (b === null ? null : Number(b));
const pick = ({ status, result_r2_key, provider, provider_conversation_id }: Call): Loaded => ({ status, result_r2_key, provider, provider_conversation_id });

export class VerificationCallWorkflow extends WorkflowEntrypoint<CloudflareEnv, VerificationCallParams> {
  async run(event: Readonly<WorkflowEvent<VerificationCallParams>>, step: WorkflowStep): Promise<void> {
    const { callId, runId } = event.payload;
    try {
      await this.runCall(callId, runId, step);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await step.do("fail", async () => {
        const sql = "UPDATE calls SET status = 'failed', last_error = ?, finished_at = ? WHERE id = ?";
        await this.env.DB.prepare(sql).bind(reason, new Date().toISOString(), callId).run();
        return appendLedger(this.env.DB, runId, {
          step: "call:fail",
          kind: "decision",
          cost_usd: 0,
          ms: 0,
          ref: { type: "phone", callId, failed: true, reason },
        });
      });
      throw error;
    }
  }

  private async runCall(callId: string, runId: string, step: WorkflowStep): Promise<void> {
    const loaded = await step.do("load-call", async (): Promise<Loaded> => {
      const call = await loadCall(this.env.DB, callId);
      if (!call) throw new Error(`call ${callId} not found`);
      if (call.run_id !== runId) throw new Error(`call ${callId} does not belong to run ${runId}`);
      return pick(call);
    });

    const key = loaded.result_r2_key ?? (await this.awaitResult(callId, runId, loaded, step));
    if (key === null) return;

    const { sourceId } = await step.do("ingest", async () => this.ingest(callId, runId, key, loaded.provider));
    const { claims, gapReason } = await step.do("extract", async () => this.extract(callId, runId, key, sourceId));

    await step.do("finish", async () =>
      appendLedger(this.env.DB, runId, {
        step: "call:finish",
        kind: "decision",
        cost_usd: 0,
        ms: 0,
        ref: { type: "phone", callId, provider: loaded.provider, mock: loaded.provider === "mock", claims, gap: gapReason },
      }),
    );
  }

  /** Wait for the webhook event, then poll the provider; returns the result key or null after failing the call. */
  private async awaitResult(callId: string, runId: string, loaded: Loaded, step: WorkflowStep): Promise<string | null> {
    try {
      await step.waitForEvent<CallResultEvent>(CALL_RESULT_EVENT, { type: CALL_RESULT_EVENT, timeout: "30 minutes" });
      const key = await step.do("reload-call", async () => (await loadCall(this.env.DB, callId))?.result_r2_key ?? null);
      if (key !== null) return key;
    } catch {
      // Timeout (or lost event): fall through to polling the provider directly.
    }
    for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
      if (attempt > 1) await step.sleep(`poll-wait-${String(attempt)}`, "1 minute");
      const key = await step.do(`poll-result-${String(attempt)}`, NO_RETRY, async () => this.pollOnce(callId, runId, loaded));
      if (key !== null) return key;
    }
    await step.do("poll-failed", async () => {
      const sql = "UPDATE calls SET status = 'failed', failure_reason = 'no result from provider', last_error = 'no result from provider', finished_at = ? WHERE id = ?";
      await this.env.DB.prepare(sql).bind(new Date().toISOString(), callId).run();
      return appendLedger(this.env.DB, runId, {
        step: "call:poll",
        kind: "decision",
        cost_usd: 0,
        ms: 0,
        ref: { type: "phone", callId, failed: true },
      });
    });
    return null;
  }

  /** One provider fetch; stores the result in R2 and updates the call row when it is ready. */
  private async pollOnce(callId: string, runId: string, loaded: Loaded): Promise<string | null> {
    const current = await loadCall(this.env.DB, callId);
    const existing = current?.result_r2_key ?? null;
    if (existing !== null) return existing; // webhook won the race
    const result = loaded.provider_conversation_id === null ? null : await selectCallProvider(this.env).fetchResult(loaded.provider_conversation_id);
    if (result === null) return null;
    const key = callResultR2Key(runId, callId);
    await this.env.SOURCES.put(key, JSON.stringify(result));
    const status = transitionCall(current?.status ?? "in_call", { type: "result", outcome: result.outcome });
    await this.env.DB.prepare(
      `UPDATE calls SET result_r2_key = ?, status = ?, call_successful = ?, identity_confirmed = ?, duration_secs = ?,
         cost_usd = ?, failure_reason = ?, finished_at = ? WHERE id = ?`,
    )
      .bind(key, status, bit(result.call_successful), bit(result.identity_confirmed), result.duration_secs, result.cost_usd, result.failure_reason, new Date().toISOString(), callId)
      .run();
    return key;
  }

  private async readResult(key: string): Promise<CallResult> {
    const object = await this.env.SOURCES.get(key);
    if (!object) throw new Error(`call result ${key} missing in R2`);
    return CallResult.parse(await object.json());
  }

  private async ingest(callId: string, runId: string, key: string, provider: string): Promise<{ sourceId: string }> {
    const result = await this.readResult(key);
    const now = Date.now();
    const sourceId = `src-call-${callId}`;
    await this.env.DB.prepare(
      `INSERT OR REPLACE INTO sources (id, run_id, url, actor, fetched_at, excerpt, r2_key, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        sourceId,
        runId,
        callSourceUrl(provider === "elevenlabs" ? "elevenlabs" : "mock", result.provider_conversation_id),
        selectCallProvider(this.env).sourceActor,
        new Date(now).toISOString(),
        transcriptToExcerpt(result.transcript),
        key,
        new Date(now + SOURCE_TTL_MS).toISOString(),
      )
      .run();
    return { sourceId };
  }

  private async extract(callId: string, runId: string, key: string, sourceId: string): Promise<{ claims: number; gapReason: string | null }> {
    const call = await loadCall(this.env.DB, callId);
    if (!call) throw new Error(`call ${callId} not found`);
    const result = await this.readResult(key);
    const { llmWithCost } = createLlm({
      apiKey: this.env.ANTHROPIC_API_KEY,
      models: { primary: this.env.LLM_MODEL_PRIMARY, verify: this.env.LLM_MODEL_VERIFY },
    });
    let costUsd = 0;
    let ms = 0;
    const llm: LlmCall = async (input) => {
      const out = await llmWithCost(input);
      costUsd += out.cost_usd;
      ms += out.ms;
      return out.value;
    };
    const { claims, gapReason } = await callResultToClaims({ result, brief: call.brief, runId, callId, sourceId, llm });
    await appendLedger(this.env.DB, runId, {
      step: "call:extract",
      kind: "llm",
      cost_usd: costUsd,
      ms,
      ref: { type: "phone", callId, claims: claims.length, gap: gapReason },
    });
    await this.writeClaims(runId, claims);
    return { claims: claims.length, gapReason };
  }

  private async writeClaims(runId: string, claims: Claim[]): Promise<void> {
    if (claims.length === 0) return;
    const insert = this.env.DB.prepare(
      `INSERT OR REPLACE INTO claims (id, run_id, question_id, candidate_id, text, kind, confidence, quote, supports_json, contradicts_json, rank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const questionIds = [...new Set(claims.map((c) => c.question_id))];
    const closeGaps = this.env.DB
      .prepare(`DELETE FROM gaps WHERE run_id = ? AND question_id IN (${questionIds.map(() => "?").join(",")})`)
      .bind(runId, ...questionIds);
    await this.env.DB.batch([
      ...claims.map((c) =>
        insert.bind(c.id, runId, c.question_id, c.candidate_id, c.text, c.kind, c.confidence, c.quote, JSON.stringify(c.supports), JSON.stringify(c.contradicts), c.rank),
      ),
      closeGaps,
    ]);
  }
}
