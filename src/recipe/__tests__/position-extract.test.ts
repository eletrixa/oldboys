/**
 * Position extract seam tests: must-have shaping, family fallback, deterministic fallback, prompt prohibitions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/position-extract.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { extractPosition, familyOf } from "@/recipe/seams/position-extract";
import { fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";
import type { Ports } from "@/domain/ports";

const mh = (id: string, text = `Has ${id}?`) => ({ id, text, accepted_evidence: ["repo"] });
const out = (over: Record<string, unknown> = {}) => ({ title: "Data Engineer", company: "Acme", location: "Prague", family: "data", must_haves: [mh("mh-a")], ...over });
const run = (value: unknown, hint?: Parameters<typeof extractPosition>[2]) => extractPosition("posting text", fakePorts({ llm: fakeLlm(() => value) }), hint);

describe("extractPosition", () => {
  it("X1: keeps 4 valid must-haves with mh- ids, a valid family and the model cost", async () => {
    const r = await run(out({ must_haves: [mh("mh-a"), mh("mh-b"), mh("mh-c"), mh("mh-d")] }));
    expect(r.must_haves.map((m) => m.id)).toEqual(["mh-a", "mh-b", "mh-c", "mh-d"]);
    expect(r.family).toBe("data");
    expect(r.cost_usd).toBe(0.001);
    expect(r.company).toBe("Acme");
    expect(r.notes).toEqual([]);
  });

  it("X2: cuts to 5, drops base ids and duplicates, drops ids without the mh- prefix", async () => {
    const r = await run(out({ must_haves: [mh("mh-a"), mh("mh-a"), mh("location-match"), mh("Plain Id"), mh("mh-c"), mh("mh-d"), mh("mh-e"), mh("mh-f"), mh("mh-g")] }));
    expect(r.must_haves.map((m) => m.id)).toEqual(["mh-a", "mh-c", "mh-d", "mh-e", "mh-f"]);
  });

  it("X3: hint.title overrides the model title, an empty hint does not", async () => {
    expect((await run(out(), { title: "Lead Analyst" })).title).toBe("Lead Analyst");
    expect((await run(out(), { title: " " })).title).toBe("Data Engineer");
  });

  it("X4: an invalid family falls back to familyOf(title)", async () => {
    expect((await run(out({ family: "legal" }))).family).toBe("data");
    expect(familyOf("Senior Data Engineer")).toBe("data");
    expect(familyOf("Obchodní zástupce")).toBe("sales");
    expect(familyOf("Zookeeper")).toBe("other");
    expect(familyOf("Backend Developer")).toBe("engineering");
  });

  it("X5: a throwing LLM gives the 3 generic must-haves, family from title, cost 0 and the error in a note", async () => {
    const r = await extractPosition("t", fakePorts(), { title: "Sales Manager", location: "Brno" });
    expect(r.must_haves.map((m) => m.id)).toEqual(["mh-title-experience", "mh-public-work", "mh-location-fit"]);
    expect(r.must_haves.every((m) => m.accepted_evidence.length > 0)).toBe(true);
    expect(r.must_haves[2]?.text).toContain("Brno");
    expect(r.family).toBe("sales");
    expect(r.extraction).toBe("fallback");
    expect(r.cost_usd).toBe(0);
    expect(r.notes[0]).toMatch(/^position extract: LLM failed \(no fake llm configured\)/);
  });

  it("X6: only unusable must-haves give the fallbacks and a no-usable-output note", async () => {
    const r = await run(out({ must_haves: [mh("current-role")] }));
    expect(r.must_haves).toHaveLength(3);
    expect(r.extraction).toBe("fallback");
    expect(r.notes).toEqual(["position extract: no usable LLM output, used generic fallback"]);
    expect(r.cost_usd).toBe(0.001);
  });

  it("X7: the system prompt forbids Art. 9 and personality criteria", async () => {
    let system = "";
    const llm = ((i: { system: string }) => {
      system = i.system;
      return Promise.resolve({ value: out(), cost_usd: 0 });
    }) as Ports["llm"];
    await extractPosition("t", fakePorts({ llm }));
    for (const w of ["health", "politics", "religion", "ethnicity", "sexuality", "personality", "trustworthiness"]) expect(system).toContain(w);
  });
});
