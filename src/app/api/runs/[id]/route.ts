/**
 * GET /api/runs/:id: JSON status projection for polling clients (browser extension, list views).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, src/domain/run-status
 * Tested:  projection in src/domain/__tests__/run-status.test.ts; route n/a
 *
 * Key responsibilities:
 * - Three small D1 reads (head, claim counts, gaps; candidates only while paused) → RunStatus
 * - 404 when the run does not exist; never cached
 *
 * Design constraints:
 * - No runtime = "edge"; no ledger rows here (that is the SSE route's job)
 * - Bearer auth is deliberately not required: the id is an unguessable UUID (plans/004 risk register)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  type ClaimKindCount,
  type InvestigationHead,
  type LineupCandidate,
  toRunStatus,
} from "@/domain/run-status";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();

  const head = await env.DB.prepare(
    "SELECT id, subject, goal, status, created_at FROM investigations WHERE id = ?",
  )
    .bind(id)
    .first<InvestigationHead>();
  if (!head) return Response.json({ error: "run not found" }, { status: 404 });

  const [claimCounts, gapRow, candidateRows] = await Promise.all([
    env.DB.prepare("SELECT kind, COUNT(*) AS n FROM claims WHERE run_id = ? GROUP BY kind")
      .bind(id)
      .all<ClaimKindCount>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM gaps WHERE run_id = ?").bind(id).first<{ n: number }>(),
    head.status === "paused"
      ? env.DB.prepare(
          "SELECT id, name, anchor_match, score, decision FROM candidates WHERE run_id = ? ORDER BY score DESC",
        )
          .bind(id)
          .all<LineupCandidate>()
      : Promise.resolve(null),
  ]);

  const status = toRunStatus(head, claimCounts.results, gapRow?.n ?? 0, candidateRows?.results ?? []);
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
