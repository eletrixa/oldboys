/**
 * Tests for the run page position header helper (G10 of specs/positions-pages.md).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/position-header.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Label and link for a state with a position; null without one; id encoded
 *
 * Design constraints:
 * - Pure: no React
 */
import { describe, expect, it } from "vitest";
import { positionHeader } from "../position-header";

describe("positionHeader", () => {
  it("links the position title to /positions/<id>", () => {
    expect(positionHeader({ position: { id: "abc-1", title: "Senior Data Engineer" } })).toEqual({
      label: "Researched for: Senior Data Engineer",
      href: "/positions/abc-1",
    });
  });

  it("returns null for a run without a position", () => {
    expect(positionHeader({ position: null })).toBeNull();
  });

  it("encodes an id that is not path-safe", () => {
    expect(positionHeader({ position: { id: "a/b?c", title: "T" } })?.href).toBe("/positions/a%2Fb%3Fc");
  });
});
