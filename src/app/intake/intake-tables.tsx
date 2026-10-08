/**
 * Tables of the intake page: the application queue and the position tags.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/intake-tables.tsx
 * Deps:    react, next/link, ./intake-rows
 * Tested:  shaping in src/app/intake/__tests__/intake-rows.test.ts; markup n/a
 *
 * Key responsibilities:
 * - ApplicationsTable: received, tag, source, name (email under it), status badge, run link, truncated note (full text in the title);
 *   the empty state names /apply/<tag> and jobs+<tag>@asajj.cz
 * - TagsTable: tag, role, goal, StartupJobs offer id, created date
 *
 * Design constraints:
 * - Presentational: rows arrive shaped, nothing is fetched here
 * - A queue, not a ranking: arrival order, no score column
 */
import Link from "next/link";
import { formatReceived, type IntakeRow, type StatusTone, type TagRow } from "./intake-rows";

const BADGE: Readonly<Record<StatusTone, string>> = {
  ok: "bg-ok-bg text-ok",
  unsure: "bg-unsure-bg text-unsure",
  conflict: "bg-conflict-bg text-conflict",
  neutral: "bg-sage text-ink",
};

const TH = "px-3 py-2 font-medium";

export function ApplicationsTable({ rows }: { rows: IntakeRow[] }): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="text-muted">No applications yet. Point a job posting at /apply/&lt;tag&gt; or jobs+&lt;tag&gt;@asajj.cz.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-divider bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Applications received, newest first</caption>
        <thead className="bg-sage/50 text-xs text-muted">
          <tr>
            <th scope="col" className={TH}>Received</th>
            <th scope="col" className={TH}>Tag</th>
            <th scope="col" className={TH}>Source</th>
            <th scope="col" className={TH}>Name</th>
            <th scope="col" className={TH}>Status</th>
            <th scope="col" className={TH}>Run</th>
            <th scope="col" className={TH}>Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="whitespace-nowrap px-3 py-2 text-muted">{r.received}</td>
              <td className="px-3 py-2">{r.tag ?? <span className="text-muted">—</span>}</td>
              <td className="whitespace-nowrap px-3 py-2">{r.source}</td>
              <th scope="row" className="px-3 py-2 font-medium">
                {r.name}
                {r.email !== null && <span className="block text-xs font-normal text-muted">{r.email}</span>}
              </th>
              <td className="px-3 py-2">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[r.tone]}`}>{r.status}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {r.runHref === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <Link href={r.runHref} className="text-action underline underline-offset-2 hover:text-action-hover">Open brief</Link>
                )}
              </td>
              <td className="max-w-64 px-3 py-2 text-muted" title={r.noteFull ?? undefined}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TagsTable({ tags }: { tags: TagRow[] }): React.JSX.Element {
  if (tags.length === 0) return <p className="text-muted">No tags yet. Create one below; applications need a known tag to start a brief.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-divider bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Position tags</caption>
        <thead className="bg-sage/50 text-xs text-muted">
          <tr>
            <th scope="col" className={TH}>Tag</th>
            <th scope="col" className={TH}>Role</th>
            <th scope="col" className={TH}>Goal</th>
            <th scope="col" className={TH}>StartupJobs offer</th>
            <th scope="col" className={TH}>Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {tags.map((t) => (
            <tr key={t.tag}>
              <th scope="row" className="px-3 py-2 font-medium">{t.tag}</th>
              <td className="px-3 py-2">{t.role}</td>
              <td className="px-3 py-2 text-muted">{t.goal}</td>
              <td className="px-3 py-2 text-muted">{t.startupjobs_offer_id ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{formatReceived(t.created_at).slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
