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
 * - textsHash: SHA-256 over PROMPT_VERSION, the ids and the texts; it changes when the brief, its claims or the prompt
 *   change, so a cached translation of an older brief or an older prompt is never served
 * - translationKey: the deterministic R2 key of the cached translation (`translations/<runId>/brief-<lang>.json`)
 * - translationBatches: the texts cut into batches (TRANSLATE_BATCH_CHARS English characters, TRANSLATE_BATCH_TEXTS
 *   texts, a text is never split, order kept) so each model call stays well under the adapter's output cap
 * - translatePrompt + TranslationOutput: one strict prompt per batch and its output schema (same ids back); the system
 *   prompt (rules, fixed glossary, date style, few-shot examples) is identical for every batch so terms never drift
 * - protectMarkers / restoreMarkers: the kind markers FACT: / INFERENCE: / STATEMENT: inside section summaries go to
 *   the model as ⟦FACT⟧-style placeholders and come back as the pill words (KIND_MARKERS_CS: FAKT, ODVOZENÍ, VÝROK)
 * - mergeTranslation: keeps only known ids with a usable text; a text that touches a GDPR Art. 9 topic while its
 *   English source did not, grew out of proportion, lost or changed a kind placeholder, or lost an English job title
 *   noun (jobTitleNouns: "Owner of …", "Board Advisor at …") falls back to English
 * - estimateTranslateUsd + TRANSLATE_BUDGET_USD: the translation (all batches, each with its system prompt) is refused
 *   before any call when it could cost more
 * - failedCallCost: what a failed model call still cost, when its error carries `cost_usd` (src/adapters/llm.ts)
 *
 * Design constraints:
 * - Pure: no I/O; the route (src/app/api/runs/[id]/translate/handler.ts) does the R2, D1 and LLM work
 * - The prompt adds nothing and drops nothing; quotes, names and URLs never reach it (the collector leaves them out)
 * - Any change to SYSTEM, EXAMPLES or the marker handling bumps PROMPT_VERSION
 * - KIND_MARKERS_CS stays equal to the uppercased cs kind pills of REPORT_DICT (a test checks it)
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
/** JSON framing of one call, in tokens; the system prompt is counted from its length (prompt grows, estimate grows). */
const FRAME_TOKENS = 150;
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

/** SHA-256 over the prompt version, the ids and the texts. */
export async function textsHash(texts: readonly ReportText[], promptVersion: string = PROMPT_VERSION): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([promptVersion, ...texts.map((t) => [t.id, t.text])]));
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
  const inTokens = chars / 4 + (SYSTEM.length / 4 + FRAME_TOKENS) * translationBatches(texts).length;
  return inTokens * IN_USD + (chars / 4) * OUT_FACTOR * OUT_USD;
}

/** USD a failed model call still cost: the adapter puts `cost_usd` on the error when the provider reported usage. */
export function failedCallCost(error: unknown): number {
  if (typeof error !== "object" || error === null || !("cost_usd" in error)) return 0;
  const cost = error.cost_usd;
  return typeof cost === "number" && Number.isFinite(cost) && cost > 0 ? cost : 0;
}

/**
 * Bumped whenever SYSTEM, the few-shot examples or the marker handling change: it is part of textsHash, so a
 * translation cached with an older prompt is made again once.
 */
export const PROMPT_VERSION = "cs-2";

/** The claim kinds as synthesize writes them inside section summaries ("FACT: … INFERENCE: …"). */
export const KIND_MARKERS = ["FACT", "INFERENCE", "STATEMENT"] as const;
export type KindMarker = (typeof KIND_MARKERS)[number];

/** The Czech words, uppercase, the same as the kind pills (REPORT_DICT cs `kind` in src/app/runs/[id]/i18n.ts). */
export const KIND_MARKERS_CS: Record<KindMarker, string> = { FACT: "FAKT", INFERENCE: "ODVOZENÍ", STATEMENT: "VÝROK" };

const placeholder = (m: KindMarker): string => `⟦${m}⟧`;

/** A marker at the start of a text or after sentence punctuation / a line break, as synthesize writes them. */
const MARKER_RE = /(^|[.!?…;)]\s+|\n\s*)(FACT|INFERENCE|STATEMENT):/g;
const PLACEHOLDER_RE = /⟦(FACT|INFERENCE|STATEMENT)⟧:?/g;

/** "FACT: x. INFERENCE: y" → "⟦FACT⟧ x. ⟦INFERENCE⟧ y": the model never chooses its own word for a kind. */
export function protectMarkers(text: string): string {
  return text.replace(MARKER_RE, (_m, lead: string, kind: KindMarker) => `${lead}${placeholder(kind)}`);
}

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/⟦[^⟧]*⟧/g)].map((m) => m[0]);
}

/** "⟦INFERENCE⟧ y" → "ODVOZENÍ: y" (a colon the model added after the placeholder is not doubled). */
export function restoreMarkers(text: string): string {
  return text.replace(PLACEHOLDER_RE, (_m, kind: KindMarker) => `${KIND_MARKERS_CS[kind]}:`);
}

/**
 * Title nouns a job title ends with; only a capitalised one right before " at " / " @ " / " of " counts, so
 * "Graduated at" or "University of" never do. Nouns that often stand for a plain word (Member, Host, Editor) are left out.
 */
const TITLE_NOUNS =
  "Advisor|Adviser|Owner|Founder|Co-founder|Cofounder|CEO|CTO|CFO|COO|CPO|CMO|CIO|VP|President|Partner|Director|Manager|Head|Lead|Engineer|Developer|Architect|Designer|Consultant|Analyst|Scientist|Researcher|Officer|Specialist|Chairman|Principal|Intern|Freelancer|Recruiter|Maintainer|Programmer|Administrator|Coordinator|Strategist|Evangelist";
const TITLE_RE = new RegExp(`(?<![\\w-])(${TITLE_NOUNS})(?=\\s+(?:at|@|of)\\s)`, "g");

/**
 * The title nouns of the English job titles written before " at " / " @ " / " of " ("Board Advisor at snuggs" →
 * "Advisor", "Owner of Naveky.cz" → "Owner"). A Czech text that lost one translated the title, so it falls back.
 */
export function jobTitleNouns(text: string): string[] {
  return [...new Set([...text.matchAll(TITLE_RE)].map((m) => m[0]))];
}

const EXAMPLES: readonly { en: string; cs: string }[] = [
  {
    en: "Board Advisor at snuggs since Mar 2021; Owner of Naveky.cz from Mar 2021 to Nov 2025.",
    cs: "Board Advisor ve společnosti snuggs od března 2021; Owner ve společnosti Naveky.cz od března 2021 do listopadu 2025.",
  },
  {
    en: "Co-founder & CEO at Acme s.r.o. (Oct 2022 – May 2026), self-reported on LinkedIn.",
    cs: "Co-founder & CEO ve společnosti Acme s.r.o. (říjen 2022 – květen 2026), uvedeno samotnou osobou na LinkedIn.",
  },
  {
    en: "⟦FACT⟧ The repository acme-ui has 120 stars. ⟦INFERENCE⟧ The candidate probably leads its frontend work.",
    cs: "⟦FACT⟧ Repozitář acme-ui má 120 hvězdiček. ⟦INFERENCE⟧ Kandidát či kandidátka pravděpodobně vede jeho frontendovou část.",
  },
  {
    en: "No evidence for the role criterion; to verify in the interview. The source is a mirror site.",
    cs: "Ke kritériu pozice chybí doklad; k ověření u pohovoru. Zdroj je zrcadlová stránka.",
  },
];

/** The same system prompt for every batch: one glossary and one style, so parallel batches never drift apart. */
const SYSTEM = [
  "You translate the texts of a hiring research brief from English into Czech for HR staff in a Czech company.",
  "Rules:",
  "- Translate faithfully into natural, formal Czech. Use gender-neutral wording for the person (avoid forms that assume a gender; prefer neutral nouns and constructions). Write \"kandidát či kandidátka\" only where the English says \"the candidate\"; otherwise keep the person's name as written.",
  "- Keep names of people, companies, products, projects, repositories, podcasts and technologies, numbers and URLs exactly as they are.",
  "- Job titles and role names stay exactly as written in English (e.g. \"Board Advisor\", \"Owner\", \"Managing Partner\", \"Co-founder & CEO\", \"Senior Frontend Engineer\"). Never translate them and never turn them into another word (\"Owner of X\" is \"Owner ve společnosti X\", never \"Vlastnictví X\"). Attach them with natural Czech prepositions: \"X at Y\" → \"X ve společnosti Y\" (or \"X v Y\"), \"X of Y\" → \"X ve společnosti Y\".",
  "- Glossary, always the same word: evidence → doklad; claim → tvrzení; source → zdroj; role criteria → kritéria pozice; interview → pohovor; to verify → k ověření; self-reported → uvedeno samotnou osobou; mirror site → zrcadlová stránka.",
  "- Dates: month names written out in Czech, no abbreviations, no numeric months. A range is \"říjen 2022 – květen 2026\" (spaced en dash); \"from Oct 2022 to May 2026\" is \"od října 2022 do května 2026\"; \"since Mar 2021\" is \"od března 2021\"; a single month is \"květen 2026\"; a year alone stays a number.",
  "- Placeholders like ⟦FACT⟧, ⟦INFERENCE⟧ and ⟦STATEMENT⟧ stay exactly as they are, in the same place and order. Do not translate, remove, add or change them.",
  "- Add nothing and drop nothing: every fact, number, date and hedge (\"probably\", \"may\", \"not confirmed\") stays. Do not explain, soften, sharpen or summarise.",
  "- Never add a judgement of the person, a score, or anything about health, religion, politics, ethnicity, sexuality or union membership.",
  "- Text in quotation marks taken from a source stays as it is.",
  '- Return JSON {"texts":[{"id","text"}]} with exactly the ids you were given, one entry per id.',
  "Examples (English → Czech):",
  ...EXAMPLES.map((e) => `EN: ${e.en}\nCS: ${e.cs}`),
].join("\n");

/** The texts go to the model with their kind markers as placeholders; the system prompt is the same for every batch. */
export function translatePrompt(texts: readonly ReportText[]): { system: string; prompt: string } {
  const protectedTexts = texts.map((t) => ({ id: t.id, text: protectMarkers(t.text) }));
  return { system: SYSTEM, prompt: `Translate the "text" of each entry into Czech:\n${JSON.stringify(protectedTexts)}` };
}

/** A translation longer than this many times its source (plus slack) is not a translation. */
const MAX_GROWTH = 3;
const GROWTH_SLACK = 200;

/**
 * id → Czech text for the ids the brief has. Unknown and duplicate ids are ignored; a missing id, an empty text,
 * an out-of-proportion text, a new Art. 9 topic, a kind placeholder missing, changed or reordered, or an English job
 * title of the source missing from the Czech text leaves the id out, so the page shows the English text. Kept
 * placeholders become the dictionary words (KIND_MARKERS_CS).
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
    if (placeholdersIn(cs).join() !== placeholdersIn(protectMarkers(en)).join()) continue;
    if (jobTitleNouns(en).some((noun) => !cs.includes(noun))) continue;
    merged[id] = restoreMarkers(cs);
  }
  return merged;
}
