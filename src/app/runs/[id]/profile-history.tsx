/**
 * Career timeline of the candidate profile: date column, hairline rail, org and title, evidence.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-history.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./evidence-line, ./profile-evidence
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Jobs newest first (5 visible, the rest behind "Show N earlier jobs"), then education, projects and community
 * - An entry with no kept quote says so instead of showing nothing
 */
import type { HistoryEntry } from "@/domain/claim";
import { CARD, Pill } from "../../ui";
import { type Ctx, MEASURE, NOTE, NoQuote } from "./evidence-line";
import { Dropped, EvidenceList, Head, INTRO, More } from "./profile-evidence";

const dates = (h: HistoryEntry): string => (h.from === null && h.to === null ? "" : `${h.from ?? "?"} – ${h.to ?? "Present"}`);

/** Timeline: date column, hairline with a node per entry, org · title, summary, evidence. */
function HistoryRows({ entries, ctx }: { entries: HistoryEntry[]; ctx: Ctx }): React.JSX.Element {
  return (
    <ol>
      {entries.map((h) => (
        <li key={`${h.organization}-${h.title}-${h.from ?? ""}`}>
          {/* Date sits in a left column from sm up; on phones it heads the entry on the rail so the text keeps the width. */}
          <div className="relative border-l border-divider pb-6 pl-4 before:absolute before:top-1.5 before:-left-1 before:size-2 before:rounded-full before:border before:border-line before:bg-surface sm:ml-36">
            <p className="mb-1 text-xs text-ink tabular-nums sm:absolute sm:top-px sm:-left-36 sm:mb-0 sm:w-32">
              {dates(h)}
              {h.duration !== "" && (
                <>
                  <span className="text-muted sm:hidden">{"\u00a0· "}</span>
                  <span className="text-muted sm:block">{h.duration}</span>
                </>
              )}
            </p>
            <h3 className="text-sm font-semibold text-ink">
              {h.organization}
              <span className="font-normal text-ink">
                <span className="text-muted">{"\u00a0· "}</span>
                {h.title}
              </span>
              {h.kind !== "job" && (
                <Pill tone="neutral" className="ml-2 py-0">
                  {h.kind}
                </Pill>
              )}
            </h3>
            {h.location !== "" && <p className={NOTE}>{h.location}</p>}
            {h.summary !== "" && <p className={`mt-1 ${MEASURE} text-sm text-muted`}>{h.summary}</p>}
            {h.evidence.length === 0 ? <NoQuote /> : <EvidenceList items={h.evidence} ctx={ctx} about={`${h.organization}, ${h.title}`} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function History({ entries, dropped, ctx }: { entries: HistoryEntry[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  const VISIBLE = 5;
  const jobs = entries.filter((h) => h.kind === "job");
  const other = entries.filter((h) => h.kind !== "job");
  const older = jobs.slice(VISIBLE);
  return (
    <section className={CARD}>
      <Head id="history" eyebrow="Career" title="3. History" />
      <p className={INTRO}>Jobs as LinkedIn lists them (self-reported, newest first), then education, projects and community.</p>
      <div className="mt-6">
        <HistoryRows entries={jobs.slice(0, VISIBLE)} ctx={ctx} />
        {older.length > 0 && (
          <More label={`Show ${String(older.length)} earlier ${older.length === 1 ? "job" : "jobs"}`}>
            <HistoryRows entries={older} ctx={ctx} />
          </More>
        )}
        {other.length > 0 && (
          <More label={`Education, projects and community (${String(other.length)})`}>
            <HistoryRows entries={other} ctx={ctx} />
          </More>
        )}
      </div>
      <Dropped n={dropped} />
    </section>
  );
}
