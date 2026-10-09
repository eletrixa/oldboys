/**
 * Fictional rows for the landing hero example: one requirement per coverage word, in the run page's vocabulary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/evidence-data.ts
 * Deps:    ../ui (Tone)
 * Tested:  n/a (static copy; e2e/home.spec.ts opens the evidence)
 *
 * Key responsibilities:
 * - EVIDENCED / PARTIAL / NONE (and EXAMPLES in tab order): each with requirement, claim (FACT or INFERENCE), quote and source when
 *   there is one, the status explanation (with the open part marked) and the interview question it leads to
 *
 * Design constraints:
 * - Same fictional candidate as the sample brief (Jan, Senior Data Engineer at Acme); never a real person
 * - Words rate the evidence, never the candidate; "none" says that missing evidence is not evidence against
 */
import type { Tone } from "../ui";

export type Example = {
  key: "evidenced" | "partial" | "none";
  tone: Tone;
  requirement: string;
  claim: { kind: "FACT" | "INFERENCE"; text: string } | null;
  quote: string | null;
  source: { host: string; read: string; confirmed: string; before: string; after: string; kept: string } | null;
  /** Status explanation; `open` is the unresolved part the question is built from. */
  why: { lead: string; open: string };
  question: string;
  from: string;
};

export const EVIDENCED: Example = {
  key: "evidenced",
  tone: "ok",
  requirement: "Writes production SQL",
  claim: { kind: "FACT", text: "Owns the SQL for Acme's nightly reporting pipelines." },
  quote: "I own the SQL behind our nightly reporting pipelines and the tests around them.",
  source: {
    host: "linkedin.com",
    read: "3 Oct",
    confirmed: "the LinkedIn profile you gave Radar",
    before: "Senior Data Engineer, Acme · 2022 – now. ",
    after: " Moved three reports from hourly to nightly loads.",
    kept: "10 Oct",
  },
  why: { lead: "A first-hand statement on the profile you supplied. ", open: "How the tests work is worth hearing." },
  question: "Walk me through the pipeline you built at Acme and how you tested it.",
  from: "Goes deeper on supported evidence",
};

export const PARTIAL: Example = {
  key: "partial",
  tone: "unsure",
  requirement: "Cloud data platforms",
  claim: { kind: "FACT", text: "Maintains a public dbt project for a cloud warehouse." },
  quote: "dbt models and tests for our BigQuery warehouse.",
  source: {
    host: "github.com",
    read: "3 Oct",
    confirmed: "linked from the confirmed LinkedIn profile",
    before: "README · ",
    after: " Runs on a schedule; see /models for the marts.",
    kept: "10 Oct",
  },
  why: { lead: "One public project. ", open: "Whether it ran in production is open." },
  question: "Which cloud warehouse have you run in production, and what did you own there?",
  from: "Built from the open point: production use",
};

export const NONE: Example = {
  key: "none",
  tone: "neutral",
  requirement: "Has led a team of at least three engineers",
  claim: null,
  quote: null,
  source: null,
  why: { lead: "No public source mentions this. ", open: "Missing evidence is not evidence against it." },
  question: "Have you led other engineers? Tell me about one decision you made for the team.",
  from: "Built from the requirement with no source yet",
};

export const EXAMPLES: readonly Example[] = [EVIDENCED, PARTIAL, NONE];

/** What the example run searched, for the "none" row's disclosure. */
export const SEARCHED = "LinkedIn, GitHub, personal blog and Stack Overflow";
export const NOT_SEARCHED = "X (rate limited). Nothing about private life was collected.";
