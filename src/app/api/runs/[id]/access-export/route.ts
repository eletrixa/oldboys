/**
 * GET /api/runs/:id/access-export: the GDPR Art. 15 data access export of a run as a JSON download.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/access-export/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, ./load
 * Tested:  n/a (projection tested in src/domain/__tests__/access-export.test.ts)
 *
 * Key responsibilities:
 * - 404 for an unknown or purged run, else the AccessExport built by loadAccessExport as attachment
 *   access-export-<id8>.json
 *
 * Design constraints:
 * - Same access rule as GET /api/runs/:id/audit and /state: no auth, the id is an unguessable UUID
 * - No runtime = "edge"; never cached
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadAccessExport } from "./load";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const data = await loadAccessExport(env.DB, id, new Date());
  if (!data) return Response.json({ error: "run not found" }, { status: 404 });

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="access-export-${id.slice(0, 8)}.json"`,
    },
  });
}
