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
 * - Otherwise one `verify`-model call (translatePrompt), merged with mergeTranslation (unknown ids dropped, missing
 *   ids and new Art. 9 topics fall back to English), cached, and one `llm` ledger row (step TRANSLATE_STEP,
 *   cost_usd, ref `{ translate, texts, calls: 1 }`, no content) so the cost line and the audit's processors stay true
 * - Refuses before the call: 402 when the estimate exceeds TRANSLATE_BUDGET_USD, 503 without an AI key; 502 when the model fails
 * - Answer `{ lang, texts: { id: text }, cached }`
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
  TRANSLATE_BUDGET_USD,
  TRANSLATE_STEP,
  TranslateBody,
  TranslationOutput,
  estimateTranslateUsd,
  mergeTranslation,
  textsHash,
  translatePrompt,
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
  let result: { value: TranslationOutput; cost_usd: number };
  try {
    result = await deps.llm({ model: "verify", ...translatePrompt(texts), schema: TranslationOutput });
  } catch {
    return json({ error: "the translation service did not answer; try again later" }, 502);
  }
  const translated = mergeTranslation(texts, result.value);
  await deps.ledger({
    run_id: runId,
    step: TRANSLATE_STEP,
    kind: "llm",
    cost_usd: result.cost_usd,
    ms: Math.max(0, Math.round(deps.now() - started)),
    ref: { translate: lang, texts: texts.length, translated: Object.keys(translated).length, calls: 1 },
  });
  const entry: CachedTranslation = { lang, brief_hash: hash, texts: translated };
  await env.SOURCES.put(key, JSON.stringify(entry), { httpMetadata: { contentType: "application/json" } });
  return json({ lang, texts: translated, cached: false });
}
