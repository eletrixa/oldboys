/**
 * Runner tests: collection through fake ports, budget stop, failure notes, REST path.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/runner.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { executeStep } from "@/recipe/runner";
import type { Step } from "@/recipe/step";
import { baseContext, fakePorts, serpFixture } from "@/recipe/__tests__/fakes";

const serp: Step = { id: "serp_person", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor}' };

describe("executeStep collection", () => {
  it("runs the SERP actor, stores one source per hit and reports cost", async () => {
    const ports = fakePorts({ callActor: () => Promise.resolve({ items: serpFixture, cost_usd: 0.002 }) });
    const out = await executeStep(serp, baseContext(), ports);
    expect(out.empty).toBe(false);
    expect(out.sources).toHaveLength(3);
    expect(out.sources[0]?.url).toContain("linkedin.com");
    expect(out.cost_usd).toBeCloseTo(0.002);
    expect(out.calls).toBe(1);
    expect(ports.stored).toHaveLength(3);
  });

  it("stores one source per page: locale and trailing-slash variants of a URL are not stored again", async () => {
    const items = [
      {
        organicResults: [
          { title: "A", url: "https://podcasts.apple.com/us/podcast/ep?i=1&l=ru", description: "Episode" },
          { title: "A", url: "https://podcasts.apple.com/us/podcast/ep?i=1", description: "Episode" },
          { title: "B", url: "https://www.linkedin.com/in/jana-dvorakova-data/", description: "Jana" },
        ],
      },
    ];
    const ctx = baseContext();
    const earlier = { ...ctx, sources: [{ id: "s0", run_id: ctx.runId, url: "https://www.linkedin.com/in/jana-dvorakova-data", actor: "x", fetched_at: "t", excerpt: "e", r2_key: "k", expires_at: "t", identity: "merged" as const }] };
    const out = await executeStep(serp, earlier, fakePorts({ callActor: () => Promise.resolve({ items, cost_usd: 0 }) }));
    expect(out.sources.map((s) => s.url)).toEqual(["https://podcasts.apple.com/us/podcast/ep?i=1&l=ru"]);
  });

  it("reports empty when the actor returns nothing", async () => {
    const out = await executeStep(serp, baseContext(), fakePorts());
    expect(out.empty).toBe(true);
    expect(out.sources).toHaveLength(0);
  });

  it("refuses paid requests once the call budget is spent", async () => {
    const ports = fakePorts();
    const out = await executeStep(serp, baseContext({ spent: { usd: 0, calls: 12 } }), ports);
    expect(ports.calls.actor).toHaveLength(0);
    expect(out.notes.join()).toContain("run budget reached");
  });

  it("marks a collector with nothing to look up as skipped: zero calls plus a note", async () => {
    const vr: Step = { id: "ares_vr", kind: "ares", actor: "ares/ekonomicke-subjekty-vr" };
    const out = await executeStep(vr, baseContext(), fakePorts());
    expect(out.calls).toBe(0);
    expect(out.notes).toEqual(["no confirmed handle or id to look up"]);
  });

  it("turns a thrown request into a note, not a crash", async () => {
    const ports = fakePorts({ callActor: () => Promise.reject(new Error("HTTP 402")) });
    const out = await executeStep(serp, baseContext(), ports);
    expect(out.empty).toBe(true);
    expect(out.notes[0]).toContain("HTTP 402");
  });

  it("uses fetchJson for ARES and parses entities", async () => {
    const ports = fakePorts({
      fetchJson: () => Promise.resolve({ pocetCelkem: 1, ekonomickeSubjekty: [{ ico: "12345678", obchodniJmeno: "Navěky s.r.o.", pravniForma: "112", datumVzniku: "2019-03-12", sidlo: { textovaAdresa: "Praha 1" } }] }),
    });
    const ares: Step = { id: "ares_subjekty", kind: "ares", actor: "ares/ekonomicke-subjekty/vyhledat" };
    const out = await executeStep(ares, baseContext({ goal: "due-diligence", subject: "Navěky" }), ports);
    expect(ports.calls.fetch[0]).toContain("/ekonomicke-subjekty/vyhledat");
    expect(out.sources[0]?.excerpt).toContain("IČO 12345678");
  });

  it("ares_vr requests one record per IČO seen in earlier sources and nothing otherwise", async () => {
    const vr: Step = { id: "ares_vr", kind: "ares", actor: "ares/ekonomicke-subjekty-vr" };
    const none = await executeStep(vr, baseContext(), fakePorts());
    expect(none.empty).toBe(true);
    const ctx = baseContext({
      sources: [{ id: "s1", run_id: "run-1", url: "https://ares.gov.cz/ekonomicke-subjekty?ico=12345678", actor: "ares", fetched_at: "x", excerpt: "", r2_key: "k", expires_at: "y", identity: "merged" }],
    });
    const ports = fakePorts({
      fetchJson: () => Promise.resolve({ zaznamy: [{ ico: "12345678", obchodniJmeno: "Navěky s.r.o.", statutarniOrgany: [{ clenoveOrganu: [{ fyzickaOsoba: { jmeno: "Robert", prijmeni: "Vojáček" }, clenstvi: { funkce: { nazev: "jednatel" } }, datumZapisu: "2019-03-12", datumVymazu: null }] }] }] }),
    });
    const out = await executeStep(vr, ctx, ports);
    expect(out.sources[0]?.excerpt).toContain("jednatel od 2019-03-12 (current)");
  });
});
