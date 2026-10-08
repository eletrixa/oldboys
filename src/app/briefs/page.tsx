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
import { listOrganizationRuns } from "./load";

export default async function BriefsPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  const { env } = getCloudflareContext();
  const rows = await listOrganizationRuns(env.DB, user.organizationId);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">My briefs</h1>
      {rows.length === 0 ? (
        <p className="text-zinc-400">
          No briefs yet.{" "}
          <Link href="/" className="text-teal-300 underline-offset-2 hover:underline">Start your first one</Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Briefs started by {user.organizationName}, newest first</caption>
            <thead className="bg-zinc-900 text-xs text-zinc-400">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Candidate</th>
                <th scope="col" className="px-3 py-2 font-medium">Role</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Date</th>
                <th scope="col" className="px-3 py-2 font-medium">Started by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-3 py-2 font-medium">
                    <Link href={`/runs/${row.id}`} className="text-teal-300 underline-offset-2 hover:underline">
                      {row.subject === "" ? "the candidate" : row.subject}
                    </Link>
                  </th>
                  <td className="px-3 py-2 text-zinc-300">{row.role ?? ""}</td>
                  <td className="px-3 py-2 text-zinc-400">{row.status}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{row.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-zinc-400">{row.started_by ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
