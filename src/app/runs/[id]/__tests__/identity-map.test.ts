/**
 * Tests for the identity map layout: grouping by decision, live overrides, geometry, caps, links, labels, summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/identity-map.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - identityMapLayout: merge before possibly-same-as on the ring, rejected in the column, decisionOf overrides
 * - Geometry: nodes on the ring, no overlap, circles and labels inside the viewBox, single node on top
 * - Caps with hidden counts; href only for http(s); supplied flag; tooltip and label truncation; determinism
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { CENTER_R, DENSE_AFTER, identityMapLayout, LABEL_CHAR_W, labelLines, type MapLayout, type MapNode, NODE_R, RING_R, RING_R_DENSE } from "../identity-map";

const cand = (id: string, platform: string, decision: CandidateDecision, over: Partial<Candidate> = {}): Candidate => ({
  id, run_id: "r", name: "Jan Novak", profile_urls: [`https://${platform}.example.com/${id}`], anchor_match: null, score: 0.7, decision, platform,
  handle: platform === "web" ? null : id, snippet: "Data engineer · Brno", reasons: ["Same city as you entered"], ...over,
});

const server = (c: Candidate): CandidateDecision => c.decision;
const ids = (nodes: MapNode[]): string[] => nodes.map((n) => n.id);

const many = (n: number, decision: CandidateDecision, prefix: string): Candidate[] =>
  Array.from({ length: n }, (_, i) => cand(`${prefix}${String(i)}`, "web", decision));

function expectInside(layout: MapLayout): void {
  const margin = 8;
  for (const n of [...layout.linked, ...layout.others]) {
    expect(n.x - NODE_R).toBeGreaterThanOrEqual(margin);
    expect(n.y - NODE_R).toBeGreaterThanOrEqual(margin);
    expect(n.x + NODE_R).toBeLessThanOrEqual(layout.width - margin);
    expect(n.y + NODE_R).toBeLessThanOrEqual(layout.height - margin);
    for (const l of labelLines(n, layout.center)) {
      const w = l.text.length * LABEL_CHAR_W;
      const left = l.anchor === "middle" ? l.x - w / 2 : l.x;
      expect(left).toBeGreaterThanOrEqual(margin);
      expect(left + w).toBeLessThanOrEqual(layout.width - margin);
      expect(l.y - 11).toBeGreaterThanOrEqual(margin);
      expect(l.y + 3).toBeLessThanOrEqual(layout.height - margin);
    }
  }
}

describe("identityMapLayout", () => {
  it("draws nothing and says so for an empty lineup", () => {
    const layout = identityMapLayout([], server);
    expect(layout.linked).toEqual([]);
    expect(layout.others).toEqual([]);
    expect(layout.hiddenLinked).toBe(0);
    expect(layout.hiddenOthers).toBe(0);
    expect(layout.summary).toBe("No profiles found yet");
  });

  it("puts merge before possibly-same-as on the ring and namesakes in the column", () => {
    const layout = identityMapLayout(
      [cand("ig", "instagram", "possibly-same-as"), cand("bad", "linkedin", "rejected"), cand("gh", "github", "merge"), cand("li", "linkedin", "merge")],
      server,
    );
    expect(ids(layout.linked)).toEqual(["li", "gh", "ig"]);
    expect(layout.linked.map((n) => n.decision)).toEqual(["merge", "merge", "possibly-same-as"]);
    expect(ids(layout.others)).toEqual(["bad"]);
    expect(layout.summary).toBe("2 profiles are theirs · 1 not sure yet · 1 someone else");

    const one = identityMapLayout([cand("li", "linkedin", "merge"), cand("x", "x", "rejected"), cand("ig", "instagram", "rejected")], server);
    expect(one.summary).toBe("1 profile is theirs · 2 someone else");
  });

  it("follows the local lineup answer through decisionOf", () => {
    const lineup = [cand("li", "linkedin", "merge"), cand("ig", "instagram", "possibly-same-as")];
    expect(ids(identityMapLayout(lineup, server).linked)).toEqual(["li", "ig"]);
    const answered = identityMapLayout(lineup, (c) => (c.id === "ig" ? "rejected" : c.decision));
    expect(ids(answered.linked)).toEqual(["li"]);
    expect(ids(answered.others)).toEqual(["ig"]);
    expect(answered.others[0]?.decision).toBe("rejected");
    expect(answered.summary).toBe("1 profile is theirs · 1 someone else");
  });

  it("places linked nodes on the ring without overlap and keeps everything inside the viewBox", () => {
    for (const n of [1, 2, 3, 5, 10]) {
      const layout = identityMapLayout([...many(n, "merge", "m"), ...many(6, "rejected", "r")], server);
      expect(layout.linked).toHaveLength(n);
      expect(layout.ring).toBe(n > DENSE_AFTER ? RING_R_DENSE : RING_R);
      for (const node of layout.linked) {
        expect(Math.abs(Math.hypot(node.x - layout.center.x, node.y - layout.center.y) - layout.ring)).toBeLessThanOrEqual(0.5);
      }
      for (const [i, a] of layout.linked.entries()) {
        for (const b of layout.linked.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * NODE_R + 8);
      }
      expect(RING_R).toBeGreaterThanOrEqual(CENTER_R + NODE_R + 8);
      // Labels sit on the far side of the node, so the line to the center never crosses them.
      for (const node of layout.linked) {
        for (const l of labelLines(node, layout.center)) expect(node.y < layout.center.y - 1 ? l.y < node.y - NODE_R : l.y - 11 > node.y + NODE_R).toBe(true);
      }
      expectInside(layout);
    }
    // Longest labels, many namesakes and both "+N more" lines.
    const long = { handle: "a-very-long-handle-name", profile_urls: ["https://www.some-really-long-hostname.example.org/x"] };
    expectInside(identityMapLayout([...many(14, "merge", "m").map((c) => ({ ...c, ...long })), ...many(9, "rejected", "r").map((c) => ({ ...c, ...long, platform: "github" }))], server));

    const single = identityMapLayout([cand("li", "linkedin", "merge")], server);
    expect(single.linked[0]?.x).toBe(single.center.x);
    expect(single.linked[0]?.y).toBe(single.center.y - RING_R);

    // A dense ring keeps one label line per node; the column keeps the @handle.
    const dense = identityMapLayout([...many(7, "merge", "m").map((c) => ({ ...c, platform: "github" })), cand("bad", "x", "rejected")], server);
    expect(dense.linked.every((n) => n.handle === null && labelLines(n, dense.center).length === 1)).toBe(true);
    expect(dense.others[0]?.handle).toBe("@bad");
  });

  it("caps the ring at 10 and the column at 6 and counts the rest", () => {
    const layout = identityMapLayout([...many(14, "possibly-same-as", "p"), ...many(9, "rejected", "r")], server);
    expect(layout.linked).toHaveLength(10);
    expect(layout.hiddenLinked).toBe(4);
    expect(layout.others).toHaveLength(6);
    expect(layout.hiddenOthers).toBe(3);
    expect(layout.summary).toBe("14 not sure yet · 9 someone else");
  });

  it("links only http(s) profile URLs", () => {
    const href = (url: string): string | null => identityMapLayout([cand("a", "linkedin", "merge", { profile_urls: [url] })], server).linked[0]?.href ?? null;
    expect(href("https://linkedin.com/in/jan-novak")).toBe("https://linkedin.com/in/jan-novak");
    expect(href("http://jan-novak.example.cz/")).toBe("http://jan-novak.example.cz/");
    expect(href("javascript:alert(1)")).toBeNull();
    expect(href("data:text/html,hi")).toBeNull();
    expect(href("not a url")).toBeNull();
    expect(identityMapLayout([cand("a", "linkedin", "merge", { profile_urls: [] })], server).linked[0]?.href).toBeNull();
  });

  it("marks profiles the user supplied and builds a short tooltip without the fallback prefix", () => {
    const layout = identityMapLayout(
      [
        cand("li", "linkedin", "merge", { reasons: ["Profile link you supplied"] }),
        cand("gh", "github", "merge", { snippet: "Jan Novak · Brno", reasons: ["fallback: same name and city", "other"] }),
        cand("x", "x", "possibly-same-as", { snippet: "y".repeat(200) }),
      ],
      server,
    );
    const [li, gh, x] = layout.linked;
    expect(li?.supplied).toBe(true);
    expect(gh?.supplied).toBe(false);
    expect(gh?.tooltip).toBe("Jan Novak · Brno · same name and city");
    expect(x?.tooltip).toHaveLength(140);
    expect(x?.tooltip.endsWith("…")).toBe(true);
  });

  it("labels nodes with the platform and @handle, web hits with the hostname, and truncates at 16", () => {
    const layout = identityMapLayout(
      [
        cand("li", "linkedin", "merge", { handle: "jan-novak" }),
        cand("web", "web", "merge", { profile_urls: ["https://www.jan-novak.example.cz/about"], handle: "ignored" }),
        cand("gh", "github", "merge", { handle: "jan-novak-data-engineering" }),
        cand("x", "x", "merge", { handle: null }),
      ],
      server,
    );
    const byId = new Map(layout.linked.map((n) => [n.id, n]));
    expect(byId.get("li")?.label).toBe("LinkedIn");
    expect(byId.get("li")?.handle).toBe("@jan-novak");
    expect(byId.get("web")?.label).toBe("jan-novak.examp…");
    expect(byId.get("web")?.label).toHaveLength(16);
    expect(byId.get("web")?.handle).toBeNull();
    expect(byId.get("gh")?.handle).toBe("@jan-novak-data…");
    expect(byId.get("x")?.handle).toBeNull();
  });

  it("is deterministic and never carries the match score", () => {
    const lineup = [cand("li", "linkedin", "merge"), cand("ig", "instagram", "possibly-same-as"), cand("bad", "x", "rejected")];
    const a = identityMapLayout(lineup, server);
    expect(identityMapLayout(lineup, server)).toEqual(a);
    expect(JSON.stringify(a)).not.toMatch(/score/);
  });
});
