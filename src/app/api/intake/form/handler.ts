/**
 * Google Forms intake logic: bearer check, body validation, one call into the intake funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/form/handler.ts
 * Deps:    src/app/api/_lib (auth, body, intake-body), src/workflow/intake (ingestApplication)
 * Tested:  src/app/api/intake/__tests__/form.test.ts
 *
 * Key responsibilities:
 * - 503 when INTAKE_TOKEN is unset, 401 on a wrong bearer, 400 on a body that fails IntakeFormBody
 * - Map the body to an IntakeInput with source "form"; 201 for a new application, 200 with duplicate: true for a repeat
 * - A funnel failure answers 500 {error} so the Apps Script throws and the response can be re-sent
 *
 * Design constraints:
 * - Never returns runId: the token holder owns the form, not the research (runs are visible on /intake)
 * - Takes bindings and the clock as parameters so tests run under plain Node; no Next.js imports
 */
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import { IntakeFormBody } from "@/app/api/_lib/intake-body";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";

export type FormIntakeEnv = IntakeEnv & { INTAKE_TOKEN?: string };

export async function handleFormIntake(request: Request, env: FormIntakeEnv, now: Date): Promise<Response> {
  const denied = requireBearer(request, env.INTAKE_TOKEN, "INTAKE_TOKEN");
  if (denied) return denied;

  const parsed = await parseJsonBody(request, IntakeFormBody);
  if (parsed.error) return parsed.error;

  try {
    const { applicationId, status, duplicate } = await ingestApplication({ source: "form", ...parsed.data }, env, now);
    return duplicate
      ? Response.json({ applicationId, status, duplicate: true })
      : Response.json({ applicationId, status }, { status: 201 });
  } catch (err) {
    console.error("form intake failed", err);
    return Response.json({ error: "intake failed" }, { status: 500 });
  }
}
