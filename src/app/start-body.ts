/**
 * Pure builders for the start form: the POST /api/start body and the `?positionId=` reading.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/start-body.ts
 * Deps:    none
 * Tested:  src/app/__tests__/start-body.test.ts
 *
 * Key responsibilities:
 * - buildStartBody: {goal: "hiring", profileUrl?, cvText?} plus either {positionId} (no role) or {role}
 * - positionIdParam: the trimmed `positionId` query value, or null when absent or blank
 *
 * Design constraints:
 * - Pure; the server stays the validator (run-body.ts), this only shapes the request
 */
export type StartInput = { role: string; profileUrl: string; cvText: string; positionId: string | null };

export function buildStartBody({ role, profileUrl, cvText, positionId }: StartInput): Record<string, string> {
  return {
    goal: "hiring",
    ...(positionId === null ? { role } : { positionId }),
    ...(profileUrl === "" ? {} : { profileUrl }),
    ...(cvText === "" ? {} : { cvText }),
  };
}

export function positionIdParam(params: { get(name: string): string | null }): string | null {
  const raw = params.get("positionId")?.trim() ?? "";
  return raw === "" ? null : raw;
}
