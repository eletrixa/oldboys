/**
 * Tests for the login `next` sanitiser.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/login/__tests__/next-path.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Keep same-site paths with query, reject everything that could leave the site
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { loginHref, safeNext } from "../next-path";

describe("safeNext", () => {
  it("keeps a same-site path and its query", () => {
    expect(safeNext("/?positionId=abc")).toBe("/?positionId=abc");
    expect(safeNext("/positions/new")).toBe("/positions/new");
  });
  it("falls back to / for anything off site or malformed", () => {
    for (const bad of [null, undefined, "", "positions", "//evil.test", "https://evil.test/", "/\\evil.test", "/a\\b", `/${"a".repeat(600)}`]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});

describe("loginHref", () => {
  it("encodes next and omits it for home", () => {
    expect(loginHref("/?positionId=a b")).toBe("/login?next=%2F%3FpositionId%3Da%2520b");
    expect(loginHref("/")).toBe("/login");
    expect(loginHref("//evil.test")).toBe("/login");
  });
});
