/**
 * Personality seam: the working-style read (DISC, MBTI, Big Five lean, traits, recommendations) from the person's own
 * writing only, gated in code so every surviving line is a verbatim quote of something they wrote.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/personality.ts
 * Deps:    zod, src/domain/claim (schemas), src/domain/ports (LlmCall), ./profile-gate (validEvidence, rankSources, OWN_WRITING), ./evidence-strength (FIRST_PERSON)
 * Tested:  src/recipe/__tests__/personality.test.ts
 *
 * Key responsibilities:
 * - PERSONALITY_PROMPT: the shared instruction block (profile.ts call 2 and the rebuild route use the same words)
 * - gatePersonality: keeps only lines whose quote sits in a source the subject wrote (own profile, CV, own posts; a
 *   retweet never counts) or a first-person quote elsewhere; under MIN_PERSONALITY_LINES the types and Big Five are
 *   null and the read says so. The floor lives here, not in the model: the prompt asks for both types whenever the
 *   person's own writing is there at all (low confidence when thin), so the gate is the only thing that withholds them
 * - ModelPersonality: the loose model-side schema (strings, no defaults) so the compiled output grammar stays small;
 *   normalisePersonality clamps it into PersonalityReading
 * - personalityCall: one `primary` call over a prompt head (profile seam call 3 and the rebuild route); readPersonality
 *   builds the head from a run's ranked sources (rebuild route)
 *
 * Design constraints:
 * - Big Five: a lean (low / balanced / high) per dimension plus a 0..100 marker for the chart; the UI never prints the
 *   number as a score. A dimension without a surviving quote is dropped, never shown on a bare opinion
 * - No Art. 9 inference; the model is told so and the quotes are the only carrier of any claim
 */
import { z } from "zod";
import { BIG_FIVE, BigFive, type BigFiveDimension, type Candidate, type Profile, ProfileEvidence, ProfileItem, type Source } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { FIRST_PERSON } from "@/recipe/seams/evidence-strength";
import { isRepost, OWN_WRITING, rankSources, sourceBlock, validEvidence } from "@/recipe/seams/profile-gate";

export const MIN_PERSONALITY_LINES = 3;
export const TOO_LITTLE_WRITING = "Too little of the person's own writing to estimate a type.";

const Confidence = z.enum(["low", "medium", "high"]);
const Type = z.object({ type: z.string().min(1), confidence: Confidence }).nullable();
/** Model-side evidence line: no enums and no defaults, so the compiled output grammar stays small (Anthropic rejects a large one). */
const Line = z.object({ quote: z.string(), source_id: z.string(), kind: z.string(), supports: z.boolean(), direction: z.string().nullable(), note: z.string().nullable() });
const Row = z.object({ text: z.string(), detail: z.string().nullable(), evidence: z.array(Line) });
/** What the model returns; `PersonalityReading` (below) is the normalised form every caller gates. */
export const ModelPersonality = z.object({
  disc: Type,
  mbti: Type,
  big5: z
    .object({
      traits: z.array(z.object({ dimension: z.string(), lean: z.string(), position: z.number(), confidence: z.string(), summary: z.string(), evidence: z.array(Line) })),
      recommendations: z.array(z.object({ text: z.string(), dimension: z.string().nullable() })),
    })
    .nullable(),
  read: z.string(),
  traits: z.array(Row),
  evidence: z.array(Line),
});
export type ModelPersonality = z.infer<typeof ModelPersonality>;

export const PersonalityReading = z.object({
  disc: Type,
  mbti: Type,
  big5: BigFive.nullable().default(null),
  read: z.string(),
  traits: z.array(ProfileItem).default([]),
  evidence: z.array(ProfileEvidence),
});
export type PersonalityReading = z.infer<typeof PersonalityReading>;

const DIM = new Set<string>(BIG_FIVE);
const level = (v: string): "low" | "medium" | "high" => (v === "high" || v === "medium" ? v : "low");
const line = (e: z.infer<typeof Line>): ProfileEvidence => ({
  quote: e.quote,
  source_id: e.source_id,
  kind: e.kind === "FACT" ? "FACT" : "INFERENCE",
  supports: e.supports,
  direction: e.direction === "contradicts" || e.direction === "context" ? e.direction : "supports",
  note: e.note ?? "",
  strength: "weak",
});
const row = (r: z.infer<typeof Row>): ProfileItem => ({ text: r.text, detail: r.detail ?? "", evidence: r.evidence.map(line) });

/** The model's loose shapes into the typed reading: unknown dimensions dropped, leans and confidences clamped, positions clamped to 0..100. */
export function normalisePersonality(m: ModelPersonality): PersonalityReading {
  const big5 =
    m.big5 === null
      ? null
      : {
          traits: m.big5.traits.flatMap((t) =>
            DIM.has(t.dimension)
              ? [
                  {
                    dimension: t.dimension as BigFiveDimension,
                    lean: t.lean === "high" ? ("high" as const) : t.lean === "low" ? ("low" as const) : ("balanced" as const),
                    position: Math.min(100, Math.max(0, Math.round(t.position))),
                    confidence: level(t.confidence),
                    summary: t.summary,
                    evidence: t.evidence.map(line),
                  },
                ]
              : [],
          ),
          recommendations: m.big5.recommendations.map((r) => ({ text: r.text, dimension: r.dimension !== null && DIM.has(r.dimension) ? (r.dimension as BigFiveDimension) : null })),
        };
  return { disc: m.disc, mbti: m.mbti, big5, read: m.read, traits: m.traits.map(row), evidence: m.evidence.map(line) };
}

/** First line of the personality call's system prompt; test fakes route on it. */
export const PERSONALITY_SYSTEM = "Read the candidate's working style for a hiring manager.";
export const PERSONALITY_PROMPT = [
  "`personality`: a working-style inference from the person's own public writing only: their LinkedIn profile text, their own posts, their CV, or a first-person quote of theirs in an interview or talk. Never from what others write about them and never from reposts.",
  "Give a DISC type and an MBTI type, each with confidence low/medium/high; `read`: their working style in two or three sentences; `traits`: working-style rows each with 2-3 of their own quotes as evidence; `evidence`: the quotes behind the types.",
  "`big5`: the Big Five as a lean per dimension (openness, conscientiousness, extraversion, agreeableness, neuroticism): `lean` low/balanced/high, `position` 0-100 along the dimension (50 = balanced), `confidence`, `summary` (one or two sentences on what their writing shows) and 2-4 of their own quotes as evidence, kind INFERENCE unless the quote states the point. Then `recommendations`: 3-5 lines on how to work with and interview them given the read, each naming the dimension it follows from.",
  "Always give both types when at least three lines of their own writing are listed, even from a profile headline, an About text, a CV or a couple of posts: say confidence low when the writing is thin and let the quotes carry the doubt. Leave the types and big5 null only when nothing they wrote themselves is listed, or only reposts (\"RT @\") of other people's words.",
].join(" ");

/** Lines from the subject's own writing (own sources or first-person quotes), quote-checked. */
export function gatePersonality(
  reading: PersonalityReading,
  sources: readonly Pick<Source, "id" | "excerpt" | "actor" | "url" | "identity">[],
  merged: readonly Pick<Candidate, "profile_urls" | "handle" | "platform" | "name">[],
): Profile["personality"] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const own = (e: ProfileEvidence): boolean => {
    const s = byId.get(e.source_id);
    return s !== undefined && !isRepost(s.excerpt) && (OWN_WRITING.has(s.actor) || FIRST_PERSON.test(e.quote));
  };
  const ownLines = (e: readonly ProfileEvidence[]): ProfileEvidence[] => validEvidence(e, sources, merged).filter(own);
  const count = (rows: readonly { evidence: readonly ProfileEvidence[] }[]): number => rows.reduce((n, r) => n + r.evidence.length, 0);

  const evidence = ownLines(reading.evidence);
  const traits = reading.traits.map((t) => ({ ...t, evidence: ownLines(t.evidence) })).filter((t) => t.evidence.length > 0);
  const big5Traits = (reading.big5?.traits ?? []).map((t) => ({ ...t, evidence: ownLines(t.evidence) })).filter((t) => t.evidence.length > 0);
  const modelLines = reading.evidence.length + count(reading.traits) + count(reading.big5?.traits ?? []);
  const keptLines = evidence.length + count(traits) + count(big5Traits);
  const thin = keptLines < MIN_PERSONALITY_LINES;
  const big5 = thin || reading.big5 === null || big5Traits.length === 0 ? null : { traits: big5Traits, recommendations: reading.big5.recommendations };
  return {
    disc: thin ? null : reading.disc,
    mbti: thin ? null : reading.mbti,
    big5,
    read: thin ? `${reading.read} ${TOO_LITTLE_WRITING}`.trim() : reading.read,
    traits,
    evidence,
    evidence_dropped: modelLines - keptLines,
  };
}

export type PersonalityInput = {
  subject: string;
  anchor: string;
  role: string | null;
  sources: readonly Source[];
  merged: readonly Candidate[];
};

/** One `primary` call over an already built prompt head (profile seam call 3 and the rebuild route); throws on model or parse failure. */
export async function personalityCall(
  head: string,
  sources: readonly Pick<Source, "id" | "excerpt" | "actor" | "url" | "identity">[],
  merged: readonly Pick<Candidate, "profile_urls" | "handle" | "platform" | "name">[],
  llm: LlmCall,
): Promise<{ personality: Profile["personality"]; cost_usd: number }> {
  const r = await llm({
    model: "primary",
    system: [PERSONALITY_SYSTEM, PERSONALITY_PROMPT, PERSONALITY_RULES].join("\n"),
    prompt: head,
    schema: z.object({ personality: ModelPersonality }),
  });
  const reading = normalisePersonality(ModelPersonality.parse(r.value.personality));
  return { personality: gatePersonality(reading, sources, merged), cost_usd: r.cost_usd };
}

/** The rebuild route: rank the run's sources, build the head, one call. */
export function readPersonality(input: PersonalityInput, llm: LlmCall): Promise<{ personality: Profile["personality"]; cost_usd: number }> {
  const sources = rankSources(input.sources);
  const head = `Subject: ${input.subject}\nAnchor: ${input.anchor}\nRole: ${input.role ?? "(none)"}\n\n${sourceBlock(sources, [])}`;
  return personalityCall(head, sources, input.merged, llm);
}

export const PERSONALITY_RULES = [
  "Use only the listed sources. Public professional data only.",
  "Every evidence line: `quote` is a verbatim substring of one listed source excerpt, `source_id` is that source's id copied exactly from the [brackets]. kind=FACT when the quote states the point, INFERENCE when the point is your reading of it; `direction` supports, contradicts or context; supports=false exactly when direction is contradicts; `note`: where the line comes from as a recruiter would say it.",
  "Never infer or mention health, politics, religion, ethnicity, sexuality or family life. Never use the words score, rating, trust or culture fit, and never rate the person's reputation, credit or overall quality.",
].join("\n");
