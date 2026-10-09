/**
 * My briefs page: every brief started by the logged-in organization, grouped by position.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/page.tsx
 * Deps:    next, next/link, @opennextjs/cloudflare, ./load, ./brief-table
 * Tested:  grouping in src/app/briefs/__tests__/load.test.ts
 *
 * Key responsibilities:
 * - Gate: no session redirects to /login; one primary New brief button (header and empty state) to /briefs/new
 * - One table per position (title links to its results table, count in muted, "No position" last), see ./brief-table
 *
 * Design constraints:
 * - Server component; always scoped to the session's organization
 */
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { BTN_PRIMARY, CARD, Eyebrow } from "../ui";
import { BriefTable } from "./brief-table";
import { groupByPosition, listOrganizationRuns } from "./load";

export const metadata: Metadata = { title: "My briefs" };

export default async function BriefsPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  const { env } = getCloudflareContext();
  const groups = groupByPosition(await listOrganizationRuns(env.DB, user.organizationId));
  const positions = groups.filter((g) => g.positionId !== null).length;
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>{user.organizationName}</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">My briefs</h1>
        <p className="max-w-[62ch] text-muted">{total > 0 && `${plural(total, "brief")}${positions > 0 ? ` across ${plural(positions, "position")}` : ""}. `}Every brief your team has started, grouped by position, newest first. Open one to read the evidence.</p>
        <Link href="/briefs/new" className={BTN_PRIMARY}>New brief</Link>
      </header>
      {groups.length === 0 ? (
        <div className={`${CARD} flex w-full max-w-md flex-col items-start gap-3`}>
          <h2 className="text-base font-semibold">No briefs yet</h2>
          <p className="text-sm text-muted">Pick a position, add people by LinkedIn profile or CV, and start the research for all of them at once.</p>
          <Link href="/briefs/new" className={BTN_PRIMARY}>New brief</Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`g-${group.key || "none"}`} className="flex flex-col gap-3">
            <h2 id={`g-${group.key || "none"}`} className="font-serif text-2xl">
              {group.positionId === null ? group.title : (
                <Link href={`/positions/${encodeURIComponent(group.positionId)}#candidates`} className="hover:underline">{group.title}</Link>
              )}
              <span className="text-base text-muted"> · {plural(group.rows.length, "brief")}</span>
            </h2>
            <BriefTable group={group} />
          </section>
        ))
      )}
    </main>
  );
}
