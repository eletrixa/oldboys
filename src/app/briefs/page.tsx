/**
 * My briefs page: every brief started by the logged-in organization.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/page.tsx
 * Deps:    next, next/link, @opennextjs/cloudflare, ./load
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Gate: no session redirects to /login; table of candidate, role, status, date, started by, link to the run
 *
 * Design constraints:
 * - Server component; always scoped to the session's organization
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { BTN_PRIMARY, CARD, Eyebrow, LINK, Pill, type Tone } from "../ui";
import { listOrganizationRuns } from "./load";

const STATUS_TONE: Readonly<Record<string, Tone>> = { done: "ok", failed: "conflict", paused: "unsure" };

export default async function BriefsPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  const { env } = getCloudflareContext();
  const rows = await listOrganizationRuns(env.DB, user.organizationId);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3 border-b border-divider pb-8">
        <Eyebrow>{user.organizationName}</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Our briefs</h1>
        <p className="max-w-[62ch] text-muted">Every brief your team has started, newest first. Open one to read the evidence or answer a profile question.</p>
      </header>
      {rows.length === 0 ? (
        <div className={`${CARD} flex w-full max-w-md flex-col items-start gap-3`}>
          <h2 className="text-base font-semibold">No briefs yet</h2>
          <p className="text-sm text-muted">Start with a candidate&apos;s LinkedIn profile or CV and the role you are hiring for.</p>
          <Link href="/" className={BTN_PRIMARY}>Start a brief</Link>
        </div>
      ) : (
        <div role="region" aria-label="Briefs" tabIndex={0} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Briefs started by {user.organizationName}, newest first</caption>
            <thead className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              <tr className="border-b border-divider">
                <th scope="col" className="px-3 py-3 font-medium">Candidate</th>
                <th scope="col" className="px-3 py-3 font-medium">Role</th>
                <th scope="col" className="px-3 py-3 font-medium">Status</th>
                <th scope="col" className="px-3 py-3 font-medium">Date</th>
                <th scope="col" className="px-3 py-3 font-medium">Started by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-divider">
                  <th scope="row" className="px-3 py-3 font-medium">
                    <Link href={`/runs/${row.id}`} className={LINK}>
                      {row.subject === "" ? "the candidate" : row.subject}
                    </Link>
                  </th>
                  <td className="px-3 py-3">{row.role ?? ""}</td>
                  <td className="px-3 py-3"><Pill tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Pill></td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{row.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-3 text-muted">{row.started_by ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
