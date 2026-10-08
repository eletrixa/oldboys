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
 * - `positionDedupKey`: grouping key from company, title and location
 *
 * Design constraints:
 * - Pure, no I/O; imports nothing from src/recipe except the `Question` type
 * - At most 5 must-haves; every must-have id starts with `mh-` so ids never collide with the base hiring ids
 */
import { z } from "zod";
import { roleKey } from "@/domain/role-overview";
import type { Question } from "@/recipe/step";

const MAX_TEXT = 160;
const MAX_TITLE = 48;

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

export const MustHaves = z.array(MustHave).max(5);

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
  ingest_method: z.enum(["pasted", "jobs-cz", "greenhouse", "lever", "ashby", "jsonld"]),
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
  return position.must_haves.slice(0, 5).map((m) => {
    const title = m.title?.trim().slice(0, MAX_TITLE).trim();
    return { id: m.id, text: fitQuestionText(m.text, m.accepted_evidence), ...(title !== undefined && title !== "" ? { title } : {}) };
  });
}

export function positionDedupKey(company: string | undefined, title: string, location: string | undefined): string {
  return `${roleKey(company ?? "")}|${roleKey(title)}|${roleKey(location ?? "")}`;
}
