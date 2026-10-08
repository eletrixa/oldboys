/**
 * D1 loader for the GDPR Art. 15 data access export of one run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/access-export/load.ts
 * Deps:    D1Database, zod, src/domain/access-export, src/domain/claim, src/recipe/goals, src/workflow/calls (CALL_SOURCE_ACTOR)
 * Tested:  n/a (I/O only; the projection is tested in src/domain/__tests__/access-export.test.ts)
 *
 * Key responsibilities:
 * - Read the investigation head (LEFT JOIN organizations for the controller name), sources, candidates, claims
 *   (rank order) and the stored brief, and project them with accessExport
 * - Question text = recipeFor(goal).questions + investigations.questions_json (parsed with Zod)
 *
 * Design constraints:
 * - Explicit column lists only: never ledger rows, gaps, calls, accounts or sessions
 */
import { z } from "zod";
import {
  type AccessExport,
  type AccessExportCandidateRow,
  type AccessExportClaimRow,
  type AccessExportRun,
  type AccessExportSourceRow,
  accessExport,
} from "@/domain/access-export";
import { GoalId } from "@/domain/claim";
import { recipeFor } from "@/recipe/goals";
import { CALL_SOURCE_ACTOR } from "@/workflow/calls";

const ExtraQuestions = z.array(z.object({ id: z.string(), text: z.string() }));

function extraQuestions(json: string | null): { id: string; text: string }[] {
  if (json === null || json === "") return [];
  try {
    const parsed = ExtraQuestions.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** null when the run does not exist (or was already purged). */
export async function loadAccessExport(db: D1Database, id: string, now: Date): Promise<AccessExport | null> {
  const run = await db
    .prepare("SELECT i.id, i.subject, i.anchor, i.goal, i.role, i.created_at, i.questions_json, o.name AS organization_name FROM investigations i LEFT JOIN organizations o ON o.id = i.organization_id WHERE i.id = ?")
    .bind(id)
    .first<AccessExportRun & { questions_json: string | null }>();
  if (!run) return null;

  const [sources, candidates, claims, brief] = await Promise.all([
    db.prepare("SELECT id, url, actor, fetched_at, excerpt, identity FROM sources WHERE run_id = ?").bind(id).all<AccessExportSourceRow>(),
    db.prepare("SELECT id, platform, profile_urls_json, snippet, decision FROM candidates WHERE run_id = ? ORDER BY score DESC").bind(id).all<AccessExportCandidateRow>(),
    db.prepare("SELECT id, candidate_id, kind, text, quote, confidence, supports_json FROM claims WHERE run_id = ? ORDER BY rank").bind(id).all<AccessExportClaimRow>(),
    db.prepare("SELECT brief_json FROM briefs WHERE run_id = ?").bind(id).first<{ brief_json: string }>(),
  ]);

  const goal = GoalId.safeParse(run.goal);
  const base = goal.success ? recipeFor(goal.data).questions : [];
  const { questions_json, ...head } = run;
  return accessExport(
    {
      run: head,
      questions: [...base, ...extraQuestions(questions_json)],
      sources: sources.results,
      candidates: candidates.results,
      claims: claims.results,
      brief_json: brief?.brief_json ?? null,
      call_actors: Object.values(CALL_SOURCE_ACTOR),
    },
    now.toISOString(),
  );
}
