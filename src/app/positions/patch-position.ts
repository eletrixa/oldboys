/**
 * Client call: PATCH /api/positions/:id with the stored token.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/patch-position.ts
 * Deps:    src/app/_components/token, src/domain/position
 * Tested:  n/a (covered by e2e/positions.spec.ts)
 *
 * Key responsibilities:
 * - Send a partial update, return the updated Position or a short error text
 *
 * Design constraints:
 * - Client only; the server validates (1..5 must-haves, known family), the message is shown as given
 */
import { authFetch, readToken } from "@/app/_components/token";
import type { Position } from "@/domain/position";

export type PatchBody = Partial<Pick<Position, "title" | "family" | "must_haves">>;
export type PatchResult = { ok: true; position: Position } | { ok: false; message: string };

export async function patchPosition(id: string, body: PatchBody): Promise<PatchResult> {
  try {
    const res = await authFetch(`/api/positions/${encodeURIComponent(id)}`, readToken(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, message: "The token no longer works. Reload the page to enter it again." };
    if (!res.ok) return { ok: false, message: "We could not save the change. Check the fields and try again." };
    const { position } = await res.json<{ position: Position }>();
    return { ok: true, position };
  } catch {
    return { ok: false, message: "We could not reach the service. Please try again." };
  }
}
