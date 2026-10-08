/**
 * Tests for requireBearer: 503 names the configured secret, 401 on a wrong or missing bearer.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/auth.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Default secret name RUN_TOKEN stays unchanged; a custom name appears in the 503 message
 *
 * Design constraints:
 * - Pure; no bindings
 */
import { describe, expect, it } from "vitest";
import { requireBearer } from "../auth";

const req = (authorization?: string) =>
  new Request("https://x.test/api/x", { method: "POST", headers: authorization === undefined ? {} : { Authorization: authorization } });

describe("requireBearer", () => {
  it("returns null for the right bearer", () => {
    expect(requireBearer(req("Bearer s3cret"), "s3cret")).toBeNull();
  });

  it("503 names RUN_TOKEN by default", async () => {
    const res = requireBearer(req("Bearer x"), undefined);
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "RUN_TOKEN secret is not configured" });
  });

  it("503 names the given secret, also for an empty value", async () => {
    const res = requireBearer(req("Bearer x"), "", "INTAKE_TOKEN");
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "INTAKE_TOKEN secret is not configured" });
  });

  it("401 for a wrong, malformed or missing bearer", () => {
    for (const header of ["Bearer nope", "s3cret", "Bearer ", undefined]) {
      expect(requireBearer(req(header), "s3cret")?.status).toBe(401);
    }
  });
});
