/**
 * GET /api/runs/:id/audit: the GDPR audit record of a run as JSON (`?download=1` adds a file name).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/audit/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, ./load
 * Tested:  n/a (projection tested in src/domain/__tests__/audit.test.ts)
 *
 * Key responsibilities:
 * - 404 for an unknown or purged run, else the AuditRecord built by loadAuditRecord
 *
 * Design constraints:
 * - Same access rule as GET /api/runs/:id/state: no auth, the id is an unguessable UUID
 * - No runtime = "edge"; never cached
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadAuditRecord } from "./load";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const record = await loadAuditRecord(env.DB, id, new Date());
  if (!record) return Response.json({ error: "run not found" }, { status: 404 });

  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
  if (new URL(request.url).searchParams.get("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="audit-record-${id.slice(0, 8)}.json"`);
  }
  return new Response(JSON.stringify(record, null, 2), { headers });
}
