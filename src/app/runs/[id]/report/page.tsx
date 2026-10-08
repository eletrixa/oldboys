/**
 * Report page /runs/:id/report: claims grouped by kind with sources, gaps, and the lineup when paused.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/report/page.tsx
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, tailwindcss
 * Tested:  n/a (server component; projection logic lives in src/domain/run-status)
 *
 * Key responsibilities:
 * - Server-render the current ledger state from D1; every claim shows its quote and source links
 * - Show the candidate lineup with LineupForm while status is paused
 * - noindex: report pages are reachable by UUID only (plans/004 risk register)
 *
 * Design constraints:
 * - No live stream here yet; the SSE route exists for a client view later. Reload shows progress.
 * - Never renders anything that is not in the ledger
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { toRunStatus, type ClaimKindCount, type InvestigationHead, type LineupCandidate } from "@/domain/run-status";
import { LineupForm } from "../lineup-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type ClaimRow = {
  id: string;
  question_id: string;
  text: string;
  kind: string;
  confidence: number;
  quote: string | null;
  supports_json: string;
};
type SourceRow = { id: string; url: string; excerpt: string };
type GapRow = { question_id: string; reason: string };

function sourceIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const { env } = getCloudflareContext();

  const head = await env.DB.prepare("SELECT id, subject, goal, status, created_at FROM investigations WHERE id = ?")
    .bind(id)
    .first<InvestigationHead>();
  if (!head) notFound();

  const [claims, sources, gaps, counts, candidates] = await Promise.all([
    env.DB.prepare(
      "SELECT id, question_id, text, kind, confidence, quote, supports_json FROM claims WHERE run_id = ? ORDER BY rank, kind",
    )
      .bind(id)
      .all<ClaimRow>(),
    env.DB.prepare("SELECT id, url, excerpt FROM sources WHERE run_id = ?").bind(id).all<SourceRow>(),
    env.DB.prepare("SELECT question_id, reason FROM gaps WHERE run_id = ?").bind(id).all<GapRow>(),
    env.DB.prepare("SELECT kind, COUNT(*) AS n FROM claims WHERE run_id = ? GROUP BY kind").bind(id).all<ClaimKindCount>(),
    env.DB.prepare("SELECT id, name, anchor_match, score, decision FROM candidates WHERE run_id = ? ORDER BY score DESC")
      .bind(id)
      .all<LineupCandidate>(),
  ]);
  const status = toRunStatus(head, counts.results, gaps.results.length, candidates.results);
  const sourceById = new Map(sources.results.map((s) => [s.id, s]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {status.goal} · {status.status}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{status.subject}</h1>
        <p className="text-zinc-400">
          {status.facts} facts · {status.inferences} inferences · {status.statements} statements · {status.gaps} gaps
        </p>
      </header>

      {status.needsAnswer ? <LineupForm runId={id} candidates={status.needsAnswer} /> : null}

      <section className="flex flex-col gap-3" aria-label="Claims">
        <h2 className="text-lg font-medium">Claims</h2>
        {claims.results.length === 0 ? <p className="text-zinc-500">Nothing in the ledger yet. Reload to see progress.</p> : null}
        {claims.results.map((claim) => (
          <article key={claim.id} className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center gap-2 text-xs">
              <span className={claim.kind === "FACT" ? "rounded bg-emerald-900 px-2 py-0.5" : "rounded bg-zinc-800 px-2 py-0.5"}>{claim.kind}</span>
              <span className="text-zinc-500">confidence {Math.round(claim.confidence * 100)}%</span>
              <span className="text-zinc-600">{claim.question_id}</span>
            </div>
            <p>{claim.text}</p>
            {claim.quote !== null ? <blockquote className="border-l-2 border-zinc-700 pl-3 text-sm text-zinc-400">“{claim.quote}”</blockquote> : null}
            <ul className="flex flex-wrap gap-2 text-xs">
              {sourceIds(claim.supports_json).map((sid) => {
                const source = sourceById.get(sid);
                return source ? (
                  <li key={sid}>
                    <a className="underline decoration-zinc-600 hover:decoration-zinc-300" href={source.url} rel="noreferrer" target="_blank">
                      {new URL(source.url).hostname}
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-2" aria-label="Gaps">
        <h2 className="text-lg font-medium">What we could not find</h2>
        {gaps.results.length === 0 ? <p className="text-zinc-500">No gaps recorded.</p> : null}
        <ul className="list-disc pl-5 text-zinc-400">
          {gaps.results.map((gap) => (
            <li key={gap.question_id}>
              <span className="text-zinc-200">{gap.question_id}</span>: {gap.reason}
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs text-zinc-600">
        Public sources only. Raw scraped data is purged after judging. Run {id}.
      </footer>
    </main>
  );
}
