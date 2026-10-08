/**
 * Position extract seam: one LLM call turns posting text into title, company, location, family and 3-5 must-haves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/position-extract.ts
 * Deps:    zod, src/domain/position (FAMILIES, Family, MustHave)
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

import { FAMILIES, type Family, type MustHave } from "@/domain/position";

const BASE_IDS = new Set(["current-role", "career-history", "public-code", "public-talks", "location-match", "contradictions"]);
const MAX_MUST_HAVES = 5;
const MAX_TITLE = 48;

const Extract = z.object({
  title: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  family: z.string(),
  must_haves: z.array(z.object({ id: z.string(), text: z.string().min(1), title: z.string().optional(), accepted_evidence: z.array(z.string()) })),
});

const SYSTEM =
  `Read a job posting and extract: title, company, location (city), family (one of ${FAMILIES.join(", ")}), and 3 to 5 must-haves about a candidate. ` +
  'Each must-have is observable: answerable from public web evidence (repos, talks, job history, profiles). `id` is kebab-case starting with "mh-". `title` is a 2 to 5 word label. `accepted_evidence` lists short evidence types. ' +
  "Never use criteria about health, politics, religion, ethnicity or sexuality, and never personality or trustworthiness traits.";

// Order matters: the first matching family wins ("data engineer" is data, not engineering).
const FAMILY_RULES: readonly [Family, RegExp][] = [
  ["data", /data|analyst|analytik|\bml\b|machine learning|\bbi\b/],
  ["marketing", /marketing|\bseo\b|content|\bpr\b|brand/],
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

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** The three generic must-haves of the `roleQuestions` fallback, as `MustHave`. */
function fallback(title: string, location?: string): MustHave[] {
  const label = title === "" ? "this role" : title;
  return [
    { id: "mh-title-experience", title: "Role experience", text: `Has held a ${label} position or equivalent`, accepted_evidence: ["job history", "profile"] },
    { id: "mh-public-work", title: "Public work", text: `Has public work showing ${label} skills`, accepted_evidence: ["repo", "talk", "article", "portfolio"] },
    { id: "mh-location-fit", title: "Location fit", text: `Location compatible with ${location ?? "the role"}`, accepted_evidence: ["profile location"] },
  ];
}

const clean = (s: string | undefined): string | undefined => {
  const t = s?.trim();
  return t === undefined || t === "" ? undefined : t;
};

export type ExtractedPosition = { title: string; company?: string; location?: string; family: Family; must_haves: MustHave[]; cost_usd: number; notes: string[] };

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
  try {
    const r = await ports.llm({ model: "primary", system: SYSTEM, prompt: `Posting:\n${text}`, schema: Extract });
    const title = clean(hint.title) ?? clean(r.value.title) ?? "";
    const company = clean(hint.company) ?? clean(r.value.company);
    const location = clean(hint.location) ?? clean(r.value.location);
    const family = isFamily(r.value.family) ? r.value.family : familyOf(title);
    const seen = new Set<string>();
    const must_haves: MustHave[] = [];
    for (const m of r.value.must_haves) {
      const id = kebab(m.id);
      if (!id.startsWith("mh-") || BASE_IDS.has(id) || seen.has(id)) continue;
      seen.add(id);
      const label = m.title?.trim().slice(0, MAX_TITLE).trim();
      must_haves.push({ id, text: m.text, accepted_evidence: m.accepted_evidence, ...(label !== undefined && label !== "" ? { title: label } : {}) });
      if (must_haves.length === MAX_MUST_HAVES) break;
    }
    const usable = must_haves.length > 0;
    return {
      ...withOptional(title, company, location),
      family,
      must_haves: usable ? must_haves : fallback(title, location),
      cost_usd: r.cost_usd,
      notes: usable ? [] : ["position extract: no usable LLM output, used generic fallback"],
    };
  } catch (e) {
    const title = clean(hint.title) ?? "";
    const why = e instanceof Error ? e.message : "unknown error";
    return {
      ...withOptional(title, clean(hint.company), clean(hint.location)),
      family: familyOf(title),
      must_haves: fallback(title, clean(hint.location)),
      cost_usd: 0,
      notes: [`position extract: LLM failed (${why}), used generic fallback`],
    };
  }
}
