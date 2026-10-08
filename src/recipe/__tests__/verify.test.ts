/**
 * Verify seam tests: planted unsupported FACTs are downgraded, unknown ids, noise and alias contradictions dropped,
 * hedges downgraded; second model may only downgrade.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/verify.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { aliasPairs, hedged, normalise, quoteSupported, screenClaims, verifyClaims } from "@/recipe/seams/verify";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const src: Source = { id: "s1", run_id: "run-1", url: "https://github.com/jdvorakova", actor: "x", fetched_at: "t", excerpt: "Jana Dvořáková — Data Engineer at Kiwi.com, Brno. Maintains dbt-airflow-kit.", r2_key: "k", expires_at: "e", identity: "merged" };
const fact = (id: string, quote: string | null, supports = ["s1"]): Claim => ({ id, run_id: "run-1", question_id: "current-role", candidate_id: null, text: "Works at Kiwi.com", kind: "FACT", confidence: 0.9, quote, supports, contradicts: [], rank: 1 });

describe("quoteSupported", () => {
  it("normalises quotes and punctuation", () => {
    expect(normalise('“Data Engineer at Kiwi.com, Brno.”')).toBe("data engineer at kiwicom brno");
    expect(quoteSupported(fact("a", "Data Engineer at Kiwi.com"), [src])).toBe(true);
  });
  it("fails on a quote not in the excerpt, an unknown source id, or a null quote", () => {
    expect(quoteSupported(fact("b", "CTO at Kiwi.com"), [src])).toBe(false);
    expect(quoteSupported(fact("c", "Data Engineer", ["nope"]), [src])).toBe(false);
    expect(quoteSupported(fact("d", null), [src])).toBe(false);
  });
});

describe("verifyClaims", () => {
  it("downgrades 3 planted bad facts, drops the one citing only an unknown id, keeps the good one; second model downgrades one more", async () => {
    const claims = [fact("good", "Data Engineer at Kiwi.com"), fact("bad1", "CTO at Kiwi.com"), fact("bad2", "CTO", ["ghost", "s1"]), fact("orphan", "Data Engineer", ["ghost"]), fact("bad3", "   "), fact("llm-reject", "Maintains dbt-airflow-kit")];
    const ctx = baseContext({ sources: [src], claims });
    const ports = fakePorts({
      llm: fakeLlm(() => [{ id: "good", supported: true }, { id: "llm-reject", supported: false }]),
    });
    const out = await verifyClaims(ctx, ports);
    expect(out.claims_mode).toBe("replace");
    const kind = Object.fromEntries(out.claims.map((c) => [c.id, c.kind]));
    expect(kind).toEqual({ good: "FACT", bad1: "INFERENCE", bad2: "INFERENCE", bad3: "INFERENCE", "llm-reject": "INFERENCE" });
    expect(out.claims.find((c) => c.id === "bad1")?.confidence).toBeLessThanOrEqual(0.5);
  });

  it("returns at once with no model call when there are no claims", async () => {
    const ports = fakePorts();
    const out = await verifyClaims(baseContext({ sources: [src] }), ports);
    expect(ports.calls.llm).toHaveLength(0);
    expect(out.empty).toBe(true);
  });

  it("keeps the deterministic result when the second model fails", async () => {
    const ctx = baseContext({ sources: [src], claims: [fact("good", "Data Engineer at Kiwi.com")] });
    const out = await verifyClaims(ctx, fakePorts());
    expect(out.claims[0]?.kind).toBe("FACT");
    expect(out.notes.join()).toContain("verify model failed");
  });
});

describe("Buryan fact-check defects", () => {
  const li: Source = { ...src, id: "li", url: "https://www.linkedin.com/in/josef-buryan", excerpt: "Josef Buryan - CMO, Vilgain | Aktin. Built and led a marketing and sales team of 20+ people at a CEE cashback portal. From May 2019 Client Solutions Manager at Meta." };
  const claim = (id: string, over: Partial<Claim>): Claim => ({ ...fact(id, null), kind: "INFERENCE", confidence: 0.5, ...over });
  const run = (claims: Claim[]) => verifyClaims(baseContext({ subject: "Josef Buryan", sources: [src, li], claims }), fakePorts({ llm: fakeLlm(() => []) }));

  it("drops a malformed support id; an INFERENCE citing only it is dropped, a FACT left without confirmed support becomes INFERENCE", async () => {
    const out = await run([
      claim("seal", { question_id: "public-talks", text: "Describes an Irish seal rescue centre", supports: ["9b6ea47-ef28-47c1-8328-b8162612f5b5"] }),
      fact("mixed", "CTO at Kiwi.com", ["9b6ea47-ef28", "s1"]),
      fact("kept", "Data Engineer at Kiwi.com", ["9b6ea47-ef28", "s1"]),
    ]);
    expect(out.claims.map((c) => c.id)).toEqual(["mixed", "kept"]);
    expect(out.claims.find((c) => c.id === "mixed")).toMatchObject({ kind: "INFERENCE", supports: ["s1"] });
    expect(out.claims.find((c) => c.id === "kept")).toMatchObject({ kind: "FACT", supports: ["s1"] });
    expect(out.notes.join("\n")).toMatch(/dropped \(no source\): seal[\s\S]*downgraded \(no confirmed support\): mixed/);
  });

  it("downgrades a hedged FACT with the note 'hedged wording', but not the month May", async () => {
    const out = await run([
      { ...fact("tipli", "a marketing and sales team of 20+ people at a CEE cashback portal", ["li"]), text: "Led a marketing and sales organization of more than 20 people at a CEE cashback portal, likely Tipli." },
      { ...fact("meta", "From May 2019 Client Solutions Manager at Meta", ["li"]), text: "From May 2019 he was Client Solutions Manager at Meta." },
    ]);
    expect(out.claims.map((c) => [c.id, c.kind])).toEqual([["tipli", "INFERENCE"], ["meta", "FACT"]]);
    expect(out.notes).toContain("downgraded (hedged wording): tipli");
    expect(["probably", "may have", "might", "appears to", "seems", "presumably", "possibly", "pravděpodobně", "zřejmě", "asi"].every((h) => hedged(`He ${h} led it`))).toBe(true);
    expect(hedged("Joined in May 2019; bias toward Asia")).toBe(false);
  });

  it("drops self-declared unrelated or misattributed content", async () => {
    const out = await run([
      claim("noise1", { text: "One Facebook snippet describes a seal centre. This appears to be misattributed or unrelated content.", supports: ["li"] }),
      claim("noise2", { text: "This post appears to be unrelated to him.", supports: ["li"] }),
      claim("ok", { text: "Works with data", supports: ["s1"] }),
    ]);
    expect(out.claims.map((c) => c.id)).toEqual(["ok"]);
  });

  it("drops a contradiction that names two aliases from 'A | B', 'A (formerly B)' or 'A, formerly B'; keeps a real one", () => {
    expect(aliasPairs([{ excerpt: "CMO, Vilgain | Aktin" }], "Josef Buryan")).toContainEqual(["Vilgain", "Aktin"]);
    expect(aliasPairs([{ excerpt: "Josef Buryan | LinkedIn" }], "Josef Buryan")).toEqual([]);
    expect(aliasPairs([{ excerpt: "Head of Marketing at Rohlik Group (formerly Velka Pecka)" }])).toContainEqual(["Rohlik Group", "Velka Pecka"]);
    expect(aliasPairs([{ excerpt: "works for Alza, formerly Alzasoft" }])).toContainEqual(["Alza", "Alzasoft"]);
    const contra = (id: string, text: string): Claim => claim(id, { question_id: "contradictions", text, supports: ["li"] });
    const { kept, notes } = screenClaims(
      [contra("aktin", "A Facebook snippet says he left 'Aktin' in January 2025, whereas LinkedIn names Vilgain for that period."), contra("real", "LinkedIn says CMO at Vilgain, a podcast says Head of Growth at Vilgain for 2023.")],
      [src, li],
      "Josef Buryan",
    );
    expect(kept.map((c) => c.id)).toEqual(["real"]);
    expect(notes[0]).toContain("aliases of one organisation: Vilgain | Aktin");
    // the alias screen only touches the contradictions question
    expect(screenClaims([claim("career", { text: "CMO at Vilgain, which trades as Aktin", supports: ["li"] })], [li], "Josef Buryan").kept).toHaveLength(1);
  });
});
