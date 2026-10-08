/**
 * Tests for the pure helpers behind the positions pages.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/position-links.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - G1 groupByFamily, G2 filterPositions, G13 must-have editor
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  addMustHave,
  filterPositions,
  groupByFamily,
  indexPositions,
  ingestLabel,
  removeMustHave,
} from "@/domain/position-links";
import type { MustHave } from "@/domain/position";

function item(id: string, family: string, created_at: string, title = "T", company: string | null = null) {
  return { id, family, created_at, title, company } as Parameters<typeof groupByFamily>[0][number];
}

describe("groupByFamily", () => {
  it("orders by FAMILIES, other last, skips empty, newest first inside", () => {
    const groups = groupByFamily([
      item("a", "other", "2026-01-01"),
      item("b", "data", "2026-01-01"),
      item("c", "engineering", "2026-01-02"),
      item("d", "engineering", "2026-01-03"),
    ]);
    expect(groups.map((g) => g.family)).toEqual(["engineering", "data", "other"]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["d", "c"]);
  });
});

describe("filterPositions", () => {
  const all = [item("1", "data", "x", "Senior Data Engineer", "Acme"), item("2", "sales", "x", "AE", "Škoda")];
  const indexed = indexPositions(all);
  it("matches title and company, ignoring case and diacritics", () => {
    expect(filterPositions(indexed, "data").map((i) => i.id)).toEqual(["1"]);
    expect(filterPositions(indexed, "skoda").map((i) => i.id)).toEqual(["2"]);
  });
  it("returns all for empty or whitespace", () => {
    expect(filterPositions(indexed, "")).toHaveLength(2);
    expect(filterPositions(indexed, "   ")).toHaveLength(2);
  });
});

describe("must-have editor", () => {
  const mh = (id: string): MustHave => ({ id, text: id, accepted_evidence: [] });
  it("adds with an mh- slug id, unique, capped at 5", () => {
    let list = addMustHave([], "Team lead", "Has led a team");
    expect(list[0]?.id).toBe("mh-team-lead");
    list = addMustHave(list, "Team lead", "again");
    expect(list[1]?.id).toBe("mh-team-lead-2");
    const five = ["a", "b", "c", "d", "e"].map((x) => mh(`mh-${x}`));
    expect(addMustHave(five, "x", "y")).toHaveLength(5);
  });
  it("removes down to one item", () => {
    expect(removeMustHave([mh("mh-a"), mh("mh-b")], "mh-a").map((m) => m.id)).toEqual(["mh-b"]);
    expect(removeMustHave([mh("mh-a")], "mh-a")).toHaveLength(1);
  });
});

describe("ingestLabel", () => {
  it("labels known methods and passes unknown ones through", () => {
    expect(ingestLabel("jsonld")).toBe("Posting page");
    expect(ingestLabel("pasted")).toBe("Pasted");
    expect(ingestLabel("zzz")).toBe("zzz");
  });
});
