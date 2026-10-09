/**
 * Position extract seam: one LLM call turns posting text into title, company, location, family and 3-5 must-haves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/position-extract.ts
 * Deps:    zod, src/domain/position (FAMILIES, Family, MustHave, shapeMustHaves, fallbackMustHaves, familyOf)
 * Tested:  src/recipe/__tests__/position-extract.test.ts
 *
 * Key responsibilities:
 * - `extractPosition`: must-haves shaped like `roleQuestions` (kebab `mh-` ids, no base ids, no duplicates, max 5);
 *   deterministic 3-item fallback when the call throws or yields nothing usable
 * - `familyOf`: re-exported from src/domain/position (the CZ/EN keyword table), used when the model's family is invalid
 *
 * Design constraints:
 * - Never throws; the result always has 3 to 5 must-haves; `cost_usd` is 0 when the model threw
 * - The system prompt forbids Art. 9 criteria and personality or trustworthiness traits
 */
import { z } from "zod";
import type { Ports } from "@/domain/ports";
import { errorMessage, FAMILIES, type Family, fallbackMustHaves, familyOf, MustHave, shapeMustHaves } from "@/domain/position";

export { familyOf };

const Extract = z.object({
  title: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  family: z.string(),
  must_haves: z.array(MustHave.extend({ id: z.string() })),
});

const SYSTEM =
  `Read a job posting and extract: title, company, location (city), family (one of ${FAMILIES.join(", ")}), and 3 to 5 must-haves about a candidate. ` +
  'Each must-have is observable: answerable from public web evidence (repos, talks, job history, profiles). `id` is kebab-case starting with "mh-". `title` is a 2 to 5 word label. `accepted_evidence` lists short evidence types. ' +
  "Skip hygiene items almost every candidate meets (version control, a degree, basic English, teamwork) unless the posting stresses them; prefer the skills that distinguish this role. " +
  "Never use criteria about health, politics, religion, ethnicity or sexuality, and never personality or trustworthiness traits.";

const isFamily = (v: string): v is Family => (FAMILIES as readonly string[]).includes(v);

const clean = (s: string | undefined): string | undefined => {
  const t = s?.trim();
  return t === undefined || t === "" ? undefined : t;
};

export type ExtractedPosition = {
  title: string;
  company?: string;
  location?: string;
  family: Family;
  must_haves: MustHave[];
  extraction: "model" | "fallback";
  cost_usd: number;
  notes: string[];
};

export async function extractPosition(
  text: string,
  ports: Pick<Ports, "llm">,
  hint: { title?: string; company?: string; location?: string } = {},
): Promise<ExtractedPosition> {
  const withOptional = (title: string, company?: string, location?: string) => ({
    title,
    ...(company !== undefined ? { company } : {}),
    ...(location !== undefined ? { location } : {}),
  });
  const hinted = { title: clean(hint.title), company: clean(hint.company), location: clean(hint.location) };
  try {
    const r = await ports.llm({ model: "primary", system: SYSTEM, prompt: `Posting:\n${text}`, schema: Extract });
    const title = hinted.title ?? clean(r.value.title) ?? "";
    const company = hinted.company ?? clean(r.value.company);
    const location = hinted.location ?? clean(r.value.location);
    const must_haves = shapeMustHaves(r.value.must_haves);
    const usable = must_haves.length > 0;
    return {
      ...withOptional(title, company, location),
      family: isFamily(r.value.family) ? r.value.family : familyOf(title),
      must_haves: usable ? must_haves : fallbackMustHaves(title, location ?? null),
      extraction: usable ? "model" : "fallback",
      cost_usd: r.cost_usd,
      notes: usable ? [] : ["position extract: no usable LLM output, used generic fallback"],
    };
  } catch (e) {
    const title = hinted.title ?? "";
    return {
      ...withOptional(title, hinted.company, hinted.location),
      family: familyOf(title),
      must_haves: fallbackMustHaves(title, hinted.location ?? null),
      extraction: "fallback",
      cost_usd: 0,
      notes: [`position extract: LLM failed (${errorMessage(e)}), used generic fallback`],
    };
  }
}
