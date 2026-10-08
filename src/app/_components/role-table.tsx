/**
 * Coverage table for one role or position: evidence found per must-have, per run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/role-table.tsx
 * Deps:    next/link, src/domain/role-overview, src/app/ui
 * Tested:  builders in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - RoleTable: rows = runs newest first, columns = must-haves + sources confirmed, with the disclaimer
 * - DISCLAIMER: the one sentence every use of the table must show
 *
 * Design constraints:
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
import Link from "next/link";
import type { CoverageLabel, RoleGroup } from "@/domain/role-overview";
import { CARD, CARD_SAGE, LINK } from "@/app/ui";

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
      <p className={`${CARD_SAGE} text-sm`}>{DISCLAIMER}</p>
      <div className={`${CARD} overflow-hidden p-0 md:p-0`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Evidence found per must-have for {group.role}, newest brief first</caption>
            <thead className="bg-canvas text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Person</th>
                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                {group.questions.map((q) => (
                  <th key={q} scope="col" className="min-w-40 px-4 py-3 font-semibold">{q}</th>
                ))}
                <th scope="col" className="px-4 py-3 font-semibold">Sources confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {group.runs.map((run) => (
                <tr key={run.id}>
                  <th scope="row" className="px-4 py-3">
                    <Link href={`/runs/${run.id}`} className={LINK}>{run.subject}</Link>
                  </th>
                  <td className="whitespace-nowrap px-4 py-3 text-muted tabular-nums">{run.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-muted tabular-nums">{run.status}</td>
                  {run.cells.map((label, i) => (
                    <td key={group.questions[i] ?? i} className={`px-4 py-3 ${CELL_STYLE[label].text}`}>
                      <span aria-hidden="true" className={`mr-2 inline-block size-2 rounded-full ${CELL_STYLE[label].dot}`} />
                      {label}
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
