/**
 * My briefs page: every brief started by the logged-in organization, grouped by position.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/page.tsx
 * Deps:    next, next/link, @opennextjs/cloudflare, ./load
 * Tested:  grouping in src/app/briefs/__tests__/load.test.ts
 *
 * Key responsibilities:
 * - Gate: no session redirects to /login; one primary New brief button (header and empty state) to /briefs/new
 * - One table per position (title links to its results table, "No position" last): candidate, status, fit % when done,
 *   date, Open profile
 *
 * Design constraints:
 * - Server component; always scoped to the session's organization
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { BTN_PRIMARY, CARD, Eyebrow, LINK, Pill } from "../ui";
import { type BriefGroup, groupByPosition, listOrganizationRuns, statusOf } from "./load";

function BriefTable({ group }: { group: BriefGroup }): React.JSX.Element {
  return (
    <div role="region" aria-label={group.title} tabIndex={0} className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Briefs for {group.title}, newest first</caption>
        <thead className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          <tr className="border-b border-divider">
            <th scope="col" className="px-3 py-3 font-medium">Candidate</th>
            <th scope="col" className="px-3 py-3 font-medium">Status</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Fit</th>
            <th scope="col" className="px-3 py-3 font-medium">Date</th>
            <th scope="col" className="px-3 py-3 font-medium"><span className="sr-only">Profile</span></th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => {
            const { label, tone } = statusOf(row.status, row.last_at);
            return (
              <tr key={row.id} className="border-b border-divider">
                <th scope="row" className="px-3 py-3 font-medium">
                  {row.subject === "" ? "the candidate" : row.subject}
                  {row.started_by !== null && <span className="block text-xs font-normal text-muted">started by {row.started_by}</span>}
                </th>
                <td className="px-3 py-3"><Pill tone={tone}>{label}</Pill></td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{row.status === "done" && row.fit_pct !== null ? `${String(row.fit_pct)}%` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-muted">{row.created_at.slice(0, 10)}</td>
                <td className="whitespace-nowrap px-3 py-3"><Link href={`/runs/${row.id}`} className={LINK}>Open profile</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function BriefsPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  const { env } = getCloudflareContext();
  const groups = groupByPosition(await listOrganizationRuns(env.DB, user.organizationId));
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>{user.organizationName}</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Our briefs</h1>
        <p className="max-w-[62ch] text-muted">Every brief your team has started, grouped by position, newest first. Open one to read the evidence.</p>
        <Link href="/briefs/new" className={BTN_PRIMARY}>New brief</Link>
      </header>
      {groups.length === 0 ? (
        <div className={`${CARD} flex w-full max-w-md flex-col items-start gap-3`}>
          <h2 className="text-base font-semibold">No briefs yet</h2>
          <p className="text-sm text-muted">Pick a position, add candidates by LinkedIn profile or CV, and start the research.</p>
          <Link href="/briefs/new" className={BTN_PRIMARY}>New brief</Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`g-${group.key || "none"}`} className="flex flex-col gap-3">
            <h2 id={`g-${group.key || "none"}`} className="font-serif text-2xl">
              {group.positionId === null ? group.title : (
                <Link href={`/positions/${encodeURIComponent(group.positionId)}#candidates`} className="hover:underline">{group.title}</Link>
              )}
            </h2>
            <BriefTable group={group} />
          </section>
        ))
      )}
    </main>
  );
}
