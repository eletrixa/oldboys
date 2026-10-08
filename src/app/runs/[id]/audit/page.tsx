/**
 * Audit record page: GDPR record of one run (who started it, legal basis, candidate notice, every source queried, lineup, calls, retention).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/audit/page.tsx
 * Deps:    next, @opennextjs/cloudflare (getCloudflareContext), binding DB, src/app/api/runs/[id]/audit/load, src/app/ui.tsx
 * Tested:  n/a (projection tested in src/domain/__tests__/audit.test.ts)
 *
 * Key responsibilities:
 * - Server-render the AuditRecord from D1; "Download audit record (.json)" fetches the same data from
 *   GET /api/runs/:id/audit?download=1
 *
 * Design constraints:
 * - Missing times are omitted from meta lines, never shown as a dash; lineup answers are Pills
 * - Server component, rendered per request; shows no traits, claims, excerpts or profile URLs
 * - Lineup titles only for confirmed profiles; the record holds null for namesakes and "not sure"
 * - Same access rule as the run page: the id is an unguessable UUID
 * - Back link arrow is decorative (aria-hidden); download is an <a download> styled BTN_SECONDARY
 * - Radar look per docs/design/radar-ui.md: ui.tsx primitives and semantic tokens only, no raw colours
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { loadAuditRecord } from "@/app/api/runs/[id]/audit/load";
import type { AuditRecord, LineupAnswer, SourceStatus } from "@/domain/audit";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, CARD, Eyebrow, Pill, type Tone } from "@/app/ui";

export const dynamic = "force-dynamic";

const H2 = "mb-3 font-serif text-2xl";
const VIA_LABEL: Record<AuditRecord["run"]["started_via"], string> = {
  form: "Start form",
  extension: "Browser extension",
  api: "API",
};
const STATUS_TONE: Record<SourceStatus, Tone> = {
  ok: "ok",
  empty: "neutral",
  failed: "conflict",
  "not searched": "neutral",
};

/** "2026-10-08 20:00 UTC"; empty or unreadable dates read as a dash. */
function when(iso: string | null): string {
  if (iso === null || iso === "" || Number.isNaN(Date.parse(iso))) return "–";
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Like when(), but null for a missing or unreadable time so meta lines can skip the segment. */
function whenOrNull(iso: string | null): string | null {
  return when(iso) === "–" ? null : when(iso);
}

function AnswerPill({ answer }: { answer: LineupAnswer }): React.JSX.Element {
  if (answer === "yes") return <Pill tone="ok">This is them</Pill>;
  if (answer === "no") return <Pill tone="neutral">Someone else</Pill>;
  return <Pill tone="unsure">Not sure yet</Pill>;
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SourcesCard({ record }: { record: AuditRecord }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 className={H2}>Sources queried</h2>
      {record.sources.length === 0 ? (
        <p className="text-sm text-muted">No source steps recorded.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {record.sources.map((s) => (
            <li key={s.step} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{s.source}</span>
                <Pill tone={STATUS_TONE[s.status]}>{s.status}</Pill>
              </div>
              <p className="text-xs text-muted tabular-nums">
                {[
                  whenOrNull(s.time),
                  `${String(s.items)} ${s.items === 1 ? "item" : "items"}`,
                  usd(s.cost_usd),
                  s.reason,
                ]
                  .filter((part): part is string => part !== null)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted tabular-nums">
        Model calls: {String(record.model_calls)} · Total cost: {usd(record.total_cost_usd)}
      </p>
    </section>
  );
}

function LineupCard({ record }: { record: AuditRecord }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 className={H2}>Profile answers given</h2>
      {record.lineup.length === 0 ? (
        <p className="text-sm text-muted">No profile questions were answered.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {record.lineup.map((l, i) => (
            <li key={`${l.platform}-${String(i)}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="text-muted">{l.platform}</span> ·{" "}
                {l.title ?? <span className="text-muted">title not kept</span>}
              </span>
              <AnswerPill answer={l.answer} />
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
      <h2 className={H2}>Verification calls</h2>
      {record.verification_calls.length === 0 ? (
        <p className="text-sm text-muted">No verification calls.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {record.verification_calls.map((c, i) => (
            <li key={String(i)} className="flex items-center gap-3">
              <span>{c.status}</span>
              {c.mock && <Pill tone="unsure">MOCK</Pill>}
              {whenOrNull(c.created_at) !== null && <span className="text-xs text-muted tabular-nums">{when(c.created_at)}</span>}
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
      <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-10 md:py-14">
        <Eyebrow>Audit</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05]">We could not find this run</h1>
        <p className="text-muted">It may have been deleted already.</p>
        <Link href="/" className={`${BTN_PRIMARY} self-start`}>Back to home</Link>
      </main>
    );
  }
  const { run, legal, retention } = record;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3 border-b border-divider pb-8">
        <Link href={`/runs/${id}`} className={`${BTN_QUIET} -ml-3 self-start`}><span aria-hidden="true">←</span> Back to the brief</Link>
        <Eyebrow>Audit</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Audit record</h1>
        <p className="text-sm text-muted tabular-nums">Generated {when(record.generated_at)}</p>
        <a
          href={`/api/runs/${id}/audit?download=1`}
          download={`audit-record-${id.slice(0, 8)}.json`}
          className={`${BTN_SECONDARY} self-start`}
        >
          Download audit record (.json)
        </a>
      </header>

      <section className={CARD}>
        <h2 className={H2}>Run</h2>
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
        <h2 className={H2}>Legal basis and purpose</h2>
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
        <h2 className={H2}>Retention</h2>
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
