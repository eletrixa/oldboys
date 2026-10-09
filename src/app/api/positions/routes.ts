/**
 * Session-or-bearer guarded route functions of /api/positions: ingest, list, read and edit.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/routes.ts
 * Deps:    src/app/api/_lib/{session-or-bearer,session,body,position-body,candidate-body}, src/domain/{application,digest,position,stable-id}, ./handler, src/workflow/{ingest-position,intake,enrich}, src/adapters/llm
 * Tested:  src/app/api/positions/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - `createPositionRoute`, `listPositionsRoute`, `getPositionRoute`, `patchPositionRoute`: session or bearer first, then body, then the tested function
 * - `addCandidateRoute`: add one person to the position's pool through the intake funnel (source manual, status pooled, never a run)
 * - `addCandidateFileRoute`: the same for a CV file (multipart); the funnel extracts the text, the id is stable per file content
 * - `enrichRoute`: start one research run per selected pooled candidate; a session origin counts against its organization
 *
 * Design constraints:
 * - A session reaches only its organization's positions (other ids answer 404, NULL-owner rows included) and new positions
 *   store its organization; the bearer (API, extension, scripts) reaches all of them and creates NULL-owner rows, as before
 * - Takes bindings as parameters so tests run under plain Node; no Next.js imports
 * - Every response, errors included, carries `Cache-Control: no-store`, applied once by `guarded`
 */
import { makeLlmCall } from "@/adapters/llm";
import { parseJsonBody } from "@/app/api/_lib/body";
import { CandidateBody, EnrichBody, manualIntake } from "@/app/api/_lib/candidate-body";
import { CreatePositionBody, PatchPositionBody } from "@/app/api/_lib/position-body";
import { sessionFromRequest } from "@/app/api/_lib/session";
import { requireSessionOrBearer } from "@/app/api/_lib/session-or-bearer";
import { startEnrichment, type EnrichOrigin } from "@/workflow/enrich";
import { estimatePositionUsd, ingestCapUsd, ingestPosition, type IngestDeps } from "@/workflow/ingest-position";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";
import { CvFile, NAME_MAX, toCvFile } from "@/domain/application";
import { sha256Hex } from "@/domain/digest";
import { POSITION_ID } from "@/domain/position";
import { stableId } from "@/domain/stable-id";
import { getPosition, listPositions, patchPosition, positionInScope, type PositionScope } from "./handler";

export type PositionsEnv = IntakeEnv & {
  RUN_TOKEN?: string;
  POSITION_INGEST_USD?: string;
  ANTHROPIC_API_KEY?: string;
  LLM_MODEL_PRIMARY?: string;
  LLM_MODEL_VERIFY?: string;
};

const json = (body: unknown, status = 200): Response => Response.json(body, { status });
const notFound = (): Response => json({ error: "position not found" }, 404);

/**
 * Session cookie or bearer check, then the handler with the caller's scope; whatever it returns is marked no-store.
 * A valid session wins over a bearer header (as in enrich), so its organization is the scope; the bearer alone gets null.
 */
async function guarded(request: Request, env: PositionsEnv, handle: (scope: PositionScope) => Promise<Response>): Promise<Response> {
  const denied = await requireSessionOrBearer(request, env);
  const res = denied ?? (await handle((await sessionFromRequest(request, env.DB))?.organizationId ?? null));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Bearer: a well-formed id (the funnel answers unknown ones); session: a position of its own organization. */
const reachable = async (db: D1Database, positionId: string, scope: PositionScope): Promise<boolean> =>
  scope === null ? POSITION_ID.safeParse(positionId).success : positionInScope(db, positionId, scope);

export function createPositionRoute(request: Request, env: PositionsEnv, over: Partial<IngestDeps> = {}): Promise<Response> {
  return guarded(request, env, async (scope) => {
    const parsed = await parseJsonBody(request, CreatePositionBody);
    if (parsed.error) return parsed.error;
    const llm = makeLlmCall(env.ANTHROPIC_API_KEY ?? "", {
      primary: env.LLM_MODEL_PRIMARY ?? "claude-opus-5-5",
      verify: env.LLM_MODEL_VERIFY ?? "claude-sonnet-5-5",
    });
    const result = await ingestPosition(
      {
        db: env.DB,
        bucket: env.SOURCES,
        ports: { llm },
        fetchFn: fetch,
        now: new Date(),
        newId: () => crypto.randomUUID(),
        capUsd: ingestCapUsd(env.POSITION_INGEST_USD),
        estimateUsd: estimatePositionUsd,
        organizationId: scope,
        ...over,
      },
      parsed.data,
    );
    if (!result.ok) return json({ error: result.error }, result.status);
    return result.reused ? json({ id: result.id, reused: true }) : json({ id: result.id, notes: result.notes }, 201);
  });
}

export function listPositionsRoute(request: Request, env: PositionsEnv): Promise<Response> {
  return guarded(request, env, async (scope) => json({ positions: await listPositions(env.DB, scope) }));
}

export function getPositionRoute(request: Request, env: PositionsEnv, id: string): Promise<Response> {
  return guarded(request, env, async (scope) => {
    const detail = await getPosition(env.DB, id, scope);
    return detail ? json(detail) : notFound();
  });
}

export function patchPositionRoute(request: Request, env: PositionsEnv, id: string): Promise<Response> {
  return guarded(request, env, async (scope) => {
    const parsed = await parseJsonBody(request, PatchPositionBody);
    if (parsed.error) return parsed.error;
    const position = await patchPosition(env.DB, id, parsed.data, scope);
    return position ? json({ position }) : notFound();
  });
}

export function addCandidateRoute(request: Request, env: PositionsEnv, positionId: string): Promise<Response> {
  return guarded(request, env, async (scope) => {
    if (!(await reachable(env.DB, positionId, scope))) return notFound();
    const parsed = await parseJsonBody(request, CandidateBody);
    if (parsed.error) return parsed.error;
    const result = await ingestApplication(manualIntake(positionId, parsed.data), env, new Date());
    if (result.status === "unmatched") return notFound();
    return json(result, result.duplicate ? 200 : 201);
  });
}

/** Multipart `cv` (PDF or text, at most CV_MAX_BYTES) and optional `name`: the funnel extracts the text and stores the file. */
export function addCandidateFileRoute(request: Request, env: PositionsEnv, positionId: string): Promise<Response> {
  return guarded(request, env, async (scope) => {
    if (!(await reachable(env.DB, positionId, scope))) return notFound();
    const form = await request.formData().catch(() => null);
    const file = form?.get("cv");
    if (!(file instanceof File) || file.size === 0) return json({ error: "a CV file is required" }, 400);
    const cv = CvFile.safeParse(toCvFile({ bytes: await file.arrayBuffer(), filename: file.name, contentType: file.type }));
    if (!cv.success) return json({ error: "CV file over 10 MB" }, 400);
    const name = form?.get("name");
    const result = await ingestApplication(
      {
        source: "manual",
        externalId: stableId(positionId, await sha256Hex(cv.data.bytes)),
        positionId,
        ...(typeof name === "string" && name.trim() !== "" && { name: name.trim().slice(0, NAME_MAX) }),
        cv: cv.data,
      },
      env,
      new Date(),
    );
    if (result.status === "unmatched") return notFound();
    return json(result, result.duplicate ? 200 : 201);
  });
}

export function enrichRoute(request: Request, env: PositionsEnv, positionId: string): Promise<Response> {
  return guarded(request, env, async () => {
    const parsed = await parseJsonBody(request, EnrichBody);
    if (parsed.error) return parsed.error;
    // guarded() already accepted a session or a bearer; a valid session wins, so its organization pays the cap.
    const user = await sessionFromRequest(request, env.DB);
    const origin: EnrichOrigin = user === null ? { via: "api" } : { via: "start", accountId: user.accountId, organizationId: user.organizationId };
    const result = await startEnrichment(env, { positionId, applicationIds: parsed.data.applicationIds, origin }, new Date());
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ started: result.started, skipped: result.skipped });
  });
}
