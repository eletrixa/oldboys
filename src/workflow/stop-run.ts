/**
 * Stop a run's Workflow instances before its data is deleted, so no running step writes rows again afterwards.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/stop-run.ts
 * Deps:    bindings RESEARCH_RUN and VERIFY_CALL (Cloudflare Workflows)
 * Tested:  src/workflow/__tests__/stop-run.test.ts
 *
 * Key responsibilities:
 * - stopInstance: terminate one instance unless it already finished, then drop its stored step state (best effort)
 * - stopRunWork: the research instance (id = run id, see start-run.ts) and every call instance (id = call id, see
 *   POST /api/calls/:id/approve)
 *
 * Design constraints:
 * - "Not found" (never created, or already cleaned up) is not an error; any other failure to stop an active instance
 *   throws, so the caller deletes nothing while work may still be running
 * - Deleting the instance state is best effort: its failure never blocks the data delete
 * - Never calls a phone provider; a live call is refused earlier by the route (callInProgress)
 */
type Instances = Pick<Workflow, "get">;

export type StopOutcome = "stopped" | "finished" | "missing";

/** Statuses after which an instance runs no more steps. */
const FINISHED: ReadonlySet<InstanceStatus["status"]> = new Set(["complete", "errored", "terminated"]);

export function isNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not[\s._-]?found/i.test(message);
}

async function terminate(instance: WorkflowInstance): Promise<StopOutcome> {
  if (FINISHED.has((await instance.status()).status)) return "finished";
  try {
    await instance.terminate();
    return "stopped";
  } catch (error) {
    // It may have finished between status() and terminate(); only an instance still active is a real failure.
    if (FINISHED.has((await instance.status()).status)) return "finished";
    throw error;
  }
}

export async function stopInstance(workflows: Instances, id: string): Promise<StopOutcome> {
  let outcome: StopOutcome;
  let instance: WorkflowInstance;
  try {
    instance = await workflows.get(id);
    outcome = await terminate(instance);
  } catch (error) {
    if (isNotFound(error)) return "missing";
    throw error;
  }
  try {
    // The stored step outputs hold excerpts; drop them with the run instead of waiting for the platform's own retention.
    await instance.delete();
  } catch {
    // Best effort: older runtimes lack delete(), and the D1/R2 delete must not depend on it.
  }
  return outcome;
}

export type RunWorkflows = { RESEARCH_RUN: Instances; VERIFY_CALL: Instances };

/** Stops the research run and the given call instances; resolves to how many were still active. */
export async function stopRunWork(env: RunWorkflows, runId: string, callIds: readonly string[]): Promise<number> {
  const outcomes = await Promise.all([stopInstance(env.RESEARCH_RUN, runId), ...callIds.map((id) => stopInstance(env.VERIFY_CALL, id))]);
  return outcomes.filter((o) => o === "stopped").length;
}
