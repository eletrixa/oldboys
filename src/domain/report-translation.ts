/**
 * Report translation (idea #24): the pure rules for translating a finished brief's own texts into Czech on demand.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/report-translation.ts
 * Deps:    zod, src/domain/art9 (containsArt9Topic)
 * Tested:  src/domain/__tests__/report-translation.test.ts
 *
 * Key responsibilities:
 * - ReportText `{ id, text }`: one English text of the brief with a stable id (collected by src/app/runs/[id]/report-text.ts)
 * - textsHash: SHA-256 over the ids and texts; it changes when the brief or its claims change, so a cached
 *   translation of an older brief is never served
 * - translationKey: the deterministic R2 key of the cached translation (`translations/<runId>/brief-<lang>.json`)
 * - translationBatches: the texts cut into batches (TRANSLATE_BATCH_CHARS English characters, TRANSLATE_BATCH_TEXTS
 *   texts, a text is never split, order kept) so each model call stays well under the adapter's output cap
 * - translatePrompt + TranslationOutput: one strict prompt per batch and its output schema (same ids back)
 * - mergeTranslation: keeps only known ids with a usable text; a text that touches a GDPR Art. 9 topic while its
 *   English source did not (or grew out of proportion) falls back to English
 * - estimateTranslateUsd + TRANSLATE_BUDGET_USD: the translation (all batches, each with its system prompt) is refused
 *   before any call when it could cost more
 * - failedCallCost: what a failed model call still cost, when its error carries `cost_usd` (src/adapters/llm.ts)
 *
 * Design constraints:
 * - Pure: no I/O; the route (src/app/api/runs/[id]/translate/handler.ts) does the R2, D1 and LLM work
 * - The prompt adds nothing and drops nothing; quotes, names and URLs never reach it (the collector leaves them out)
 */
import { z } from "zod";
import { containsArt9Topic } from "./art9";

export type TranslationLang = "cs";

export type ReportText = { id: string; text: string };

/** Ledger step of the translation call; its time is not research time (src/domain/run-cost.ts). */
export const TRANSLATE_STEP = "translate";

/** Most one translation may cost (USD), all batches together; a brief whose estimate is higher is not translated. */
export const TRANSLATE_BUDGET_USD = 0.12;

/**
 * One batch holds at most this many English characters and texts (about 1.5k Czech output tokens with ids and JSON,
 * far under the adapter's output cap) and a call takes seconds, not minutes; one longer text gets a batch of its own.
 */
export const TRANSLATE_BATCH_CHARS = 2500;
export const TRANSLATE_BATCH_TEXTS = 20;
/** Batches translated at the same time (Workers allow 6 outbound connections). */
export const TRANSLATE_CONCURRENCY = 4;

/** Sonnet list price per token (src/adapters/llm.ts), the `verify` model the translation uses. */
const IN_USD = 2 / 1_000_000;
const OUT_USD = 10 / 1_000_000;
/** System prompt and JSON framing, in tokens. */
const PROMPT_TOKENS = 600;
/** Czech output plus ids and JSON costs about this many tokens per English input token. */
const OUT_FACTOR = 2.5;

export const TranslateBody = z.object({ lang: z.literal("cs") });

export const TranslationOutput = z.object({ texts: z.array(z.object({ id: z.string(), text: z.string() })) });
export type TranslationOutput = z.infer<typeof TranslationOutput>;

/** What the R2 cache object holds: the language, the hash of the English texts it translated, and id → text. */
export const CachedTranslation = z.object({
  lang: z.literal("cs"),
  brief_hash: z.string().min(1),
  texts: z.record(z.string(), z.string()),
});
export type CachedTranslation = z.infer<typeof CachedTranslation>;

export function translationKey(runId: string, lang: TranslationLang): string {
  return `translations/${runId}/brief-${lang}.json`;
}

/** Every cached translation a run can have; deleteRunData removes them with the run. */
export function translationKeys(runId: string): string[] {
  return [translationKey(runId, "cs")];
}

export async function textsHash(texts: readonly ReportText[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(texts.map((t) => [t.id, t.text])));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The texts in order, cut into batches of at most `maxChars` characters and `maxTexts` texts; a text is never split. */
export function translationBatches(
  texts: readonly ReportText[],
  maxChars = TRANSLATE_BATCH_CHARS,
  maxTexts = TRANSLATE_BATCH_TEXTS,
): ReportText[][] {
  const batches: ReportText[][] = [];
  let current: ReportText[] = [];
  let chars = 0;
  for (const t of texts) {
    if (current.length > 0 && (current.length >= maxTexts || chars + t.text.length > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(t);
    chars += t.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Upper estimate of the whole translation in USD (about 4 characters per token, the system prompt once per batch). */
export function estimateTranslateUsd(texts: readonly ReportText[]): number {
  const chars = texts.reduce((n, t) => n + t.text.length + t.id.length, 0);
  const inTokens = chars / 4 + PROMPT_TOKENS * translationBatches(texts).length;
  return inTokens * IN_USD + (chars / 4) * OUT_FACTOR * OUT_USD;
}

/** USD a failed model call still cost: the adapter puts `cost_usd` on the error when the provider reported usage. */
export function failedCallCost(error: unknown): number {
  if (typeof error !== "object" || error === null || !("cost_usd" in error)) return 0;
  const cost = error.cost_usd;
  return typeof cost === "number" && Number.isFinite(cost) && cost > 0 ? cost : 0;
}

const SYSTEM = [
  "You translate the texts of a hiring research brief from English into Czech for HR staff in a Czech company.",
  "Rules:",
  "- Translate faithfully into natural, formal Czech. Use gender-neutral wording for the person (avoid forms that assume a gender; prefer neutral nouns and constructions).",
  "- Keep names of people, companies, products, projects and technologies, numbers, dates and URLs exactly as they are.",
  "- Add nothing and drop nothing. Do not explain, soften, sharpen or summarise.",
  "- Never add a judgement of the person, a score, or anything about health, religion, politics, ethnicity, sexuality or union membership.",
  "- Text in quotation marks taken from a source stays as it is.",
  '- Return JSON {"texts":[{"id","text"}]} with exactly the ids you were given, one entry per id.',
].join("\n");

export function translatePrompt(texts: readonly ReportText[]): { system: string; prompt: string } {
  return { system: SYSTEM, prompt: `Translate the "text" of each entry into Czech:\n${JSON.stringify(texts)}` };
}

/** A translation longer than this many times its source (plus slack) is not a translation. */
const MAX_GROWTH = 3;
const GROWTH_SLACK = 200;

/**
 * id → Czech text for the ids the brief has. Unknown and duplicate ids are ignored; a missing id, an empty text,
 * an out-of-proportion text or a new Art. 9 topic leaves the id out, so the page shows the English text.
 */
export function mergeTranslation(source: readonly ReportText[], output: TranslationOutput): Record<string, string> {
  const english = new Map(source.map((t) => [t.id, t.text]));
  const merged: Record<string, string> = {};
  for (const { id, text } of output.texts) {
    const en = english.get(id);
    const cs = text.trim();
    if (en === undefined || id in merged || cs === "") continue;
    if (cs.length > en.length * MAX_GROWTH + GROWTH_SLACK) continue;
    if (containsArt9Topic(cs) && !containsArt9Topic(en)) continue;
    merged[id] = cs;
  }
  return merged;
}
