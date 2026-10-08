/**
 * Shared JSON body parsing for route handlers: one place for the 400 responses.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/body.ts
 * Deps:    zod
 * Tested:  n/a (exercised by the route handlers)
 *
 * Key responsibilities:
 * - Read the body, parse JSON, validate with the given schema; return the data or a ready 400 Response
 *
 * Design constraints:
 * - `emptyOk` treats a blank body as `{}` for routes whose fields are all optional
 */
import type { z } from "zod";

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options: { emptyOk?: boolean } = {},
): Promise<{ data: T; error: null } | { data: null; error: Response }> {
  const text = await request.text();
  let raw: unknown = {};
  if (text.trim().length > 0 || options.emptyOk !== true) {
    try {
      raw = JSON.parse(text);
    } catch {
      return { data: null, error: Response.json({ error: "body must be JSON" }, { status: 400 }) };
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      data: null,
      error: Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 }),
    };
  }
  return { data: parsed.data, error: null };
}
