/**
 * Tests for the pure helpers behind the positions pages.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/position-links.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - G1 groupByFamily, G2 filterTitles, titleChoices (ingested first, catalog titles fill in, no company), G13 must-have editor
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  addMustHave,
  filterTitles,
  groupByFamily,
  indexTitles,
  ingestLabel,
  removeMustHave,
  titleChoices,
} from "@/domain/position-links";
import type { MustHave, PositionListItem } from "@/domain/position";
import type { RoleOption } from "@/domain/role-catalog";

function item(id: string, family: string, created_at: string, title = "T", company: string | null = null): PositionListItem {
  return { id, family, created_at, title, company, ingest_method: "manual", expires_at: created_at, location: null, posting_url: null, runs: 0 } as PositionListItem;
}

describe("groupByFamily", () => {
  it("orders by FAMILIES, other last, skips empty, keeps input order inside", () => {
    const groups = groupByFamily([
      item("a", "other", "2026-01-01"),
      item("b", "data", "2026-01-01"),
      item("d", "engineering", "2026-01-03"),
      item("c", "engineering", "2026-01-02"),
    ]);
    expect(groups.map((g) => g.family)).toEqual(["engineering", "data", "other"]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["d", "c"]);
  });
});

describe("filterTitles", () => {
  const all = [item("1", "data", "x", "Senior Data Engineer", "Acme"), item("2", "sales", "x", "Obchodní zástupce", "Škoda")];
  const indexed = indexTitles(all);
  it("matches the title only, ignoring case and diacritics; the company is not searched", () => {
    expect(filterTitles(indexed, "data").map((i) => i.id)).toEqual(["1"]);
    expect(filterTitles(indexed, "obchodni").map((i) => i.id)).toEqual(["2"]);
    expect(filterTitles(indexed, "skoda")).toEqual([]);
  });
  it("returns all for empty or whitespace", () => {
    expect(filterTitles(indexed, "")).toHaveLength(2);
    expect(filterTitles(indexed, "   ")).toHaveLength(2);
  });
});

describe("titleChoices", () => {
  const catalog: RoleOption[] = [
    { title: "Data Engineer", family: "data", aliases: [] },
    { title: "Backend Engineer", family: "engineering", aliases: [] },
  ];
  it("lists ingested positions newest first, then catalog titles not already ingested, without companies", () => {
    const rows = titleChoices(catalog, [item("old", "data", "2026-01-01", "data engineer", "Acme"), item("new", "sales", "2026-01-02", "AE", "Škoda")]);
    expect(rows.map((r) => r.title)).toEqual(["AE", "data engineer", "Backend Engineer"]);
    expect(rows[0]).toEqual({ title: "AE", family: "sales", href: "/positions/new", runs: 0, posting_url: null });
    expect(rows[2]).toEqual({ title: "Backend Engineer", family: "engineering", href: "/?role=Backend%20Engineer", runs: null, posting_url: null });
    expect(JSON.stringify(rows)).not.toContain("Acme");
  });
  it("is the whole catalog when nothing is ingested", () => {
    expect(titleChoices(catalog, [])).toHaveLength(2);
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
