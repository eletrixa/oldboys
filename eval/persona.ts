/**
 * Eval persona contract: one synthetic candidate with recorded tool and model answers plus the written ground truth.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/persona.ts
 * Deps:    src/recipe/step (Question)
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - `recorded`: what the outside world answers (LinkedIn scrape, SERP hits, REST payloads) and what each model call
 *   answers (identity scores, extracted claims, second-model rejections, devil's advocate challenges)
 * - `truth`: written before the run, never derived from it: which profiles are the person, which must-haves are truly
 *   evidenced, which claims must end as FACT / "to verify" / not in the brief, which gaps must be stated
 *
 * Design constraints:
 * - Synthetic people only: fictional names, handles prefixed `evalp-`, web pages on example.com / example.org / example.net
 * - No sensitive traits (health, beliefs, origin, family) in any excerpt; no Groupon data
 * - The eval scores the research pipeline, never a candidate
 */
import type { Question } from "@/recipe/step";

/** A model's extracted claim; `sources` are source URLs ("cv" = the pasted CV), mapped to run ids by the harness. */
export type RecordedClaim = {
  question_id: string;
  text: string;
  kind: "FACT" | "INFERENCE";
  confidence: number;
  quote: string | null;
  sources: string[];
};

export type SerpHit = { title: string; url: string; description: string };

/** harvestapi/linkedin-profile-scraper item shape (src/recipe/sources/linkedin.ts harvestProfiles). */
export type RecordedProfile = {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  experience: { position: string; companyName: string; startDate: string; endDate: string }[];
  education: { schoolName: string; degree: string; fieldOfStudy: string }[];
  skills: string[];
};

export type ChallengeAnswer = { ground: "someone-else" | "fork-or-copy" | "tutorial-or-course" | "outdated"; why: string };

/**
 * Where a claim must end up. `fact`: FACT in the final claims. `to-verify`: not a FACT and listed under "To verify".
 * `not-fact`: anything but a FACT. `not-in-brief`: not a FACT, not in "To verify" and not cited by any brief
 * question (dropped or hidden).
 */
export type ClaimExpectation = "fact" | "to-verify" | "not-fact" | "not-in-brief";

export type Persona = {
  id: string;
  /** One line for the results table: what this persona tests. */
  title: string;
  role: string;
  profileUrl: string | null;
  cvText: string | null;
  /** Role must-haves (ids start with `mh-`), as the role seam or a position would add them. */
  mustHaves: Question[];
  recorded: {
    linkedin: RecordedProfile | null;
    /** Answer of the CV-reading model call (seed seam), only for CV runs. */
    cvFacts?: { full_name: string; headline: string; location: string; current_employer: string; links: string[] };
    serp: Partial<Record<"serp_person" | "social_serp", SerpHit[]>>;
    /** REST payloads by exact URL; any other URL answers `{ items: [] }` (the API found nothing). */
    fetch: Record<string, unknown>;
    /** Identity model: score per profile URL (as the lineup shows it). */
    resolve: Record<string, { score: number; reasons: string[] }>;
    extract: RecordedClaim[];
    /** Claim texts the second verify model answers supported=false for. */
    verifyRejects: string[];
    /** Devil's advocate: claim text -> the ground it answers holds=false with; every other claim holds. */
    challenges: Record<string, ChallengeAnswer>;
    /** When set, the summary model call throws this message (the degraded, no-AI brief path). */
    summaryFails?: string;
  };
  truth: {
    profiles: { url: string; person: boolean; note: string }[];
    mustHaves: Record<string, { evidenced: boolean; keyword: string }>;
    claims: { text: string; expect: ClaimExpectation; trap?: string; cvOutcome?: "matches" | "differs" | "not-found" }[];
    /** Recipe step ids whose "searched, nothing found" or "not searched" gap the brief must state. */
    gaps: string[];
    /** Keywords that must appear in an interview question (e.g. a CV difference to ask about). */
    interviewAbout?: string[];
    /** The brief must say the AI summary was unavailable and still link its evidence. */
    degraded?: boolean;
  };
};
