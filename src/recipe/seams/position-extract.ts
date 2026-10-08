/**
 * Position extract seam: one LLM call turns posting text into title, company, location, family and 3-5 must-haves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/position-extract.ts
 * Deps:    zod, src/domain/position (FAMILIES, Family, MustHave, shapeMustHaves, fallbackMustHaves)
 * Tested:  src/recipe/__tests__/position-extract.test.ts
 *
 * Key responsibilities:
 * - `extractPosition`: must-haves shaped like `roleQuestions` (kebab `mh-` ids, no base ids, no duplicates, max 5);
 *   deterministic 3-item fallback when the call throws or yields nothing usable
 * - `familyOf`: CZ/EN keyword table from a title to a `Family`, used when the model's family is invalid
 *
 * Design constraints:
 * - Never throws; the result always has 3 to 5 must-haves; `cost_usd` is 0 when the model threw
 * - The system prompt forbids Art. 9 criteria and personality or trustworthiness traits
 */
import { z } from "zod";
import type { Ports } from "@/domain/ports";
import { errorMessage, FAMILIES, type Family, fallbackMustHaves, MustHave, shapeMustHaves } from "@/domain/position";

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
  "Never use criteria about health, politics, religion, ethnicity or sexuality, and never personality or trustworthiness traits.";

// Order matters: the first matching family wins ("data engineer" is data, not engineering).
const FAMILY_RULES: readonly [Family, RegExp][] = [
  ["data", /data|analyst|analytik|\bml\b|machine learning|\bbi\b/],
  ["marketing", /marketing|growth|\bseo\b|content|\bpr\b|brand|\bcmo\b/],
  ["product", /product|produkt/],
  ["design", /design|\bux\b|\bui\b/],
  ["finance", /financ|účetn|accountant|accounting|controller/],
  ["sales", /obchodn|sales|account|prodej/],
  ["people", /recruit|\bhr\b|people|talent|personal/],
  ["operations", /operations|provoz|logistic|support|office/],
  ["engineering", /vývojář|developer|engineer|programátor|devops|architect|\bqa\b|tester/],
];

export function familyOf(title: string): Family {
  const t = title.toLowerCase();
  return FAMILY_RULES.find(([, re]) => re.test(t))?.[0] ?? "other";
}

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
