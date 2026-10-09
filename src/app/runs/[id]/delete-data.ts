/**
 * Client side of "Delete candidate data": the POST to /api/runs/:id/delete and its answer in plain words.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/delete-data.ts
 * Deps:    src/domain/deletion (DeleteReason, DeletionReceipt)
 * Tested:  src/app/runs/[id]/__tests__/delete-data.test.ts
 *
 * Key responsibilities:
 * - deleteOutcome: HTTP status + error body → deleted (receipt) / unauthorized (show the login link) / error message
 * - requestDelete: send the reason with the session cookie; a network failure becomes an error that says retrying is safe
 *
 * Design constraints:
 * - Messages are plain English for HR and never judge the candidate
 * - A second delete answers 404, so retrying after an unclear failure is always safe
 */
import type { DeleteReason, DeletionReceipt } from "@/domain/deletion";

export type DeleteOutcome = { kind: "deleted"; receipt: DeletionReceipt } | { kind: "unauthorized" } | { kind: "error"; message: string };

const ERROR_TEXT: Record<number, string> = {
  400: "Choose a reason first, then try again.",
  404: "This candidate's data is already deleted, or the run does not exist.",
  409: "A phone call with the candidate is in progress. Try again when it ends.",
  502: "The research could not be stopped, so nothing was deleted. Try again in a minute.",
};

export const NETWORK_ERROR = "We could not reach the server. Check your connection and try again; trying again is safe.";

export function deleteOutcome(status: number, body: unknown): DeleteOutcome {
  if (status === 200) return { kind: "deleted", receipt: body as DeletionReceipt };
  if (status === 401) return { kind: "unauthorized" };
  if (status === 403) {
    const browserOnly = typeof body === "object" && body !== null && (body as { error?: unknown }).error === "browser only";
    return {
      kind: "error",
      message: browserOnly ? "Reload this page and try again." : "This run belongs to another team, so you cannot delete it.",
    };
  }
  return { kind: "error", message: ERROR_TEXT[status] ?? `We could not delete the data (HTTP ${String(status)}). Try again.` };
}

export async function requestDelete(runId: string, reason: DeleteReason): Promise<DeleteOutcome> {
  try {
    const res = await fetch(`/api/runs/${runId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body: unknown = await res.json().catch(() => null);
    return deleteOutcome(res.status, body);
  } catch {
    return { kind: "error", message: NETWORK_ERROR };
  }
}
