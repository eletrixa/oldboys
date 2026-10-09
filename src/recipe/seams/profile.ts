/**
 * Profile seam: two LLM calls turn confirmed sources and kept claims into the enriched hiring profile.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/profile.ts
 * Deps:    zod, src/domain/claim, src/domain/quote, src/recipe/seams/evidence-strength, src/recipe/seams/profile-fit, src/recipe/seams/resolve, src/recipe/seams/seed, src/recipe/sources/linkedin
 * Tested:  src/recipe/__tests__/profile.test.ts
 *
 * Key responsibilities:
 * - Call 1: achievements, risks, history (jobs, education, projects, volunteering with dates)
 * - Call 2: personality (DISC, MBTI, working-style read from the person's own writing), status per must-have of the run's
 *   role, up to 10 interview questions with priority 1-3 and the risk they close
 * - Evidence gate: a line survives only when its quote is inside the excerpt of the source it names (as verify.ts);
 *   an item left with no evidence is dropped; dropped lines are counted per section for the report footer
 * - Strength per surviving line set in code (evidence-strength.ts): weak = the person wrote it, strong = independent
 * - Personality only from the person's own writing (own profile, posts, CV, or a first-person quote elsewhere);
 *   under 3 surviving lines DISC and MBTI are null and the read says so
 * - Position fit: one card, the run's role only (none without a role); traits and weights fixed in code (profile-fit.ts:
 *   brief must-haves weight 2, catalog extras weight 1); fit_pct computed here: sum(weight x status) / sum(weight)
 * - Questions: cut to the best 5 in code (profile-fit.ts `topQuestions`), never by the model
 * - Truncation guard: a failed attempt is retried once with the 40 highest-value sources before degrading
 *
 * Design constraints:
 * - Degrade, never fail: model error gives a profile with `degraded` set and empty arrays
 * - Public professional data only; no Art. 9 inference, no reputation or trust scores; personality is an inference
 */
import { z } from "zod";
import { type Candidate, type Claim, HistoryEntry, type Profile, ProfileEvidence, ProfileItem, type Source, TraitFit } from "@/domain/claim";
import { quoteInExcerpt } from "@/domain/quote";
import type { Ports } from "@/domain/ports";
import { evidenceStrength, FIRST_PERSON } from "@/recipe/seams/evidence-strength";
import { type FitTrait, fitTraits, topQuestions } from "@/recipe/seams/profile-fit";
import { confirmedSources } from "@/recipe/seams/resolve";
import { CV_ACTOR } from "@/recipe/seams/seed";
import { LINKEDIN_PROFILE_ACTORS } from "@/recipe/sources/linkedin";
import { acceptedCandidates, type StepContext } from "@/recipe/sources/types";

const PROMPT_CHARS = 60_000;
const RETRY_SOURCES = 40;
const MIN_PERSONALITY_LINES = 3;
const ASK_QUESTIONS = 10;
export const TOO_LITTLE_WRITING = "Too little of the person's own writing to estimate a type.";

const POST_ACTORS = new Set(["harvestapi/linkedin-profile-posts", "apidojo/tweet-scraper", "rest/bluesky"]);
const PRESS_ACTORS = new Set(["apify/google-search-scraper", "apify/website-content-crawler"]);
/** Sources the subject wrote: own LinkedIn profile, CV, own posts (reposts are unverified, so never confirmed). */
const OWN_WRITING = new Set([...LINKEDIN_PROFILE_ACTORS, CV_ACTOR, ...POST_ACTORS]);

const Facts = z.object({ achievements: z.array(ProfileItem), risks: z.array(ProfileItem), history: z.array(HistoryEntry) });
const Type = z.object({ type: z.string().min(1), confidence: z.enum(["low", "medium", "high"]) }).nullable();
const Reading = z.object({
  personality: z.object({ disc: Type, mbti: Type, read: z.string(), traits: z.array(ProfileItem).default([]), evidence: z.array(ProfileEvidence) }),
  // Status per trait id from the fixed list; role, labels and weights stay in code
  position_fit: z.object({ rationale: z.string().default(""), traits: z.array(z.object({ id: z.string(), status: TraitFit.shape.status, evidence: z.array(ProfileEvidence) })) }).nullable().default(null),
  // Priority loose here, clamped to 1..3 in code: an out-of-range value must not fail the whole parse
  questions: z.array(z.object({ text: z.string().min(1), closes: z.string(), priority: z.number().default(3), risk: z.string().nullable().default(null) })),
});

const RULES = [
  "Use only the listed sources and claims. Public professional data only.",
  "Every item carries evidence lines: `quote` is a verbatim substring of one listed source excerpt, `source_id` is that source's id copied exactly from the [brackets]. kind=FACT when the quote states the point, INFERENCE when the point is your reading of it. `direction`: supports, contradicts (weakens or disproves the point: include those, they are wanted) or context; supports=false exactly when direction is contradicts. `note`: where the line comes from as a recruiter would say it, e.g. \"LinkedIn experience, self-reported\". Items carry `detail`: one or two sentences under the heading, empty when the heading says it all. A line whose quote is not verbatim is deleted.",
  "Never infer or mention health, politics, religion, ethnicity, sexuality or family life. Never use the words score, rating, trust or culture fit, and never rate the person's reputation, credit or overall quality.",
].join("\n");

export function emptyProfile(degraded: string | null): Profile {
  return {
    achievements: [], risks: [], history: [], personality: { disc: null, mbti: null, read: "", traits: [], evidence: [], evidence_dropped: 0 }, position_fit: [], questions: [], degraded,
    achievements_dropped: 0, risks_dropped: 0, history_dropped: 0, fit_dropped: 0,
  };
}

/** sum(weight x status) / sum(weight), status has 1, partial 0.5, none 0, weight 1 when absent; 0 when no weight. */
export function fitPct(traits: readonly (Pick<z.infer<typeof TraitFit>, "status"> & { weight?: number })[]): number {
  const total = traits.reduce((n, t) => n + (t.weight ?? 1), 0);
  if (total === 0) return 0;
  const score = traits.reduce((n, t) => n + (t.weight ?? 1) * (t.status === "has" ? 1 : t.status === "partial" ? 0.5 : 0), 0);
  return Math.round((score / total) * 100);
}

/** Keeps evidence whose quote is inside the excerpt of the source it names (unknown ids fail); sets `strength` in code, never from the model. */
export function validEvidence(
  evidence: readonly ProfileEvidence[],
  sources: readonly Pick<Source, "id" | "excerpt" | "actor" | "url" | "identity">[],
  candidates: readonly Pick<Candidate, "profile_urls" | "handle" | "platform" | "name">[] = [],
): ProfileEvidence[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return evidence.flatMap((e) => {
    const s = byId.get(e.source_id);
    if (s === undefined || !quoteInExcerpt(e.quote, s.excerpt)) return [];
    const { strength, note } = evidenceStrength(s, e.quote, candidates, e.kind);
    const supports = e.direction === undefined ? e.supports : e.direction !== "contradicts";
    return [note === "" ? { ...e, supports, strength } : { ...e, supports, strength, note: e.note ? `${e.note}, ${note}` : note }];
  });
}

/** Profile and CV first, then own posts, then press and talks, then the rest; stable within a tier. */
export function rankSources(sources: readonly Source[]): Source[] {
  const tier = (s: Source): number => (LINKEDIN_PROFILE_ACTORS.has(s.actor) || s.actor === CV_ACTOR ? 0 : POST_ACTORS.has(s.actor) ? 1 : PRESS_ACTORS.has(s.actor) ? 2 : 3);
  return [...sources].sort((a, b) => tier(a) - tier(b));
}

/** The run's role card: every listed trait, model status per id; a trait without surviving supporting evidence is none. */
function fitCard(
  role: string,
  traits: readonly FitTrait[],
  fit: z.infer<typeof Reading>["position_fit"],
  gate: (e: readonly ProfileEvidence[]) => ProfileEvidence[],
): Profile["position_fit"][number] {
  const byId = new Map((fit?.traits ?? []).map((t) => [t.id.trim(), t]));
  const rows = traits.map((t) => {
    const m = byId.get(t.id);
    const evidence = gate(m?.evidence ?? []);
    return { trait: t.trait, weight: t.weight, evidence, status: m !== undefined && evidence.some((x) => x.supports) ? m.status : ("none" as const) };
  });
  return { role, traits: rows, fit_pct: fitPct(rows), rationale: fit?.rationale ?? "" };
}

function sourceBlock(sources: readonly Source[], claims: readonly Claim[]): string {
  let body = "";
  for (const s of sources) {
    const line = `[${s.id}] ${s.url}\n${s.excerpt}\n\n`;
    if (body.length + line.length > PROMPT_CHARS) break;
    body += line;
  }
  return `Sources:\n${body}\nVerified claims:\n${claims.map((c) => `- [${c.kind}] ${c.text}`).join("\n") || "- (none)"}`;
}

/** Two model calls over `sources`; cost and calls go into `out` once a call validates. Throws on model or parse failure. */
async function attempt(ctx: StepContext, kept: readonly Claim[], sources: readonly Source[], ports: Ports, out: { calls: number; cost_usd: number }): Promise<Profile> {
  const head = `Subject: ${ctx.subject}\nAnchor: ${ctx.anchor}\nRole: ${ctx.role ?? "(none)"}\n\nResearch questions:\n${ctx.questions.map((q) => `- ${q.id}: ${q.text}`).join("\n")}\n\n${sourceBlock(sources, kept)}`;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const merged = acceptedCandidates(ctx);
  const a = await ports.llm({
    model: "primary",
    system: [
      "Build the candidate's profile for a hiring manager: `achievements` (results the person is credited with, numbers kept), `risks` (gaps, short tenures, missing must-haves, unclear claims; each stated as a risk to check, never a judgement of the person), `history` (every job plus relevant education, projects and volunteering, newest first, `from`/`to` as written in the source or null, `location` and `duration` as written in the source or empty).",
      RULES,
    ].join("\n"),
    prompt: head,
    schema: Facts,
  });
  // Re-parsed so a malformed value degrades here; counted like the adapter, only once it validates
  const facts = Facts.parse(a.value);
  out.calls += 1;
  out.cost_usd += a.cost_usd;

  // Evidence gate: only quote-checked lines survive, so a FACT label never rides on an unverified quote
  const dropped = { achievements: 0, risks: 0, history: 0, fit: 0 };
  const gate = (e: readonly ProfileEvidence[], section: keyof typeof dropped): ProfileEvidence[] => {
    const ok = validEvidence(e, sources, merged);
    dropped[section] += e.length - ok.length;
    return ok;
  };
  const items = <T extends { evidence: ProfileEvidence[] }>(xs: readonly T[], section: keyof typeof dropped): T[] =>
    xs.map((x) => ({ ...x, evidence: gate(x.evidence, section) })).filter((x) => x.evidence.length > 0);
  const risks = items(facts.risks, "risks");
  const traits = fitTraits(ctx);
  const b = await ports.llm({
    model: "primary",
    system: [
      "Read the candidate for a hiring manager.",
      "`personality`: a working-style inference from the person's own public writing only: their LinkedIn profile text, their own posts, their CV, or a first-person quote of theirs in an interview or talk. Never from what others write about them and never from reposts. Give a DISC type and an MBTI type, each with confidence low/medium/high, `read`: their working style in two or three sentences, `traits`: working-style rows each with 2-3 of their own quotes as evidence, and `evidence`: the quotes behind the types. Use null types when their own writing is too thin.",
      traits.length === 0
        ? "`position_fit`: null."
        : `\`position_fit\`: for the role ${ctx.role ?? ""} only, one row per listed must-have id, nothing else: \`id\` copied exactly, status has/partial/none and evidence, plus a one-sentence \`rationale\`. Do not compute a percentage.`,
      `\`questions\`: up to ${String(ASK_QUESTIONS)} interview questions derived from the risks and gaps, each with \`closes\`: which gap or risk it closes, \`risk\`: the id of that risk (R1, R2...) or null for a gap, and \`priority\`: 1 when it closes a contradiction or overlapping dates, 2 when it checks a self-reported result nothing else confirms, 3 when it closes a gap on a must-have of the role.`,
      RULES,
    ].join("\n"),
    prompt: `${head}\n\nMust-haves of the role:\n${traits.map((t) => `- ${t.id}: ${t.trait}: ${t.text}`).join("\n") || "- (none)"}\n\nRisks found:\n${risks.map((r, i) => `- R${String(i + 1)}: ${r.text}`).join("\n") || "- (none)"}\n\nGaps:\n${ctx.gaps.map((g) => `- ${g.question_id}: ${g.reason}`).join("\n") || "- (none)"}`,
    schema: Reading,
  });
  const reading = Reading.parse(b.value);
  out.calls += 1;
  out.cost_usd += b.cost_usd;

  const own = (e: ProfileEvidence): boolean => {
    const s = byId.get(e.source_id);
    return s !== undefined && (OWN_WRITING.has(s.actor) || FIRST_PERSON.test(e.quote));
  };
  const ownLines = (e: readonly ProfileEvidence[]): ProfileEvidence[] => validEvidence(e, sources, merged).filter(own);
  const personality = ownLines(reading.personality.evidence);
  const traitRows = reading.personality.traits.map((t) => ({ ...t, evidence: ownLines(t.evidence) })).filter((t) => t.evidence.length > 0);
  const modelLines = reading.personality.evidence.length + reading.personality.traits.reduce((n, t) => n + t.evidence.length, 0);
  const keptLines = personality.length + traitRows.reduce((n, t) => n + t.evidence.length, 0);
  const thin = keptLines < MIN_PERSONALITY_LINES;
  const position_fit = traits.length === 0 || ctx.role === null ? [] : [fitCard(ctx.role, traits, reading.position_fit, (e) => gate(e, "fit"))];
  const riskEvidence = (q: { risk: string | null }): number => risks[Number(/^R(\d+)$/i.exec(q.risk?.trim() ?? "")?.[1] ?? 0) - 1]?.evidence.length ?? 0;
  const questions = topQuestions(
    reading.questions.map((q) => ({ ...q, priority: Math.min(3, Math.max(1, Math.round(q.priority))) })),
    riskEvidence,
  ).map(({ text, closes }) => ({ text, closes }));
  return {
    achievements: items(facts.achievements, "achievements"),
    risks,
    history: items(facts.history, "history"),
    personality: {
      disc: thin ? null : reading.personality.disc,
      mbti: thin ? null : reading.personality.mbti,
      read: thin ? `${reading.personality.read} ${TOO_LITTLE_WRITING}`.trim() : reading.personality.read,
      traits: traitRows,
      evidence: personality,
      evidence_dropped: modelLines - keptLines,
    },
    position_fit,
    questions,
    degraded: null,
    achievements_dropped: dropped.achievements,
    risks_dropped: dropped.risks,
    history_dropped: dropped.history,
    fit_dropped: dropped.fit,
  };
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 120);

/** Two model calls, retried once over the 40 highest-value sources (truncated output); cost and calls go into `out`. Never throws. */
export async function buildProfile(
  ctx: StepContext,
  kept: readonly Claim[],
  ports: Ports,
  out: { calls: number; cost_usd: number; notes: string[] },
): Promise<Profile> {
  const sources = rankSources(confirmedSources(ctx));
  if (sources.length === 0 || kept.length === 0) return emptyProfile("no verified claims");
  try {
    return await attempt(ctx, kept, sources, ports, out);
  } catch (first) {
    out.notes.push(`profile retry with top ${String(RETRY_SOURCES)} sources: ${message(first)}`);
    try {
      return await attempt(ctx, kept, sources.slice(0, RETRY_SOURCES), ports, out);
    } catch (error) {
      const msg = `profile model failed: ${message(error)}`;
      out.notes.push(msg);
      return emptyProfile(msg);
    }
  }
}
