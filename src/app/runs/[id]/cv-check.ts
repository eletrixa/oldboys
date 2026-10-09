/**
 * CV consistency check (idea #14) in the report: outcome labels for the "CV vs public record" section and its counts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/cv-check.ts
 * Deps:    src/domain/cv-check, src/domain/claim (types), ../../ui (Tone type), ./state (RunState type)
 * Tested:  src/app/runs/[id]/__tests__/cv-check.test.ts
 *
 * Key responsibilities:
 * - CV_OUTCOME: label and Pill tone per outcome ("Matches public record" ok, "Differs — ask, don't assume" unsure,
 *   "Not found publicly" neutral) and the one-line explainer shown in the section
 * - cvRows: the section's claims with their outcome (cvOutcome over the run's CV source ids), in display order
 * - cvCounts / cvSummaryLine: "CV: 3 statements match the public record, 1 to ask about." for the 30-second summary
 * - cvDifferenceTexts: to_verify items that are CV differences (reference checks leave them to the interview)
 *
 * Design constraints:
 * - Pure, deterministic and server-safe; words describe the research, never the candidate
 */
import type { Claim } from "@/domain/claim";
import { CV_OUTCOMES, CV_QUESTION_ID, type CvOutcome, cvOutcome, isCvSource } from "@/domain/cv-check";
import type { Tone } from "../../ui";
import type { RunState } from "./state";

export const CV_OUTCOME: Record<CvOutcome, { tone: Tone; label: string }> = {
  matches: { tone: "ok", label: "Matches public record" },
  differs: { tone: "unsure", label: "Differs — ask, don't assume" },
  "not-found": { tone: "neutral", label: "Not found publicly" },
};

export const CV_EXPLAINER = "A difference is a question for the interview, not a verdict. CVs often round dates or use older titles.";

/** True for the brief section (and per-question row) of the CV check. */
export function isCvSection(id: string): boolean {
  return id === CV_QUESTION_ID;
}

function cvIdsOf(sources: readonly { id: string; url: string }[]): Set<string> {
  return new Set(sources.filter((s) => isCvSource(s)).map((s) => s.id));
}

/** Claims with their outcome, matches first, then differences, then not found; claim order kept inside a group. */
export function cvRows(claims: readonly Claim[], sources: readonly { id: string; url: string }[]): { claim: Claim; outcome: CvOutcome }[] {
  const cvIds = cvIdsOf(sources);
  const rows = claims.map((claim) => ({ claim, outcome: cvOutcome(claim, cvIds) }));
  return CV_OUTCOMES.flatMap((o) => rows.filter((r) => r.outcome === o));
}

function cvClaims(state: Pick<RunState, "brief" | "claims">): Claim[] {
  const ids = new Set(state.brief?.per_question.find((q) => isCvSection(q.question_id))?.claim_ids ?? []);
  return state.claims.filter((c) => ids.has(c.id));
}

export function cvCounts(state: Pick<RunState, "brief" | "claims" | "sources">): Record<CvOutcome, number> {
  const counts: Record<CvOutcome, number> = { matches: 0, differs: 0, "not-found": 0 };
  for (const r of cvRows(cvClaims(state), state.sources)) counts[r.outcome] += 1;
  return counts;
}

/** "CV: 3 statements match the public record, 1 to ask about." or null when the run has no CV check claims. */
export function cvSummaryLine(state: Pick<RunState, "brief" | "claims" | "sources">): string | null {
  const c = cvCounts(state);
  if (c.matches + c.differs + c["not-found"] === 0) return null;
  const match = `${String(c.matches)} ${c.matches === 1 ? "statement matches" : "statements match"} the public record`;
  const notFound = c["not-found"] > 0 ? `, ${String(c["not-found"])} not found publicly` : "";
  return `CV: ${match}, ${String(c.differs)} to ask about${notFound}.`;
}

/** to_verify items that restate a CV difference claim. */
export function cvDifferenceTexts(state: Pick<RunState, "brief" | "claims" | "sources">): Set<string> {
  return new Set(cvRows(cvClaims(state), state.sources).filter((r) => r.outcome === "differs").map((r) => r.claim.text));
}
