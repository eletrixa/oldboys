/**
 * Tests for the run page's delete answer mapping (deleteOutcome).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/delete-data.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - 200 → receipt, 401 → login link, 403 (browser only vs other team), 404 already deleted, 409 call, 502, unknown status
 *
 * Design constraints:
 * - Pure mapping only; the fetch itself is not exercised
 */
import { describe, expect, it } from "vitest";
import type { DeletionReceipt } from "@/domain/deletion";
import { deleteOutcome } from "../delete-data";

const RECEIPT = { run_id: "r1", deleted_at: "2026-10-09T01:45:00.000Z", reason: "other", counts: {} } as unknown as DeletionReceipt;
const message = (status: number, body: unknown = { error: "x" }): string => {
  const o = deleteOutcome(status, body);
  return o.kind === "error" ? o.message : o.kind;
};

describe("deleteOutcome", () => {
  it("returns the receipt on 200 and asks for a login on 401", () => {
    expect(deleteOutcome(200, RECEIPT)).toEqual({ kind: "deleted", receipt: RECEIPT });
    expect(deleteOutcome(401, { error: "login required" })).toEqual({ kind: "unauthorized" });
  });

  it("tells a cross-site 403 from another team's run", () => {
    expect(message(403, { error: "browser only" })).toBe("Reload this page and try again.");
    expect(message(403, { error: "this run belongs to another organization" })).toBe("This run belongs to another team, so you cannot delete it.");
    expect(message(403, null)).toBe("This run belongs to another team, so you cannot delete it.");
  });

  it("explains 404, 409 and 502 in plain words", () => {
    expect(message(404)).toContain("already deleted");
    expect(message(409)).toBe("A phone call with the candidate is in progress. Try again when it ends.");
    expect(message(502)).toContain("nothing was deleted");
    expect(message(500)).toBe("We could not delete the data (HTTP 500). Try again.");
  });
});
