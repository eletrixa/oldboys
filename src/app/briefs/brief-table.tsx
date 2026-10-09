/**
 * Briefs table for one position group.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/brief-table.tsx
 * Deps:    next/link, ../ui, ./load
 * Tested:  logic in src/app/briefs/__tests__/load.test.ts (statusOf, relativeTime); rendering not tested
 *
 * Key responsibilities:
 * - One row per brief: the candidate name links to /runs/<id>, status pill, fit % when done, relative date
 * - Date column hidden under sm so five columns do not overflow at 390px
 *
 * Design constraints:
 * - Server component; fit is the evidence share of must-haves, shown never sorted
 */
import Link from "next/link";
import { LINK, Pill } from "../ui";
import { type BriefGroup, relativeTime, statusOf } from "./load";

function Fit({ status, fitPct }: { status: string; fitPct: number | null }): React.JSX.Element {
  if (status !== "done") return <>—<span className="sr-only">not finished</span></>;
  if (fitPct === null) return <span className="text-muted">no fit</span>;
  return <>{String(fitPct)}%</>;
}

export function BriefTable({ group }: { group: BriefGroup }): React.JSX.Element {
  return (
    <div role="region" aria-label={group.title} tabIndex={0} className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Briefs for {group.title}, newest first</caption>
        <thead className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          <tr className="border-b border-divider">
            <th scope="col" className="px-3 py-3 font-medium">Candidate</th>
            <th scope="col" className="px-3 py-3 font-medium">Status</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Fit</th>
            <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell">Date</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => {
            const { label, tone } = statusOf(row.status, row.last_at);
            return (
              <tr key={row.id} className="border-b border-divider">
                <th scope="row" className="px-3 py-3 font-normal">
                  <Link href={`/runs/${row.id}`} className={`${LINK} font-serif text-base`}>{row.subject === "" ? "the candidate" : row.subject}</Link>
                  {row.started_by !== null && <span className="block text-xs text-muted">started by {row.started_by}</span>}
                </th>
                <td className="px-3 py-3"><Pill tone={tone}>{label}</Pill></td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums"><Fit status={row.status} fitPct={row.fit_pct} /></td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-muted sm:table-cell">
                  <time dateTime={row.created_at} title={row.created_at}>{relativeTime(row.created_at)}</time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
