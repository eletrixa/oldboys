/**
 * POST /api/runs/:id/calls/proposal logic: the AI-drafted call questions, drafted once per research state and cached.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/proposal/handler.ts
 * Deps:    src/app/api/_lib/run-access, src/domain/{call-brief,call-questions-llm}, src/domain/ports (types), ../load (type), bindings DB + SOURCES
 * Tested:  src/app/api/runs/[id]/calls/proposal/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - Auth like POST /api/runs/:id/translate: a same-origin session user (of the run's organization when it has one) or the bearer;
 *   unknown run 404, another organization 403, a queued run 409
 * - Cache: R2 SOURCES `call-questions/<runId>.json` = `{ input_hash, questions }`; served when input_hash matches the
 *   current drafter input and PROMPT_VERSION (new research or a new prompt drafts again); readCachedDraft is also what
 *   GET /api/runs/:id/calls uses, so the GET never calls the model
 * - Otherwise one `primary`-model call (draftCallQuestions); an AI draft is cached, a fallback is not
 * - One `llm` ledger row per model call (step CALL_QUESTIONS_STEP, cost_usd including what a failed call reported,
 *   ref `{ call_questions, questions, calls, reason? }`, no content)
 * - The model is not asked (rule-based answer with a note) for a due-diligence run, a run without a brief, without an
 *   AI key, or when the drafts of this run plus DRAFT_ESTIMATE_USD would pass CALL_BUDGET_USD
 * - Answer `{ source: "ai" | "rules", cached, note, proposal }` (CallProposal); a fallback is still 200 so the UI
 *   shows the rule-based questions
 *
 * Design constraints:
 * - Takes bindings and ports as parameters so tests run under plain Node; no Next.js imports; every response is no-store
 * - Never logs or stores research content; the composed brief (first message, agent prompt) stays deterministic
 */
import { authorizeRunAction, findRunOwner, otherOrganization } from "@/app/api/_lib/run-access";
import type { CallProposal } from "@/app/runs/[id]/call-panel";
import type { CallBrief, CallQuestion } from "@/domain/call";
import { buildCallBrief, composeCallBrief } from "@/domain/call-brief";
import {
  CALL_QUESTIONS_STEP,
  CachedCallQuestions,
  DRAFT_ESTIMATE_USD,
  type DraftInputs,
  callQuestionsKey,
  draftCallQuestions,
  draftInputHash,
} from "@/domain/call-questions-llm";
import type { LedgerAppend, LlmCall } from "@/domain/ports";
import type { CallInputs } from "../load";

export type ProposalEnv = { DB: D1Database; SOURCES: R2Bucket; RUN_TOKEN?: string; CALL_BUDGET_USD?: string };
export type ProposalDeps = {
  loadInputs: (db: D1Database, runId: string) => Promise<CallInputs | null>;
  /** null when no AI key is configured. */
  llm: LlmCall | null;
  ledger: LedgerAppend;
  now: () => number;
};

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

export async function proposalRoute(request: Request, env: ProposalEnv, runId: string, deps: ProposalDeps): Promise<Response> {
  const res = await handle(request, env, runId, deps);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function compose(inputs: DraftInputs, questions: readonly CallQuestion[]): CallBrief {
  return composeCallBrief({ goal: inputs.goal, subject: inputs.subject, role: inputs.role, questions });
}

/** The cached AI questions as a brief when they were drafted from the current inputs; null otherwise (or unreadable). */
export async function readCachedDraft(bucket: R2Bucket, runId: string, inputs: DraftInputs): Promise<CallBrief | null> {
  if (inputs.goal !== "hiring" || inputs.brief === null) return null;
  const object = await bucket.get(callQuestionsKey(runId));
  if (object === null) return null;
  try {
    const parsed = CachedCallQuestions.safeParse(JSON.parse(await object.text()));
    if (!parsed.success || parsed.data.input_hash !== (await draftInputHash(inputs))) return null;
    return compose(inputs, parsed.data.questions);
  } catch {
    return null;
  }
}

async function spentOnDrafts(db: D1Database, runId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ledger_entries WHERE run_id = ? AND step = ?")
    .bind(runId, CALL_QUESTIONS_STEP)
    .first<{ usd: number }>();
  return row?.usd ?? 0;
}

async function handle(request: Request, env: ProposalEnv, runId: string, deps: ProposalDeps): Promise<Response> {
  const { user, denied } = await authorizeRunAction(request, env);
  if (denied !== null) return denied;
  const run = await findRunOwner(env.DB, runId);
  if (!run) return json({ error: "run not found" }, 404);
  if (otherOrganization(user, run)) return json({ error: "this run belongs to another organization" }, 403);
  const inputs = await deps.loadInputs(env.DB, runId);
  if (inputs === null) return json({ error: "run not found" }, 404);
  if (inputs.status === "queued") return json({ error: "run has not started yet" }, 409);

  const rules = (note: string): Response => json({ source: "rules", cached: false, note, proposal: buildCallBrief(inputs) } satisfies CallProposal);
  if (inputs.goal !== "hiring") return rules("AI drafting is for hiring calls only.");
  if (inputs.brief === null) return rules("The brief is not finished yet.");

  const cached = await readCachedDraft(env.SOURCES, runId, inputs);
  if (cached !== null) return json({ source: "ai", cached: true, note: null, proposal: cached } satisfies CallProposal);
  if (deps.llm === null) return rules("AI drafting is not available: no AI key configured.");
  const budget = Number(env.CALL_BUDGET_USD) || 0.5;
  if ((await spentOnDrafts(env.DB, runId)) + DRAFT_ESTIMATE_USD > budget) return rules("The AI drafting budget of this run is used up.");

  const started = deps.now();
  const result = await draftCallQuestions(deps.llm, inputs);
  if (result.calls > 0) {
    await deps.ledger({
      run_id: runId,
      step: CALL_QUESTIONS_STEP,
      kind: "llm",
      cost_usd: result.cost_usd,
      ms: Math.max(0, Math.round(deps.now() - started)),
      ref: { call_questions: result.source, questions: result.questions.length, calls: result.calls, ...(result.reason === null ? {} : { reason: result.reason }) },
    });
  }
  if (result.source === "rules") {
    console.error("call questions draft fell back", { runId, reason: result.reason });
    return rules("The AI draft was not available, so these are the rule-based questions.");
  }
  const entry: CachedCallQuestions = { input_hash: await draftInputHash(inputs), questions: result.questions };
  await env.SOURCES.put(callQuestionsKey(runId), JSON.stringify(entry), { httpMetadata: { contentType: "application/json" } });
  return json({ source: "ai", cached: false, note: null, proposal: compose(inputs, result.questions) } satisfies CallProposal);
}
