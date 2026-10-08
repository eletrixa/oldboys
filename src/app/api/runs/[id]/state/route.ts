/**
 * GET /api/runs/:id/state: one-shot projection of a run for the brief page poller.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/state/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), bindings DB, src/recipe/goals, src/domain/run-cost
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Read investigation, candidates, claims, sources, brief and last ledger step from D1
 * - Questions = recipe base questions + investigations.questions_json; mentions = COUNT(sources)
 * - cost = runCost over the ledger rows (seq order) from investigations.created_at
 *
 * Design constraints:
 * - No runtime = "edge"; never cached; no auth (the id is an unguessable UUID, like GET /api/runs/:id)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Brief, Candidate, Claim } from "@/domain/claim";
import { GoalId } from "@/domain/claim";
import { type CostRow, runCost } from "@/domain/run-cost";
import { recipeFor } from "@/recipe/goals";
import type { RunState, RunStatus } from "@/app/runs/[id]/state";

type HeadRow = {
  id: string;
  subject: string;
  goal: string;
  status: RunStatus;
  questions_json: string | null;
  created_at: string;
};
type CandidateRow = Omit<Candidate, "profile_urls" | "reasons"> & { profile_urls_json: string; reasons_json: string };
type ClaimRow = Omit<Claim, "supports" | "contradicts"> & { supports_json: string; contradicts_json: string };

function parseList<T>(json: string | null): T[] {
  if (json === null || json === "") return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();

  const head = await env.DB.prepare(
    "SELECT id, subject, goal, status, questions_json, created_at FROM investigations WHERE id = ?",
  )
    .bind(id)
    .first<HeadRow>();
  if (!head) return Response.json({ error: "run not found" }, { status: 404 });

  const [cands, claims, sources, brief, ledger] = await Promise.all([
    env.DB.prepare("SELECT * FROM candidates WHERE run_id = ? ORDER BY score DESC").bind(id).all<CandidateRow>(),
    env.DB.prepare("SELECT * FROM claims WHERE run_id = ? ORDER BY rank").bind(id).all<ClaimRow>(),
    env.DB.prepare("SELECT id, url FROM sources WHERE run_id = ?").bind(id).all<{ id: string; url: string }>(),
    env.DB.prepare("SELECT brief_json FROM briefs WHERE run_id = ?").bind(id).first<{ brief_json: string }>(),
    env.DB.prepare("SELECT step, ts, kind, cost_usd, ms FROM ledger_entries WHERE run_id = ? ORDER BY seq")
      .bind(id)
      .all<CostRow & { step: string }>(),
  ]);
  const last = ledger.results.at(-1);

  const goal = GoalId.safeParse(head.goal);
  const base = goal.success ? recipeFor(goal.data).questions : [];
  const extra = parseList<{ id: string; text: string }>(head.questions_json);

  const state: RunState = {
    id: head.id,
    subject: head.subject,
    status: head.status,
    step: last?.step ?? null,
    mentions: sources.results.length,
    candidates: cands.results.map(({ profile_urls_json, reasons_json, ...c }) => ({
      ...c,
      profile_urls: parseList<string>(profile_urls_json),
      reasons: parseList<string>(reasons_json),
    })),
    claims: claims.results.map(({ supports_json, contradicts_json, ...c }) => ({
      ...c,
      supports: parseList<string>(supports_json),
      contradicts: parseList<string>(contradicts_json),
    })),
    sources: sources.results,
    questions: [...base, ...extra],
    brief: brief ? (JSON.parse(brief.brief_json) as Brief) : null,
    cost: runCost(ledger.results, head.created_at),
  };
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
