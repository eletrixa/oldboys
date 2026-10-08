/**
 * POST /api/intake/startupjobs/<token>: StartupJobs per-offer application webhook entry point.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/startupjobs/[token]/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext)
 * Tested:  src/app/api/intake/__tests__/startupjobs.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Pass the request, the path token and Cloudflare bindings to handleStartupJobsWebhook
 *
 * Design constraints:
 * - No runtime = "edge"; all logic lives in ../handler.ts
 * - The secret is the path segment (StartupJobs sends no signature); never log the URL
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleStartupJobsWebhook } from "../handler";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const { env } = getCloudflareContext();
  return handleStartupJobsWebhook(request, token, env, new Date());
}
