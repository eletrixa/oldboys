/**
 * POST /api/positions/:id/candidates/file: add one person to the position's pool from a CV file (PDF or text, multipart field `cv`).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/[id]/candidates/file/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ../../../routes, bindings DB + SOURCES + RESEARCH_RUN, secret RUN_TOKEN
 * Tested:  src/app/api/positions/__tests__/pool-routes.test.ts (via routes.ts)
 *
 * Key responsibilities:
 * - Pass the request, bindings and the path id to the tested route function
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { addCandidateFileRoute } from "../../../routes";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return addCandidateFileRoute(request, getCloudflareContext().env, (await params).id);
}
