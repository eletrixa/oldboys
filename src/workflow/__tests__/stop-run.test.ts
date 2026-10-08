/**
 * Tests for stopping a run's Workflow instances before its data is deleted.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/stop-run.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Active instances are terminated and their state deleted; finished ones are only deleted; missing ones are ignored
 * - A terminate that fails while the instance is still active throws; one that lost a race with completion does not
 * - stopRunWork addresses the research instance by run id and call instances by call id
 *
 * Design constraints:
 * - Hand-written Workflow fake; no module mocks
 */
import { describe, expect, it } from "vitest";
import { isNotFound, stopInstance, stopRunWork } from "../stop-run";

type Status = InstanceStatus["status"];
type FakeInstance = { status: Status; terminateError?: Error; finishOnTerminateError?: boolean; deleteError?: Error };

function makeWorkflows(instances: Record<string, FakeInstance>, getError?: Error) {
  const log: string[] = [];
  const workflows = {
    get: (id: string) => {
      log.push(`get ${id}`);
      const fake = instances[id];
      if (getError) return Promise.reject(getError);
      if (!fake) return Promise.reject(new Error("instance.not_found"));
      return Promise.resolve({
        status: () => Promise.resolve({ status: fake.status }),
        terminate: () => {
          log.push(`terminate ${id}`);
          if (fake.terminateError) {
            if (fake.finishOnTerminateError === true) fake.status = "complete";
            return Promise.reject(fake.terminateError);
          }
          fake.status = "terminated";
          return Promise.resolve();
        },
        delete: () => {
          log.push(`delete ${id}`);
          return fake.deleteError ? Promise.reject(fake.deleteError) : Promise.resolve();
        },
      } as unknown as WorkflowInstance);
    },
  };
  return { workflows, log, instances };
}

describe("stopInstance", () => {
  it.each<Status>(["queued", "running", "paused", "waiting", "waitingForPause"])("terminates an instance that is %s and deletes its state", async (status) => {
    const env = makeWorkflows({ r1: { status } });
    expect(await stopInstance(env.workflows, "r1")).toBe("stopped");
    expect(env.log).toEqual(["get r1", "terminate r1", "delete r1"]);
    expect(env.instances.r1?.status).toBe("terminated");
  });

  it.each<Status>(["complete", "errored", "terminated"])("does not terminate an instance that is %s, only deletes its state", async (status) => {
    const env = makeWorkflows({ r1: { status } });
    expect(await stopInstance(env.workflows, "r1")).toBe("finished");
    expect(env.log).toEqual(["get r1", "delete r1"]);
  });

  it("ignores an instance that does not exist", async () => {
    const env = makeWorkflows({});
    expect(await stopInstance(env.workflows, "gone")).toBe("missing");
  });

  it("throws when the instance lookup fails for another reason", async () => {
    const env = makeWorkflows({}, new Error("internal error"));
    await expect(stopInstance(env.workflows, "r1")).rejects.toThrow("internal error");
  });

  it("throws when terminate fails and the instance is still active", async () => {
    const env = makeWorkflows({ r1: { status: "running", terminateError: new Error("try later") } });
    await expect(stopInstance(env.workflows, "r1")).rejects.toThrow("try later");
  });

  it("treats a terminate that lost the race with completion as finished", async () => {
    const env = makeWorkflows({ r1: { status: "running", terminateError: new Error("already complete"), finishOnTerminateError: true } });
    expect(await stopInstance(env.workflows, "r1")).toBe("finished");
  });

  it("does not fail when deleting the instance state fails", async () => {
    const env = makeWorkflows({ r1: { status: "running", deleteError: new Error("not supported") } });
    expect(await stopInstance(env.workflows, "r1")).toBe("stopped");
  });
});

describe("stopRunWork", () => {
  it("stops the research instance by run id and each call instance by call id, counting the active ones", async () => {
    const research = makeWorkflows({ "run-1": { status: "paused" } });
    const calls = makeWorkflows({ "call-1": { status: "waiting" }, "call-2": { status: "complete" } });

    const stopped = await stopRunWork({ RESEARCH_RUN: research.workflows, VERIFY_CALL: calls.workflows }, "run-1", ["call-1", "call-2", "call-3"]);

    expect(stopped).toBe(2);
    expect(research.log).toEqual(["get run-1", "terminate run-1", "delete run-1"]);
    expect(calls.log.filter((l) => l.startsWith("terminate"))).toEqual(["terminate call-1"]);
  });
});

describe("isNotFound", () => {
  it("matches the not-found spellings and nothing else", () => {
    expect(isNotFound(new Error("instance.not_found"))).toBe(true);
    expect(isNotFound(new Error("Instance not found"))).toBe(true);
    expect(isNotFound("NotFound")).toBe(true);
    expect(isNotFound(new Error("internal error"))).toBe(false);
  });
});
