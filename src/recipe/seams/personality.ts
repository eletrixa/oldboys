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
 * - gatePersonality: keeps only lines whose quote sits in a source the subject wrote (own profile, CV, own posts) or a
 *   first-person quote elsewhere; under MIN_PERSONALITY_LINES the types and Big Five are null and the read says so
 * - readPersonality: one `primary` call over the ranked sources for a run that already has its brief (rebuild route)
 *
 * Design constraints:
 * - Big Five: a lean (low / balanced / high) per dimension plus a 0..100 marker for the chart; the UI never prints the
 *   number as a score. A dimension without a surviving quote is dropped, never shown on a bare opinion
 * - No Art. 9 inference; the model is told so and the quotes are the only carrier of any claim
 */
import { z } from "zod";
import { BigFive, type Candidate, type Profile, ProfileEvidence, ProfileItem, type Source } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { FIRST_PERSON } from "@/recipe/seams/evidence-strength";
import { OWN_WRITING, rankSources, sourceBlock, validEvidence } from "@/recipe/seams/profile-gate";

export const MIN_PERSONALITY_LINES = 3;
export const TOO_LITTLE_WRITING = "Too little of the person's own writing to estimate a type.";

const Type = z.object({ type: z.string().min(1), confidence: z.enum(["low", "medium", "high"]) }).nullable();
export const PersonalityReading = z.object({
  disc: Type,
  mbti: Type,
  big5: BigFive.nullable().default(null),
  read: z.string(),
  traits: z.array(ProfileItem).default([]),
  evidence: z.array(ProfileEvidence),
});
export type PersonalityReading = z.infer<typeof PersonalityReading>;

export const PERSONALITY_PROMPT = [
  "`personality`: a working-style inference from the person's own public writing only: their LinkedIn profile text, their own posts, their CV, or a first-person quote of theirs in an interview or talk. Never from what others write about them and never from reposts.",
  "Give a DISC type and an MBTI type, each with confidence low/medium/high; `read`: their working style in two or three sentences; `traits`: working-style rows each with 2-3 of their own quotes as evidence; `evidence`: the quotes behind the types.",
  "`big5`: the Big Five as a lean per dimension (openness, conscientiousness, extraversion, agreeableness, neuroticism): `lean` low/balanced/high, `position` 0-100 along the dimension (50 = balanced), `confidence`, `summary` (one or two sentences on what their writing shows) and 2-4 of their own quotes as evidence, kind INFERENCE unless the quote states the point. Then `recommendations`: 3-5 lines on how to work with and interview them given the read, each naming the dimension it follows from.",
  "Use null types and null big5 when their own writing is too thin.",
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
    return s !== undefined && (OWN_WRITING.has(s.actor) || FIRST_PERSON.test(e.quote));
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

/** One `primary` call for a finished run; throws on model or parse failure so the caller can answer 502. */
export async function readPersonality(input: PersonalityInput, llm: LlmCall): Promise<{ personality: Profile["personality"]; cost_usd: number }> {
  const sources = rankSources(input.sources);
  const head = `Subject: ${input.subject}\nAnchor: ${input.anchor}\nRole: ${input.role ?? "(none)"}\n\n${sourceBlock(sources, [])}`;
  const r = await llm({
    model: "primary",
    system: ["Read the candidate for a hiring manager.", PERSONALITY_PROMPT, PERSONALITY_RULES].join("\n"),
    prompt: head,
    schema: z.object({ personality: PersonalityReading }),
  });
  const reading = PersonalityReading.parse(r.value.personality);
  return { personality: gatePersonality(reading, sources, input.merged), cost_usd: r.cost_usd };
}

export const PERSONALITY_RULES = [
  "Use only the listed sources. Public professional data only.",
  "Every evidence line: `quote` is a verbatim substring of one listed source excerpt, `source_id` is that source's id copied exactly from the [brackets]. kind=FACT when the quote states the point, INFERENCE when the point is your reading of it; `direction` supports, contradicts or context; supports=false exactly when direction is contradicts; `note`: where the line comes from as a recruiter would say it.",
  "Never infer or mention health, politics, religion, ethnicity, sexuality or family life. Never use the words score, rating, trust or culture fit, and never rate the person's reputation, credit or overall quality.",
].join("\n");
