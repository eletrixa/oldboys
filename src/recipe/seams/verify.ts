/**
 * Verify seam: deterministic quote-in-excerpt + source-id check, then a second model that may only downgrade.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/verify.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/verify.test.ts
 *
 * Key responsibilities:
 * - FACT keeps its kind only if every cited source exists and the normalised quote is inside one cited excerpt
 * - Residue (FACTs that passed) goes to the verify model; "not supported" downgrades to INFERENCE
 *
 * Design constraints:
 * - Downgrade only, never promote; an LLM failure keeps the deterministic result
 * - Returns the full claim list (claims_mode = replace)
 */
import { z } from "zod";
import type { Claim, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { normalizeText, quoteInNormalized } from "@/domain/quote";
import { emptyOutcome } from "@/recipe/runner";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";

/** The seam's name for the shared normaliser (src/domain/quote.ts): FACT and STATEMENT share one gate. */
export const normalise = normalizeText;

export function quoteSupported(claim: Claim, sources: readonly Source[]): boolean {
  if (claim.quote === null) return false;
  const quote = claim.quote;
  const byId = new Map(sources.map((s) => [s.id, s]));
  return (
    claim.supports.every((id) => byId.has(id)) &&
    claim.supports.some((id) => quoteInNormalized(quote, normalizeText(byId.get(id)?.excerpt ?? "")))
  );
}

function downgrade(claim: Claim): Claim {
  return { ...claim, kind: "INFERENCE", confidence: Math.min(claim.confidence, 0.5) };
}

const Verdicts = z.array(z.object({ id: z.string(), supported: z.boolean() }));

export async function verifyClaims(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  out.claims_mode = "replace";
  const first = ctx.claims.map((c) => {
    if (c.kind !== "FACT") return c;
    if (quoteSupported(c, ctx.sources)) return c;
    out.notes.push(`downgraded (quote not in source): ${c.id}`);
    return downgrade(c);
  });
  const residue = first.filter((c) => c.kind === "FACT");
  let final = first;
  if (residue.length > 0) {
    try {
      const byId = new Map(ctx.sources.map((s) => [s.id, s]));
      const r = await ports.llm({
        model: "verify",
        system: "You check whether a quote actually supports a claim. Answer supported=false when the quote does not state the claim, is about someone else, or is taken out of context. You may only reject, never add.",
        prompt: residue
          .map((c) => `id=${c.id}\nclaim: ${c.text}\nquote: ${c.quote ?? ""}\nsource: ${byId.get(c.supports[0] ?? "")?.url ?? ""}`)
          .join("\n\n"),
        schema: Verdicts,
      });
      out.calls += 1;
      out.cost_usd += r.cost_usd;
      const rejected = new Set(r.value.filter((v) => !v.supported).map((v) => v.id));
      final = first.map((c) => (rejected.has(c.id) ? downgrade(c) : c));
      for (const id of rejected) out.notes.push(`downgraded (second model): ${id}`);
    } catch (error) {
      out.notes.push(`verify model failed, deterministic result kept: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  out.claims = final;
  out.empty = final.length === 0;
  return out;
}
