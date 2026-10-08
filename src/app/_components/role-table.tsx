/**
 * Coverage table for one role or position: evidence found per must-have, per run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/role-table.tsx
 * Deps:    next/link, src/domain/role-overview
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

export const DISCLAIMER = "This table shows how much public evidence the research found, not how good a candidate is.";

const CELL_STYLE: Readonly<Record<CoverageLabel, string>> = {
  documented: "text-teal-300",
  partial: "text-amber-300",
  "no evidence": "text-zinc-400",
  "not checked": "text-zinc-500 italic",
};

export function RoleTable({ group }: { group: RoleGroup }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{group.role}</h2>
      <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{DISCLAIMER}</p>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Evidence found per must-have for {group.role}, newest brief first</caption>
          <thead className="bg-zinc-900 text-xs text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Person</th>
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              {group.questions.map((q) => (
                <th key={q} scope="col" className="min-w-40 px-3 py-2 font-medium">{q}</th>
              ))}
              <th scope="col" className="px-3 py-2 font-medium">Sources confirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {group.runs.map((run) => (
              <tr key={run.id}>
                <th scope="row" className="px-3 py-2 font-medium">
                  <Link href={`/runs/${run.id}`} className="text-teal-300 underline-offset-2 hover:underline">{run.subject}</Link>
                </th>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{run.created_at.slice(0, 10)}</td>
                <td className="px-3 py-2 text-zinc-400">{run.status}</td>
                {run.cells.map((label, i) => (
                  <td key={group.questions[i] ?? i} className={`px-3 py-2 ${CELL_STYLE[label]}`}>{label}</td>
                ))}
                <td className="px-3 py-2 text-zinc-300">{run.sources_confirmed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        &quot;Not checked&quot; means the brief is missing, ran without the AI summary, or did not ask this question. Only sources tied to a confirmed profile are counted.
      </p>
    </div>
  );
}
