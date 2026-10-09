/**
 * POST /api/runs/:id/personality logic: read the working style (DISC, MBTI, Big Five, recommendations) again for a
 * finished run and store it in the brief's profile, so runs built before the Big Five existed get one without a rerun.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/personality/handler.ts
 * Deps:    src/app/api/_lib/run-access, src/domain/claim (Brief, Candidate, Source), src/domain/ports (types), src/recipe/seams/{personality,resolve}
 * Tested:  src/app/api/runs/[id]/personality/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - Auth like POST /api/runs/:id/delete: a same-origin session user (of the run's organization) or the bearer
 * - Unknown run 404; another organization 403; no brief with a profile 409; no AI key 503; model failure 502
 * - Reads the run's sources (merged identity, minus rejected profiles: confirmedSources) and merged candidates from D1, one `primary` call (readPersonality),
 *   writes `profile.personality` back into briefs.brief_json and one `llm` ledger row (step PERSONALITY_STEP, cost, counts)
 * - Answer `{ personality }`
 *
 * Design constraints:
 * - Takes bindings and ports as parameters so tests run under plain Node; no Next.js imports; every response is no-store
 */
import { authorizeRunAction, findRunOwner, otherOrganization } from "@/app/api/_lib/run-access";
import { Brief, type Candidate, type Profile, type Source } from "@/domain/claim";
import type { LedgerAppend, LlmCall } from "@/domain/ports";
import { readPersonality } from "@/recipe/seams/personality";
import { confirmedSources } from "@/recipe/seams/resolve";

export const PERSONALITY_STEP = "profile_personality";

export type PersonalityEnv = { DB: D1Database; RUN_TOKEN?: string };
export type PersonalityDeps = {
  /** null when no AI key is configured. */
  llm: LlmCall | null;
  ledger: LedgerAppend;
  now: () => number;
};

type Head = { id: string; subject: string; anchor: string; role: string | null };
type CandidateRow = Omit<Candidate, "profile_urls" | "reasons"> & { profile_urls_json: string; reasons_json: string };

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function personalityRoute(request: Request, env: PersonalityEnv, runId: string, deps: PersonalityDeps): Promise<Response> {
  const { user, denied } = await authorizeRunAction(request, env);
  if (denied !== null) return denied;
  const run = await findRunOwner(env.DB, runId);
  if (run === null) return json({ error: "run not found" }, 404);
  if (otherOrganization(user, run)) return json({ error: "another organization's run" }, 403);
  if (deps.llm === null) return json({ error: "no AI key configured" }, 503);

  const [head, briefRow, sources, cands] = await Promise.all([
    env.DB.prepare("SELECT id, subject, anchor, role FROM investigations WHERE id = ?").bind(runId).first<Head>(),
    env.DB.prepare("SELECT brief_json FROM briefs WHERE run_id = ?").bind(runId).first<{ brief_json: string }>(),
    env.DB.prepare("SELECT * FROM sources WHERE run_id = ?").bind(runId).all<Source>(),
    env.DB.prepare("SELECT * FROM candidates WHERE run_id = ?").bind(runId).all<CandidateRow>(),
  ]);
  if (head === null || briefRow === null) return json({ error: "the run has no brief yet" }, 409);
  const brief = Brief.parse(JSON.parse(briefRow.brief_json));
  if (brief.profile?.degraded !== null) return json({ error: "the run has no profile" }, 409);
  const candidates: Candidate[] = cands.results.map(({ profile_urls_json, reasons_json, ...c }) => ({
    ...c,
    profile_urls: JSON.parse(profile_urls_json) as string[],
    reasons: JSON.parse(reasons_json) as string[],
  }));
  const merged = candidates.filter((c) => c.decision === "merge");
  const confirmed = confirmedSources({ sources: sources.results, candidates });

  const started = deps.now();
  let personality: Profile["personality"];
  let cost_usd: number;
  try {
    ({ personality, cost_usd } = await readPersonality({ subject: head.subject, anchor: head.anchor, role: head.role, sources: confirmed, merged }, deps.llm));
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error("personality failed", { runId, name: e.name, message: e.message.slice(0, 200) });
    await deps.ledger({ run_id: runId, step: PERSONALITY_STEP, kind: "llm", cost_usd: (error as { cost_usd?: number }).cost_usd ?? 0, ms: deps.now() - started, ref: { failed: true } });
    return json({ error: "the model did not answer" }, 502);
  }
  const profile: Profile = { ...brief.profile, personality };
  await env.DB.prepare("UPDATE briefs SET brief_json = ? WHERE run_id = ?").bind(JSON.stringify({ ...brief, profile }), runId).run();
  await deps.ledger({
    run_id: runId,
    step: PERSONALITY_STEP,
    kind: "llm",
    cost_usd,
    ms: deps.now() - started,
    ref: { big5: personality.big5 === null ? 0 : personality.big5.traits.length, lines: personality.evidence.length, dropped: personality.evidence_dropped },
  });
  return json({ personality });
}
