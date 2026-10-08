/**
 * Verify seam tests: planted unsupported FACTs are downgraded; second model may only downgrade.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/verify.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { normalise, quoteSupported, verifyClaims } from "@/recipe/seams/verify";
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
  it("downgrades 3 planted bad facts and keeps the good one; second model downgrades one more", async () => {
    const claims = [fact("good", "Data Engineer at Kiwi.com"), fact("bad1", "CTO at Kiwi.com"), fact("bad2", "Data Engineer", ["ghost"]), fact("bad3", "   "), fact("llm-reject", "Maintains dbt-airflow-kit")];
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
