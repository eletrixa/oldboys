/**
 * StartupJobs application webhook: check the path token, fetch the CV PDF, hand one IntakeInput to the funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/startupjobs/handler.ts
 * Deps:    src/domain (startupjobs, application, error-text, timing-safe-equal), src/workflow/intake, binding DB, secrets
 *          STARTUPJOBS_WEBHOOK_TOKEN and STARTUPJOBS_TOKEN
 * Tested:  src/app/api/intake/__tests__/startupjobs.test.ts
 *
 * Key responsibilities:
 * - 503 when the webhook token is unset, 404 for a wrong token, 422 for a body that is not a StartupJobs payload
 * - Resolve the tag (offer id mapping, else internal position name); a test payload carries no tag and no download
 * - Download the first `.pdf` of `files[]` (https, at most CV_MAX_BYTES = 10 MiB); on *.startupjobs.cz the first request
 *   already carries `Authorization: Bearer STARTUPJOBS_TOKEN` when that secret is set (no 401/403 retry)
 * - The tag lookup and the download run in parallel
 * - Answer 200 for every handled delivery (duplicates included) and 202 after an unexpected throw
 *
 * Design constraints:
 * - Never answer 5xx for a delivery: StartupJobs deletes the webhook on any code except 200/201/202/204/422
 *   (the 503 above is only reachable while no valid webhook URL can exist)
 * - A failed file download never fails the webhook; it becomes a note on the application
 * - Takes bindings, clock and fetch as parameters so tests run under plain Node; no Next.js imports
 * - The company API is not called; STARTUPJOBS_TOKEN is only ever sent to startupjobs.cz hosts
 */
import { CV_MAX_BYTES, joinNotes, toCvFile, type CvFile } from "@/domain/application";
import { errorText } from "@/domain/error-text";
import { StartupJobsWebhook, tagFor, toIntakeInput } from "@/domain/startupjobs";
import { timingSafeEqual } from "@/domain/timing-safe-equal";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";

export type StartupJobsEnv = IntakeEnv & { STARTUPJOBS_WEBHOOK_TOKEN?: string; STARTUPJOBS_TOKEN?: string };

const FETCH_TIMEOUT_MS = 15_000;

export async function handleStartupJobsWebhook(
  request: Request,
  token: string,
  env: StartupJobsEnv,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const secret = env.STARTUPJOBS_WEBHOOK_TOKEN;
  if (secret === undefined || secret === "") return Response.json({ error: "StartupJobs webhook is not configured" }, { status: 503 });
  // 404, not 401: a wrong token must not confirm that the route exists.
  if (!timingSafeEqual(token, secret)) return Response.json({ error: "not found" }, { status: 404 });

  const parsed = StartupJobsWebhook.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid StartupJobs payload" }, { status: 422 });
  const payload = parsed.data;

  try {
    if (payload.test === true) {
      await ingestApplication(toIntakeInput(payload, undefined), env, now);
      return Response.json({ received: true, test: true });
    }

    const [row, { cv, note: cvNote }] = await Promise.all([
      env.DB.prepare("SELECT tag FROM intake_tags WHERE startupjobs_offer_id = ?").bind(String(payload.offerID)).first<{ tag: string }>(),
      downloadCv(payload.files, env.STARTUPJOBS_TOKEN, fetchImpl),
    ]);
    const input = toIntakeInput(payload, tagFor(payload, row?.tag), cv);
    input.note = joinNotes(input.note, cvNote) ?? undefined;

    await ingestApplication(input, env, now);
    return Response.json({ received: true });
  } catch (err) {
    console.error("startupjobs webhook failed:", errorText(err));
    return Response.json({ received: false }, { status: 202 });
  }
}

type CvDownload = { cv?: CvFile; note: string | null };

/** First `.pdf` entry of `files`. Any failure is returned as a note, never thrown. */
async function downloadCv(files: string[], bearer: string | undefined, fetchImpl: typeof fetch): Promise<CvDownload> {
  const url = files.map(parseUrl).find((u): u is URL => u?.pathname.toLowerCase().endsWith(".pdf") === true);
  if (url === undefined) {
    return { note: files.length > 0 ? `no PDF among ${String(files.length)} file${files.length === 1 ? "" : "s"}` : null };
  }
  const failed = (why: string): CvDownload => ({ note: `cv download failed ${why}` });
  if (url.protocol !== "https:") return failed("(not https)");

  try {
    const useBearer = bearer !== undefined && bearer !== "" && isStartupJobsHost(url.hostname);
    const res = await fetchImpl(url.href, {
      ...(useBearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return failed(String(res.status));
    if (Number(res.headers.get("content-length") ?? 0) > CV_MAX_BYTES) return failed("(file over 10 MiB)");
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > CV_MAX_BYTES) return failed("(file over 10 MiB)");
    return { cv: toCvFile({ bytes, filename: filenameOf(url), contentType: res.headers.get("content-type") }), note: null };
  } catch (err) {
    return failed(`(${err instanceof Error ? err.name : "network error"})`);
  }
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isStartupJobsHost(hostname: string): boolean {
  return hostname === "startupjobs.cz" || hostname.endsWith(".startupjobs.cz");
}

function filenameOf(url: URL): string {
  const last = url.pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || "cv.pdf";
  } catch {
    return last || "cv.pdf";
  }
}
