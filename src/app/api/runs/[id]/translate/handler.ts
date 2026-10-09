/**
 * POST /api/runs/:id/translate logic: the brief's own texts in Czech, translated once per brief and cached (idea #24).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/translate/handler.ts
 * Deps:    src/app/api/_lib/{run-access,body}, src/domain/report-translation, src/domain/ports (types), src/app/runs/[id]/report-text, bindings DB + SOURCES
 * Tested:  src/app/api/runs/[id]/translate/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - Auth like POST /api/runs/:id/delete: a same-origin session user (of the run's organization when it has one) or the bearer
 * - Body `{ lang: "cs" }` (Zod, 400); unknown run 404; another organization 403; no finished brief 409
 * - Cache: R2 SOURCES `translations/<runId>/brief-cs.json` = `{ lang, brief_hash, texts }`; served when brief_hash
 *   matches the current texts (a changed brief or new claims are translated again)
 * - Otherwise the texts are cut into batches (translationBatches) and each batch is one `verify`-model call
 *   (translatePrompt), TRANSLATE_CONCURRENCY at a time, so no call nears the output cap and the whole takes about one
 *   batch's time; the outputs are merged with mergeTranslation (unknown ids dropped, missing ids and new Art. 9 topics
 *   fall back to English)
 * - Some batches failed: the translated part is answered with `partial: true` and not cached (a retry translates again);
 *   all failed: 502. Each failure is logged as `translate failed` with the run, batch, error name and message, never a text
 * - One `llm` ledger row for the whole translation (step TRANSLATE_STEP, cost_usd = all batches including what a failed
 *   call reported, ref `{ translate, texts, translated, calls, failed_calls }`, no content), also when every batch failed, so
 *   the cost line and the audit's processors stay true
 * - Refuses before any call: 402 when the estimate over all batches exceeds TRANSLATE_BUDGET_USD, 503 without an AI key
 * - Answer `{ lang, texts: { id: text }, cached, partial? }`
 *
 * Design constraints:
 * - Only the brief's own texts go to the model (reportTexts): no quotes, URLs, names or source excerpts
 * - Takes bindings and ports as parameters so tests run under plain Node; no Next.js imports; every response is no-store
 */
import { parseJsonBody } from "@/app/api/_lib/body";
import { authorizeRunAction, findRunOwner, otherOrganization } from "@/app/api/_lib/run-access";
import { reportTexts } from "@/app/runs/[id]/report-text";
import type { RunState } from "@/app/runs/[id]/state";
import type { LedgerAppend, LlmCall } from "@/domain/ports";
import {
  CachedTranslation,
  type ReportText,
  TRANSLATE_BUDGET_USD,
  TRANSLATE_CONCURRENCY,
  TRANSLATE_STEP,
  TranslateBody,
  TranslationOutput,
  estimateTranslateUsd,
  failedCallCost,
  mergeTranslation,
  textsHash,
  translatePrompt,
  translationBatches,
  translationKey,
} from "@/domain/report-translation";

export type TranslateEnv = { DB: D1Database; SOURCES: R2Bucket; RUN_TOKEN?: string };
export type TranslateDeps = {
  loadState: (db: D1Database, runId: string) => Promise<RunState | null>;
  /** null when no AI key is configured. */
  llm: LlmCall | null;
  ledger: LedgerAppend;
  now: () => number;
};

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

export async function translateRoute(request: Request, env: TranslateEnv, runId: string, deps: TranslateDeps): Promise<Response> {
  const res = await handle(request, env, runId, deps);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function readCache(bucket: R2Bucket, key: string): Promise<CachedTranslation | null> {
  const object = await bucket.get(key);
  if (object === null) return null;
  try {
    const parsed = CachedTranslation.safeParse(JSON.parse(await object.text()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** fn over every item, at most `limit` at a time; results in item order. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type BatchResult = { ok: true; output: TranslationOutput; cost_usd: number } | { ok: false; cost_usd: number };

/** Error class, message (capped) and finish reason only: never the texts the call carried. */
function logFailure(runId: string, batch: number, error: unknown): void {
  const e = error instanceof Error ? error : new Error(String(error));
  const finishReason = (error as { finishReason?: unknown } | null)?.finishReason;
  console.error("translate failed", {
    runId,
    batch,
    name: e.name,
    message: e.message.slice(0, 200),
    ...(typeof finishReason === "string" ? { finishReason } : {}),
  });
}

async function translateBatch(llm: LlmCall, runId: string, batch: readonly ReportText[], index: number): Promise<BatchResult> {
  try {
    const result = await llm({ model: "verify", ...translatePrompt(batch), schema: TranslationOutput });
    return { ok: true, output: result.value, cost_usd: result.cost_usd };
  } catch (error) {
    logFailure(runId, index, error);
    return { ok: false, cost_usd: failedCallCost(error) };
  }
}

async function handle(request: Request, env: TranslateEnv, runId: string, deps: TranslateDeps): Promise<Response> {
  const { user, denied } = await authorizeRunAction(request, env);
  if (denied !== null) return denied;
  const body = await parseJsonBody(request, TranslateBody);
  if (body.error) return body.error;
  const { lang } = body.data;

  const run = await findRunOwner(env.DB, runId);
  if (!run) return json({ error: "run not found" }, 404);
  if (otherOrganization(user, run)) return json({ error: "this run belongs to another organization" }, 403);
  const state = await deps.loadState(env.DB, runId);
  if (state === null) return json({ error: "run not found" }, 404);
  if (state.brief === null) return json({ error: "the brief is not finished yet" }, 409);

  const texts = reportTexts(state);
  if (texts.length === 0) return json({ lang, texts: {}, cached: false });
  const hash = await textsHash(texts);
  const key = translationKey(runId, lang);
  const cached = await readCache(env.SOURCES, key);
  if (cached?.brief_hash === hash) return json({ lang, texts: cached.texts, cached: true });

  if (estimateTranslateUsd(texts) > TRANSLATE_BUDGET_USD) return json({ error: "this brief is too long to translate within the cost limit" }, 402);
  if (deps.llm === null) return json({ error: "translation is not available: no AI key configured" }, 503);

  const started = deps.now();
  const { llm } = deps;
  const batches = translationBatches(texts);
  const results = await mapLimit(batches, TRANSLATE_CONCURRENCY, (batch, i) => translateBatch(llm, runId, batch, i));
  const outputs = results.flatMap((r) => (r.ok ? r.output.texts : []));
  const failed = results.filter((r) => !r.ok).length;
  const translated = mergeTranslation(texts, { texts: outputs });
  await deps.ledger({
    run_id: runId,
    step: TRANSLATE_STEP,
    kind: "llm",
    cost_usd: results.reduce((usd, r) => usd + r.cost_usd, 0),
    ms: Math.max(0, Math.round(deps.now() - started)),
    ref: { translate: lang, texts: texts.length, translated: Object.keys(translated).length, calls: batches.length, failed_calls: failed },
  });
  if (failed === batches.length) return json({ error: "the translation service did not answer; try again later" }, 502);
  if (failed > 0) return json({ lang, texts: translated, cached: false, partial: true });
  const entry: CachedTranslation = { lang, brief_hash: hash, texts: translated };
  await env.SOURCES.put(key, JSON.stringify(entry), { httpMetadata: { contentType: "application/json" } });
  return json({ lang, texts: translated, cached: false });
}
