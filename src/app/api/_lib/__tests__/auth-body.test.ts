/**
 * Tests for RegisterBody and LoginBody.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/auth-body.test.ts
 * Deps:    vitest
 * Tested:  src/app/api/_lib/__tests__/auth-body.test.ts
 *
 * Key responsibilities:
 * - Email normalisation, password bounds, nested organization issues
 *
 * Design constraints:
 * - Pure schema tests, no mocks
 */
import { describe, expect, it } from "vitest";
import { LoginBody, RegisterBody } from "../auth-body";

const org = { name: "Acme s.r.o.", ico: "27074358", source: "ares" };
const valid = { email: "  Jane@Example.COM ", password: "longenough", name: "Jane", organization: org };

describe("RegisterBody", () => {
  it("lower-cases and trims the email", () => {
    const r = RegisterBody.safeParse({ ...valid, email: "Jane@Example.COM" });
    expect(r.success && r.data.email).toBe("jane@example.com");
  });
  it("rejects a password under 8 characters", () => {
    expect(RegisterBody.safeParse({ ...valid, email: "a@b.cz", password: "short" }).success).toBe(false);
  });
  it("reports a bad ico under organization.ico", () => {
    const r = RegisterBody.safeParse({ ...valid, email: "a@b.cz", organization: { ...org, ico: "12345678" } });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "organization" && i.path[1] === "ico")).toBe(true);
    }
  });
});

describe("LoginBody", () => {
  it("accepts a one-character password", () => {
    expect(LoginBody.safeParse({ email: "a@b.cz", password: "x" }).success).toBe(true);
  });
  it("rejects an empty password", () => {
    expect(LoginBody.safeParse({ email: "a@b.cz", password: "" }).success).toBe(false);
  });
});
