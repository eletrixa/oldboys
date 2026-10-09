/**
 * Evidence and "Sources and gaps" tabs of the finished brief: role criteria table, career timeline, gap groups, confirmed profiles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/brief-evidence.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./brief-layout, ./evidence (type), ./report-lang, ./report-text, ./state, ./parts (platformLabel)
 * Tested:  timeline dates and gap groups in __tests__/brief-layout.test.ts
 *
 * Key responsibilities:
 * - CriteriaTable: Criterion | Research (coverage pill) | What we looked for (criterion text, hidden below md)
 * - CareerTimeline: jobs with parseable dates as bars on a year axis (label column: role · organisation, dates, source);
 *   jobs without dates listed under "Dates not stated"; nothing when no job has dates (the profile's History stays below)
 * - GapGroups: searched-empty and not-searched gaps grouped by reason in plain words; the raw reason (HTTP codes) only in
 *   the row's title attribute, the audit record has the rest
 * - ConfirmedProfiles: the merged candidates as links
 *
 * Design constraints:
 * - Coverage describes the research, never the person; Radar tokens only
 */
"use client";

import type { Brief, Candidate, Coverage, HistoryEntry } from "@/domain/claim";
import { CARD, CARD_FLUSH, KEY, Pill, SourceLink, type Tone } from "../../ui";
import { gapGroups, timelineRows } from "./brief-layout";
import type { Evidence } from "./evidence";
import { platformLabel } from "./parts";
import { useReport } from "./report-lang";
import { tid } from "./report-text";
import { GAP_LABEL, type RunState, gapText } from "./state";

const COVERAGE_TONE: Record<Coverage, Tone> = { evidenced: "ok", partial: "unsure", none: "unsure" };

export function CriteriaTable({ state, brief }: { state: RunState; brief: Brief }): React.JSX.Element | null {
  const { t, text } = useReport();
  const byId = new Map(brief.per_question.map((p) => [p.question_id, p]));
  const criteria = state.questions.filter((q) => q.id.startsWith("mh-") && byId.has(q.id));
  if (criteria.length === 0) return null;
  return (
    <section className={CARD_FLUSH} aria-labelledby="criteria-h">
      <h2 id="criteria-h" className="px-5 pt-5 pb-3 font-serif text-xl md:px-6">{t.ui.roleCriteria}</h2>
      <table className="w-full text-left text-sm">
        <thead className="border-y border-divider bg-canvas">
          <tr>
            <th scope="col" className={`${KEY} px-5 py-2 md:px-6`}>{t.ui.criterion}</th>
            <th scope="col" className={`${KEY} px-3 py-2`}>{t.ui.research}</th>
            <th scope="col" className={`${KEY} hidden px-5 py-2 md:table-cell md:px-6`}>{t.ui.lookedFor}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {criteria.map((q) => {
            const coverage = byId.get(q.id)?.coverage ?? "none";
            const body = text(tid.question(q.id), q.text);
            return (
              <tr key={q.id} className="align-top">
                <td className="px-5 py-3 font-medium text-ink md:px-6">{q.title ?? body}</td>
                <td className="px-3 py-3">
                  <Pill tone={COVERAGE_TONE[coverage]}>{t.coverage[coverage]}</Pill>
                </td>
                <td className="hidden px-5 py-3 text-muted md:table-cell md:px-6">{body}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const dates = (h: HistoryEntry, present: string): string => `${h.from ?? "?"} – ${h.to ?? present}`;

/** First source of a history entry, for the label column. */
function entryUrl(h: HistoryEntry, evidence: Evidence): string | null {
  for (const e of h.evidence) {
    const url = evidence.sourceOf.get(e.source_id)?.url;
    if (url !== undefined) return url;
  }
  return null;
}

export function CareerTimeline({ history, evidence, nowIso }: { history: readonly HistoryEntry[]; evidence: Evidence; nowIso: string }): React.JSX.Element | null {
  const { t } = useReport();
  const now = new Date(nowIso);
  const nowYear = now.getUTCFullYear() + now.getUTCMonth() / 12;
  const timeline = timelineRows(history.filter((h) => h.kind === "job"), nowYear);
  if (timeline === null) return null;
  const { rows, undated, start, end } = timeline;
  const span = end - start;
  const years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const pct = (y: number): string => `${String(((y - start) / span) * 100)}%`;
  const LABEL = "md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]";
  return (
    <section className={CARD} lang="en" aria-labelledby="career-h">
      <h2 id="career-h" className="font-serif text-xl">{t.ui.careerTitle}</h2>
      <p className="mt-1 text-xs text-muted">{t.ui.careerIntro}</p>
      <div className={`mt-4 hidden gap-4 md:grid ${LABEL}`}>
        <span />
        <div className="relative h-4 text-xs text-muted tabular-nums" aria-hidden="true">
          {years.map((y, i) => (
            <span key={y} className={`absolute top-0 ${i === years.length - 1 ? "-translate-x-full" : i === 0 ? "" : "-translate-x-1/2"}`} style={{ left: pct(y) }}>
              {y}
            </span>
          ))}
        </div>
      </div>
      <ol className="mt-2 divide-y divide-divider">
        {rows.map(({ entry: h, from, to, open }) => {
          const url = entryUrl(h, evidence);
          return (
            <li key={`${h.organization}-${h.title}-${h.from ?? ""}`} className={`grid gap-2 py-3 md:items-center md:gap-4 ${LABEL}`}>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink [overflow-wrap:anywhere]">
                  {h.title} <span className="text-muted">·</span> {h.organization}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  {dates(h, t.ui.present)}
                  {url !== null && <SourceLink url={url} className="ml-2" />}
                </p>
              </div>
              <div className="relative h-2.5 rounded-full bg-divider" aria-hidden="true">
                <span className={`absolute inset-y-0 rounded-full ${open ? "bg-ok" : "bg-ink"}`} style={{ left: pct(from), width: `${String(Math.max(((to - from) / span) * 100, 1.5))}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      {undated.length > 0 && (
        <div className="mt-3 border-t border-divider pt-3">
          <p className={KEY}>{t.ui.datesNotStated}</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-ink">
            {undated.map((h) => (
              <li key={`${h.organization}-${h.title}`}>
                {h.title} <span className="text-muted">·</span> {h.organization}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function GapGroups({ brief }: { brief: Brief }): React.JSX.Element | null {
  const report = useReport();
  const { t } = report;
  const groups = gapGroups(brief);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="gaps-h" className="flex flex-col gap-3">
      <div>
        <h2 id="gaps-h" className="font-serif text-xl">{t.ui.gapsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.ui.gapsIntro}</p>
      </div>
      {groups.map((g) => (
        <div key={g.group}>
          <h3 className="text-sm font-semibold text-ink">{t.ui.gapGroup[g.group]}</h3>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {g.rows.map((r) => {
              const id = r.searched ? tid.searchedEmpty(r.index) : tid.notSearched(r.index);
              return (
                <li key={`${r.source}-${String(r.index)}-${String(r.searched)}`} title={`${GAP_LABEL[r.source] ?? r.source}: ${r.reason}`} className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="neutral">{t.label(GAP_LABEL[r.source] ?? r.source)}</Pill>
                  {g.group === "other" && <span className="text-xs text-muted">{report.text(id, gapText(r.reason))}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function ConfirmedProfiles({ candidates }: { candidates: readonly Candidate[] }): React.JSX.Element {
  const { t, lang } = useReport();
  const merged = candidates.filter((c) => c.decision === "merge");
  return (
    <section aria-labelledby="confirmed-h">
      <h2 id="confirmed-h" className="font-serif text-xl">{t.ui.confirmedProfiles}</h2>
      {merged.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t.ui.noConfirmedProfiles}</p>
      ) : (
        <ul className="mt-2 divide-y divide-divider">
          {merged.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{platformLabel(c)}</span>
                {c.profile_urls[0] !== undefined && <SourceLink url={c.profile_urls[0]} label={c.profile_urls[0].replace(/^https?:\/\/(www\.)?/, "")} className="[overflow-wrap:anywhere] whitespace-normal" />}
              </span>
              {c.snippet !== "" && <span lang={lang === "en" ? undefined : ""} className="line-clamp-2 text-xs text-muted">{c.snippet}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
