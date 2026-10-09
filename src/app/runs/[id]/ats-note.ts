/**
 * "Copy for ATS" note: a short plain-text note HR pastes into the candidate's card in any ATS (idea #20).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/ats-note.ts
 * Deps:    src/domain/audit (deletionDate), src/domain/url (httpUrl), ./summary (summary30s), ./summary-cs (summaryIn), ./state (RunState, sortLineup, hiringFor), ./i18n (Report)
 * Tested:  src/app/runs/[id]/__tests__/ats-note.test.ts
 *
 * Key responsibilities:
 * - atsNote: subject + role, the three 30-second summary lines, up to 5 confirmed profile links, the link to the full
 *   brief and a footer ("rates the research, not the candidate" + deletion date), or null while there is no brief
 * - Report language (idea #24): with a Czech Report the fixed strings and the date ("16. 10. 2026") are Czech and the
 *   summary sentences come from summaryIn (built from counts and translated criteria / questions, never a translated
 *   sentence); English output is unchanged
 *
 * Design constraints:
 * - Pure and deterministic; plain text only (ATS note fields do not render Markdown), one item per line
 * - Confirmed data only: merged candidates; possibly-same-as, rejected and brief.also_found (namesakes) never go in
 * - Rates the research, never the candidate: no scores, ranks, verdicts or traits
 * - The subject, the role / position title the recruiter typed and the URLs are never translated
 */
import { deletionDate } from "@/domain/audit";
import { httpUrl } from "@/domain/url";
import { ENGLISH_REPORT, type Report } from "./i18n";
import { hiringFor, sortLineup, type RunState } from "./state";
import { summary30s } from "./summary";
import { summaryIn } from "./summary-cs";

/** Most profile links on the note; the full brief has the rest. */
const MAX_PROFILES = 5;

/** First profile URL of each merged candidate, lineup order, deduplicated, at most MAX_PROFILES. */
function confirmedProfiles(state: RunState): string[] {
  const merged = sortLineup(
    state.candidates.filter((c) => c.decision === "merge"),
    (c) => c.decision,
  );
  const urls = merged.map((c) => httpUrl(c.profile_urls[0] ?? "")).filter((u) => u !== null);
  return [...new Set(urls)].slice(0, MAX_PROFILES);
}

/** "2026-10-16" → "16. 10. 2026" (no leading zeros). */
function dateCs(isoDay: string): string {
  const [y = "", m = "", d = ""] = isoDay.split("-");
  return `${String(Number(d))}. ${String(Number(m))}. ${y}`;
}

/** The note, or null while there is no brief; Czech when `report` is the Czech one. */
export function atsNote(state: RunState, briefUrl: string, report: Report = ENGLISH_REPORT): string | null {
  const summary = summary30s(state);
  if (summary === null) return null;
  const role = hiringFor(state)?.trim() ?? "";
  const profiles = confirmedProfiles(state);
  const until = deletionDate(state.created_at).slice(0, 10);
  const cs = report.lang === "cs" ? summaryIn(state, report) : null;
  if (cs !== null) {
    const subject = state.subject.trim() === "" ? "jméno neuvedeno" : state.subject.trim();
    return [
      role === "" ? `Podklady z průzkumu: ${subject}` : `Podklady z průzkumu: ${subject}, pozice ${role}`,
      cs.documented,
      cs.missing,
      cs.ask,
      ...(profiles.length > 0 ? [`Potvrzené profily: ${profiles.join(", ")}`] : []),
      `Celý brief se zdroji: ${briefUrl}`,
      `Tato poznámka hodnotí průzkum, ne kandidáta.${until === "" ? "" : ` Data z průzkumu smažeme po ${dateCs(until)}.`}`,
    ].join("\n");
  }
  const subject = state.subject.trim() === "" ? "unnamed person" : state.subject.trim();
  return [
    role === "" ? `Research brief: ${subject} (no role entered)` : `Research brief: ${subject} for ${role}`,
    summary.documented,
    summary.missing,
    summary.ask,
    ...(profiles.length > 0 ? [`Confirmed profiles: ${profiles.join(", ")}`] : []),
    `Full brief with sources: ${briefUrl}`,
    `This note rates the research, not the candidate.${until === "" ? "" : ` Run data is deleted after ${until}.`}`,
  ].join("\n");
}
