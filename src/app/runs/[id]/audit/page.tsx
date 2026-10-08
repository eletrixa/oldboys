/**
 * Audit record page: GDPR record of one run (who started it, legal basis, candidate notice, every source queried, lineup, calls, retention).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/audit/page.tsx
 * Deps:    next, @opennextjs/cloudflare (getCloudflareContext), binding DB, src/app/api/runs/[id]/audit/load
 * Tested:  n/a (projection tested in src/domain/__tests__/audit.test.ts)
 *
 * Key responsibilities:
 * - Server-render the AuditRecord from D1; "Download audit record (.json)" fetches the same data from
 *   GET /api/runs/:id/audit?download=1
 *
 * Design constraints:
 * - Server component, rendered per request; shows no traits, claims, excerpts or profile URLs
 * - Lineup titles only for confirmed profiles; the record holds null for namesakes and "not sure"
 * - Same access rule as the run page: the id is an unguessable UUID
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { loadAuditRecord } from "@/app/api/runs/[id]/audit/load";
import type { AuditRecord, SourceStatus } from "@/domain/audit";

export const dynamic = "force-dynamic";

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5";
const VIA_LABEL: Record<AuditRecord["run"]["started_via"], string> = {
  form: "Start form",
  extension: "Browser extension",
  api: "API",
};
const STATUS_CLS: Record<SourceStatus, string> = {
  ok: "bg-ok-bg text-ok",
  empty: "bg-zinc-700/60 text-zinc-300",
  failed: "bg-red-500/15 text-red-300",
  "not searched": "bg-amber-500/15 text-amber-300",
};

/** "2026-10-08 20:00 UTC"; empty or unreadable dates read as a dash. */
function when(iso: string | null): string {
  if (iso === null || iso === "" || Number.isNaN(Date.parse(iso))) return "–";
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SourcesCard({ record }: { record: AuditRecord }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">Sources queried</h2>
      {record.sources.length === 0 ? (
        <p className="text-sm text-zinc-400">No source steps recorded.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-800">
          {record.sources.map((s) => (
            <li key={s.step} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{s.source}</span>
                <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs ${STATUS_CLS[s.status]}`}>{s.status}</span>
              </div>
              <p className="text-xs text-zinc-500">
                {when(s.time)} · {String(s.items)} {s.items === 1 ? "item" : "items"} · {usd(s.cost_usd)}
                {s.reason !== null && ` · ${s.reason}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-zinc-400">
        Model calls: {String(record.model_calls)} · Total cost: {usd(record.total_cost_usd)}
      </p>
    </section>
  );
}

function LineupCard({ record }: { record: AuditRecord }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">Profile answers given</h2>
      {record.lineup.length === 0 ? (
        <p className="text-sm text-zinc-400">No profile questions were answered.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {record.lineup.map((l, i) => (
            <li key={`${l.platform}-${String(i)}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="text-zinc-500">{l.platform}</span> ·{" "}
                {l.title ?? <span className="text-zinc-500">title not kept</span>}
              </span>
              <span className="shrink-0 text-zinc-300">{l.answer}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CallsCard({ record }: { record: AuditRecord }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">Verification calls</h2>
      {record.verification_calls.length === 0 ? (
        <p className="text-sm text-zinc-400">No verification calls.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {record.verification_calls.map((c, i) => (
            <li key={String(i)} className="flex items-center gap-3">
              <span>{c.status}</span>
              {c.mock && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">MOCK</span>}
              <span className="text-xs text-zinc-500">{when(c.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const record = await loadAuditRecord(env.DB, id, new Date());
  if (!record) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p>We could not find this run. It may have been deleted already.</p>
        <Link href="/" className="text-teal-400 underline">Back</Link>
      </main>
    );
  }
  const { run, legal, retention } = record;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Link href={`/runs/${id}`} className="text-sm text-zinc-400 hover:text-zinc-200">← Back to the brief</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Audit record</h1>
        <p className="text-sm text-zinc-500">Generated {when(record.generated_at)}</p>
        <a
          href={`/api/runs/${id}/audit?download=1`}
          download={`audit-record-${id.slice(0, 8)}.json`}
          className="self-start rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-teal-400"
        >
          Download audit record (.json)
        </a>
      </header>

      <section className={CARD}>
        <h2 className="mb-3 font-semibold">Run</h2>
        <dl className="flex flex-col gap-2">
          <Row label="Started via">{VIA_LABEL[run.started_via]}</Row>
          <Row label="Started at">{when(run.started_at)}</Row>
          <Row label="Goal">{run.goal}</Row>
          <Row label="Subject">{run.subject}</Row>
          <Row label="Anchor">{run.anchor}</Row>
          <Row label="Role">{run.role ?? "–"}</Row>
          <Row label="Status">{run.status}</Row>
        </dl>
      </section>

      <section className={CARD}>
        <h2 className="mb-3 font-semibold">Legal basis and purpose</h2>
        <dl className="flex flex-col gap-2">
          <Row label="Legal basis">{legal.basis}</Row>
          <Row label="Purpose">{legal.purpose}</Row>
          <Row label="Candidate notice">{legal.notice}</Row>
        </dl>
      </section>

      <SourcesCard record={record} />
      <LineupCard record={record} />
      <CallsCard record={record} />

      <section className={CARD}>
        <h2 className="mb-3 font-semibold">Retention</h2>
        <dl className="flex flex-col gap-2">
          <Row label="Deleted on">{when(retention.delete_after)}</Row>
          <Row label="Rule">
            {String(retention.days)} days after the run started. {retention.note}
          </Row>
        </dl>
      </section>
    </main>
  );
}
