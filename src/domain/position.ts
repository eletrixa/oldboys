/**
 * Position aggregate: schema, role family, must-have projection to run questions, dedupe key.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/position.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/position.test.ts
 *
 * Key responsibilities:
 * - `Family`, `MustHave`, `MustHaves`, `Position` Zod schemas (spec: specs/positions-domain.md)
 * - `fitQuestionText`: the one question-text formatter, shared with the role seam
 * - `mustHavesToQuestions`: must-haves become the run's question list, same shape as `roleQuestions` output
 * - `shapeMustHaves` / `fallbackMustHaves` / `parseMustHaves`: the one shaping, generic set and stored-JSON reader
 * - `INGEST_METHODS`, `POSITION_ID`, `PositionListItem`, `errorMessage`: shared names for the ingest path and the pages
 *
 * Design constraints:
 * - Pure, no I/O; imports nothing from src/recipe except the `Question` type
 * - At most 5 must-haves; every must-have id starts with `mh-` so ids never collide with the base hiring ids
 */
import { z } from "zod";
import type { Question } from "@/recipe/step";

const MAX_TEXT = 160;
const MAX_TITLE = 48;
export const MAX_MUST_HAVES = 5;

export const INGEST_METHODS = ["pasted", "manual", "jobs-cz", "startupjobs", "greenhouse", "lever", "ashby", "jsonld"] as const;
export type IngestMethod = (typeof INGEST_METHODS)[number];

export const POSITION_ID = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

/** Ids the base hiring recipe owns; a must-have id never equals one of them. */
export const BASE_IDS: ReadonlySet<string> = new Set(["current-role", "career-history", "public-code", "public-talks", "location-match", "contradictions"]);

export function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : "unknown error");

export const FAMILIES = ["engineering", "data", "product", "design", "marketing", "sales", "operations", "finance", "people", "other"] as const;
export const Family = z.enum(FAMILIES);
export type Family = z.infer<typeof Family>;

export const MustHave = z.object({
  id: z.string().startsWith("mh-"),
  text: z.string().min(1),
  title: z.string().optional(),
  accepted_evidence: z.array(z.string()),
});
export type MustHave = z.infer<typeof MustHave>;

export const MustHaves = z.array(MustHave).max(MAX_MUST_HAVES);

export const Position = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(300),
  family: Family,
  company: z.string().optional(),
  location: z.string().optional(),
  board: z.string().optional(),
  posting_url: z.string().optional(),
  external_id: z.string().optional(),
  must_haves: MustHaves,
  excerpt: z.string(),
  ingest_method: z.enum(INGEST_METHODS),
  extraction: z.enum(["model", "fallback", "edited"]),
  ingest_cost_usd: z.number().min(0),
  created_at: z.string(),
  expires_at: z.string(),
});
export type Position = z.infer<typeof Position>;

/** `text (ev1, ev2)`, cut at 160 chars with a trailing ellipsis. */
export function fitQuestionText(text: string, evidence: string[]): string {
  const full = evidence.length ? `${text} (${evidence.join(", ")})` : text;
  return full.length <= MAX_TEXT ? full : `${full.slice(0, MAX_TEXT - 1)}…`;
}

export function mustHavesToQuestions(position: Pick<Position, "must_haves">): Question[] {
  return position.must_haves.map((m) => {
    const title = m.title?.trim().slice(0, MAX_TITLE).trim();
    return { id: m.id, text: fitQuestionText(m.text, m.accepted_evidence), ...(title !== undefined && title !== "" ? { title } : {}) };
  });
}

/** Stored `must_haves_json` back to must-haves; null on bad JSON or a shape mismatch. */
export function parseMustHaves(json: unknown): MustHave[] | null {
  try {
    const r = MustHaves.safeParse(JSON.parse(String(json)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Model output to valid must-haves: kebab `mh-` ids, no base ids, no duplicates, title cut to 48, at most 5. */
export function shapeMustHaves(raw: readonly { id: string; text: string; title?: string | undefined; accepted_evidence: string[] }[]): MustHave[] {
  const seen = new Set<string>();
  const out: MustHave[] = [];
  for (const m of raw) {
    const id = kebab(m.id);
    if (!id.startsWith("mh-") || BASE_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    const title = m.title?.trim().slice(0, MAX_TITLE).trim();
    out.push({ id, text: m.text, accepted_evidence: m.accepted_evidence, ...(title !== undefined && title !== "" ? { title } : {}) });
    if (out.length === MAX_MUST_HAVES) break;
  }
  return out;
}

/** The three generic must-haves used when the model is unavailable or yields nothing usable. */
export function fallbackMustHaves(label: string, where: string | null): MustHave[] {
  const l = label === "" ? "this role" : label;
  return [
    { id: "mh-title-experience", title: "Role experience", text: `Has held a ${l} position or equivalent`, accepted_evidence: ["job history", "profile"] },
    { id: "mh-public-work", title: "Public work", text: `Has public work showing ${l} skills`, accepted_evidence: ["repo", "talk", "article", "portfolio"] },
    { id: "mh-location-fit", title: "Location fit", text: `Location compatible with ${where ?? "the role"}`, accepted_evidence: ["profile location"] },
  ];
}

export type PositionListItem = Pick<Position, "id" | "title" | "family" | "ingest_method" | "created_at" | "expires_at"> & {
  company: string | null;
  location: string | null;
  posting_url: string | null;
  runs: number;
};
