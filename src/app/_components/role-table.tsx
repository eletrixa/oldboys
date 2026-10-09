/**
 * Coverage table for one role or position: evidence found per must-have, per run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/role-table.tsx
 * Deps:    next/link, src/domain/role-overview, src/app/briefs/load (statusOf), src/app/ui
 * Tested:  builders in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - RoleTable: rows = runs newest first, columns = must-haves + sources confirmed, with the disclaimer
 * - DISCLAIMER: the one sentence every use of the table must show
 *
 * Design constraints:
 * - Table scrolls sideways inside a focusable labelled region; the person column stays sticky; status shows as a plain-word pill (statusOf) unless done
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
import Link from "next/link";
import type { CoverageLabel, RoleGroup } from "@/domain/role-overview";
import { statusOf } from "@/app/briefs/load";
import { CARD_FLUSH, CARD_SAGE, LINK, Pill } from "@/app/ui";

export const DISCLAIMER = "This table shows how much public evidence the research found, not how good a candidate is.";

const CELL_STYLE: Readonly<Record<CoverageLabel, { text: string; dot: string }>> = {
  documented: { text: "text-ok", dot: "bg-ok" },
  partial: { text: "text-unsure", dot: "bg-unsure" },
  "no evidence": { text: "text-muted", dot: "bg-line" },
  "not checked": { text: "text-muted italic", dot: "bg-divider" },
};

export function RoleTable({ group }: { group: RoleGroup }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl">{group.role}</h2>
      <p className={`${CARD_SAGE} text-sm text-muted`}>{DISCLAIMER}</p>
      <div className={CARD_FLUSH}>
        <p className="px-4 pt-3 text-xs text-muted md:hidden">Swipe sideways to see every must-have.</p>
        <div role="region" aria-label="Evidence per must-have" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Evidence found per must-have for {group.role}, newest brief first</caption>
            <thead className="bg-canvas text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-canvas px-4 py-3 font-semibold">Person</th>
                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                {group.questions.map((q) => (
                  <th key={q} scope="col" className="min-w-[10rem] px-4 py-3 text-xs font-semibold tracking-normal text-muted normal-case">{q}</th>
                ))}
                <th scope="col" className="px-4 py-3 font-semibold">Sources confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {group.runs.map((run) => (
                <tr key={run.id}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/runs/${run.id}`} className={LINK}>{run.subject}</Link>
                      {run.status !== "done" && <Pill tone={statusOf(run.status).tone}>{statusOf(run.status).label}</Pill>}
                    </div>
                  </th>
                  <td className="whitespace-nowrap px-4 py-3 text-muted tabular-nums">{run.created_at.slice(0, 10)}</td>
                  {run.cells.map((label, i) => (
                    <td key={group.questions[i] ?? i} className={`px-4 py-3 ${CELL_STYLE[label].text}`}>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${CELL_STYLE[label].dot}`} />
                        {label}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 tabular-nums">{run.sources_confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted">
        &quot;Not checked&quot; means the brief is missing, ran without the AI summary, or did not ask this question. Only sources tied to a confirmed profile are counted.
      </p>
    </div>
  );
}
